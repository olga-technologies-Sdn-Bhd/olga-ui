import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, CircleAlert, Ellipsis, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Keyboard, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { newIdempotencyKey, withRetries } from '../../api/client';
import { coreApi } from '../../api/core';
import type { ImportedContact, InvitationStatus } from '../../api/types';
import { maskPhone } from '../../auth/phone';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { Screen } from '../../components/Screen';
import { HomeStackParamList } from '../../navigation/types';
import {
  attemptSignature,
  buildInviteAttempt,
  CONTACT_RETENTION_DAYS,
  DeviceContact,
  deviceContactsFrom,
  DIAL_CODES,
  guessDialCode,
  INVITE_BATCH_MAX,
  INVITE_VALID_DAYS,
  InviteAttempt,
  RawContact,
} from '../../sci/contacts';
import { askForContactsAccess, openPhoneSettings, readDeviceContacts } from '../../sci/deviceContacts';
import {
  canResend,
  canWithdraw,
  INVITE_STATUS_LABEL,
  inviteMessage,
  inviteProblem,
  loadImportedContacts,
  removeProblem,
  resendProblem,
  withdrawProblem,
} from '../../sci/invitations';
import { inviteUrl } from '../../sci/inviteLink';
import { safeLogLine } from '../../sci/problems';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'Invite'>;

type Phase = 'intro' | 'reading' | 'denied' | 'pick' | 'done';
type Link = { link_id: string; invitation_id: string; name: string; url: string; status?: InvitationStatus };
// Someone who can be withdrawn or removed: from the list or a new batch.
type Person = { link_id: string; invitation_id?: string | null; name: string; status?: InvitationStatus | null };

// Invite people the member knows: they pick up to 20 contacts, Ol-ga imports
// those people and makes an invitation link for each, and the member sends each
// link themselves. Contact details stay in memory and are never logged.
export function InviteScreen({ navigation, route }: Props) {
  const { ventureId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [phase, setPhase] = useState<Phase>('intro');
  // Everyone on the phone, as read; who can be invited depends on the
  // country code used for numbers saved without one.
  const [raw, setRaw] = useState<RawContact[]>([]);
  const [chosenCode, setChosenCode] = useState<string | null>(null);
  const dialCode = useMemo(() => chosenCode ?? guessDialCode(raw), [chosenCode, raw]);
  const contacts = useMemo<DeviceContact[]>(() => deviceContactsFrom(raw, dialCode), [raw, dialCode]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  // The same people picked again reuse the same IDs and keys (a retry of one
  // action); a different pick is a new action.
  const attempt = useRef<InviteAttempt | null>(null);
  // People already invited (any business), from Ol-ga; null until loaded.
  const [invited, setInvited] = useState<ImportedContact[] | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  // One key per invitation being sent again, kept until it works.
  const resendKeys = useRef<Record<string, string>>({});
  // A withdraw or remove under way (link_id), and one key per action, kept
  // until it works.
  const [working, setWorking] = useState<string | null>(null);
  const actionKeys = useRef<Record<string, string>>({});

  const loadInvited = useCallback(() => {
    loadImportedContacts()
      .then(setInvited)
      .catch((e) => {
        const line = safeLogLine('Load invitations', e);
        if (line) console.warn(line);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInvited();
    }, [loadInvited]),
  );

  // Where each new invitation stands, read again when the member comes back
  // from sending the links.
  const loadBatch = useCallback(() => {
    if (!batchId) return;
    coreApi
      .getInviteBatch(batchId)
      .then((b) => {
        const status: Record<string, InvitationStatus> = {};
        for (const i of b.invitations) status[i.link_id] = i.status;
        setLinks((prev) => prev.map((l) => ({ ...l, status: status[l.link_id] ?? l.status })));
      })
      .catch((e) => {
        const line = safeLogLine('Load invitation batch', e);
        if (line) console.warn(line);
      });
  }, [batchId]);

  useEffect(() => {
    if (phase !== 'done') return;
    loadBatch();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && loadBatch());
    return () => sub.remove();
  }, [phase, loadBatch]);

  // The tab bar hides under the keyboard, so its space is given to the list
  // while typing; otherwise only a row or two of results would show.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setTyping(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setTyping(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  // Invited people by name, to mark them in the picker.
  const invitedByName = useMemo(() => {
    const map = new Map<string, InvitationStatus>();
    for (const c of invited ?? []) if (c.invitation_status && !map.has(c.label)) map.set(c.label, c.invitation_status);
    return map;
  }, [invited]);

  const start = async () => {
    setPhase('reading');
    try {
      if (!(await askForContactsAccess())) return setPhase('denied');
      setRaw(await readDeviceContacts());
      setPhase('pick');
    } catch {
      setPhase('intro');
      showDialog("Couldn't read your contacts", 'Please try again.', undefined, { icon: CircleAlert, tone: 'danger' });
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < INVITE_BATCH_MAX) next.add(id);
      return next;
    });

  // By name, email or number (digits only, so "+91 98" finds "+9198...").
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    const digits = q.replace(/\D/g, '');
    // Best matches first: a name starting with the search, or a number ending
    // with the digits typed; then any other match. Stable within each group.
    const rank = (c: DeviceContact): number => {
      const name = c.name.toLowerCase();
      const phone = digits.length >= 3 && c.phone ? c.phone.replace(/\D/g, '') : '';
      if (name.startsWith(q) || (phone && phone.endsWith(digits))) return 0;
      if (name.includes(q) || (!!c.email && c.email.toLowerCase().includes(q)) || (phone && phone.includes(digits))) return 1;
      return 2;
    };
    return contacts
      .map((c) => ({ c, r: rank(c) }))
      .filter((x) => x.r < 2)
      .sort((x, y) => x.r - y.r)
      .map((x) => x.c);
  }, [contacts, search]);

  const pickDialCode = () =>
    showDialog(
      'Country code',
      'Used for numbers saved without one.',
      [
        ...DIAL_CODES.map((d) => ({
          text: `${d.country} (${d.code})`,
          onPress: () => {
            // The same people now have other numbers: a new attempt.
            attempt.current = null;
            setChosenCode(d.code);
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  const dialName = DIAL_CODES.find((d) => d.code === dialCode)?.country ?? '';

  const send = async () => {
    const people = contacts.filter((c) => selected.has(c.id));
    if (!people.length || busy) return;
    if (attempt.current?.signature !== attemptSignature(ventureId, people)) attempt.current = buildInviteAttempt(ventureId, people);
    const a = attempt.current;
    setBusy(true);
    try {
      if (!a.imported) {
        await withRetries((timeoutMs) => coreApi.importContacts(a.importRequest, { idempotencyKey: a.importKey, timeoutMs }));
        a.imported = true;
      }
      const batch = await withRetries((timeoutMs) => coreApi.createInviteBatch(a.batch, { idempotencyKey: a.batchKey, timeoutMs }));
      setLinks(batch.invitations.map((i) => ({ link_id: i.link_id, invitation_id: i.invitation_id, name: a.names[i.link_id] ?? '', url: inviteUrl(i.token), status: 'APPROVED' })));
      setBatchId(batch.batch_id);
      attempt.current = null;
      setSelected(new Set());
      setPhase('done');
    } catch (e) {
      const problem = inviteProblem(e);
      if (problem.restart) attempt.current = null;
      const line = safeLogLine('Send invitations', e);
      if (line) console.warn(line);
      showDialog("Couldn't send invitations", problem.message, undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const share = (link: Link) => {
    Share.share({ message: inviteMessage(link.url) }).catch(() => undefined);
  };

  // A new link for someone already invited: the old link stops working.
  const resend = async (person: ImportedContact) => {
    const invitationId = person.invitation_id;
    if (!invitationId || resending) return;
    const key = (resendKeys.current[invitationId] ??= newIdempotencyKey());
    setResending(invitationId);
    try {
      const sent = await withRetries((timeoutMs) => coreApi.resendInvitation(invitationId, INVITE_VALID_DAYS, { idempotencyKey: key, timeoutMs }));
      delete resendKeys.current[invitationId];
      loadInvited();
      share({ link_id: sent.link_id, invitation_id: sent.invitation_id, name: person.label, url: inviteUrl(sent.token) });
    } catch (e) {
      const line = safeLogLine('Resend invitation', e);
      if (line) console.warn(line);
      showDialog("Couldn't send it again", resendProblem(e), undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setResending(null);
    }
  };

  // Withdraw: the link stops working and it leaves their inbox.
  const withdraw = async (person: Person) => {
    const invitationId = person.invitation_id;
    if (!invitationId || working) return;
    const keyName = `withdraw:${invitationId}`;
    const key = (actionKeys.current[keyName] ??= newIdempotencyKey());
    setWorking(person.link_id);
    try {
      await withRetries((timeoutMs) => coreApi.revokeInvitation(invitationId, { idempotencyKey: key, timeoutMs }));
      delete actionKeys.current[keyName];
      setLinks((prev) => prev.map((l) => (l.link_id === person.link_id ? { ...l, status: 'REVOKED' } : l)));
    } catch (e) {
      const line = safeLogLine('Withdraw invitation', e);
      if (line) console.warn(line);
      showDialog("Couldn't withdraw it", withdrawProblem(e), undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setWorking(null);
      loadInvited();
      loadBatch();
    }
  };

  // Remove: deletes the contact from Ol-ga for good.
  const remove = async (person: Person) => {
    if (working) return;
    const keyName = `remove:${person.link_id}`;
    const key = (actionKeys.current[keyName] ??= newIdempotencyKey());
    setWorking(person.link_id);
    try {
      await withRetries((timeoutMs) => coreApi.removeContact(person.link_id, { idempotencyKey: key, timeoutMs }));
      delete actionKeys.current[keyName];
      setLinks((prev) => prev.filter((l) => l.link_id !== person.link_id));
      setInvited((prev) => prev?.filter((c) => c.link_id !== person.link_id) ?? prev);
    } catch (e) {
      const line = safeLogLine('Remove contact', e);
      if (line) console.warn(line);
      showDialog("Couldn't remove them", removeProblem(e), undefined, { icon: CircleAlert, tone: 'danger' });
    } finally {
      setWorking(null);
      loadInvited();
    }
  };

  const confirmRemove = (person: Person) =>
    showDialog(
      `Remove ${person.name || 'this contact'}?`,
      'This permanently deletes them from Ol-ga, including their invitation and scores. Any chat you already have with them stays.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove(person) },
      ],
      { icon: Trash2, tone: 'danger' },
    );

  const manage = (person: Person) =>
    showDialog(person.name || 'Contact', undefined, [
      ...(canWithdraw(person.status) ? [{ text: 'Withdraw invite', onPress: () => withdraw(person) }] : []),
      { text: 'Remove contact', style: 'destructive' as const, onPress: () => confirmRemove(person) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const moreButton = (person: Person) => (
    <Pressable
      onPress={() => manage(person)}
      disabled={!!working}
      hitSlop={10}
      style={styles.more}
      accessibilityRole="button"
      accessibilityLabel={`More for ${person.name}`}
    >
      <Ellipsis size={20} color={working === person.link_id ? colors.line : colors.muted} />
    </Pressable>
  );

  const sentList =
    invited && invited.length > 0 ? (
      <>
        <Text style={styles.section}>Sent invitations</Text>
        {invited.map((p) => (
          <Card key={p.link_id}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.label}
                </Text>
                <Text style={styles.note}>{p.invitation_status ? INVITE_STATUS_LABEL[p.invitation_status] : 'Not invited'}</Text>
              </View>
              {canResend(p.invitation_status) && (
                <Button label="Resend" small variant="secondary" loading={resending === p.invitation_id} onPress={() => resend(p)} />
              )}
              {moreButton({ link_id: p.link_id, invitation_id: p.invitation_id, name: p.label, status: p.invitation_status })}
            </View>
          </Card>
        ))}
        <Text style={styles.note}>Resending makes a new link. The old one stops working.</Text>
      </>
    ) : null;

  const header = <BackHeader onBack={() => navigation.goBack()} title="Invite people" />;

  if (phase === 'intro' || phase === 'reading') {
    return (
      <Screen>
        {header}
        <Card>
          <Text style={styles.title}>Invite people you know</Text>
          {/* Placeholder wording: to be confirmed by Ol-ga before release. */}
          <Text style={styles.body}>
            To invite people, Ol-ga needs to read your contacts. Only the people you pick, up to {INVITE_BATCH_MAX} at a time, are sent to Ol-ga, with their
            name and their email or phone number. Ol-ga keeps them for {CONTACT_RETENTION_DAYS} days to show how well each person fits your business.
          </Text>
        </Card>
        <Button label="Continue" loading={phase === 'reading'} onPress={start} />
        {sentList}
      </Screen>
    );
  }

  if (phase === 'denied') {
    return (
      <Screen>
        {header}
        <Card>
          <Text style={styles.title}>Contacts are turned off</Text>
          <Text style={styles.body}>Ol-ga can't see your contacts. You can allow it in your phone's settings, then come back.</Text>
        </Card>
        <Button label="Open settings" onPress={() => openPhoneSettings()} />
      </Screen>
    );
  }

  if (phase === 'done') {
    return (
      <Screen>
        {header}
        <Text style={styles.lead}>
          {links.length > 0 ? 'Your invitations are ready. Send each link to the person it is for.' : 'No invitations left to send.'}
        </Text>
        {links.map((l) => (
          <Card key={l.link_id}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>
                  {l.name}
                </Text>
                {l.status && <Text style={styles.note}>{INVITE_STATUS_LABEL[l.status]}</Text>}
              </View>
              {l.status !== 'REVOKED' && <Button label="Share" small onPress={() => share(l)} />}
              {moreButton({ link_id: l.link_id, invitation_id: l.invitation_id, name: l.name, status: l.status })}
            </View>
          </Card>
        ))}
        {links.length > 0 && <Text style={styles.note}>The links are shown only here. If you leave this screen, use Resend to make a new one.</Text>}
        <Button label="Done" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={typing ? styles.typing : undefined}>
      {header}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, email or number"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCorrect={false}
        accessibilityLabel="Search your contacts"
      />
      <Text style={styles.note}>
        {contacts.length === 0
          ? 'No contacts with an email or a phone number with its country code were found.'
          : `Pick up to ${INVITE_BATCH_MAX} people. ${selected.size} picked.`}
      </Text>
      <Pressable onPress={pickDialCode} accessibilityRole="button" accessibilityLabel={`Country code for numbers without one: ${dialName} ${dialCode}. Change`}>
        <Text style={styles.note}>
          Numbers without a country code use {dialCode} ({dialName}). <Text style={styles.link}>Change</Text>
        </Text>
      </Pressable>
      <FlatList
        style={styles.flex}
        data={shown}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = selected.has(item.id);
          const already = invitedByName.get(item.name);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              style={styles.person}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item.name}
            >
              <View style={[styles.box, on && styles.boxOn]}>{on && <Check size={14} color={colors.surface} strokeWidth={3} />}</View>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.note} numberOfLines={1}>
                  {already
                    ? `Already invited · ${INVITE_STATUS_LABEL[already]}`
                    : item.email ?? (item.phone ? `${maskPhone(item.phone)}${item.assumedCode ? ` · ${dialCode} added` : ''}` : '')}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      {/* Hidden while typing so the results get the room; back when the keyboard closes. */}
      {!typing && (
        <Button
          label={selected.size ? `Invite ${selected.size} ${selected.size === 1 ? 'person' : 'people'}` : 'Pick people to invite'}
          loading={busy}
          disabled={selected.size === 0}
          onPress={send}
        />
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    link: { color: colors.brand, fontWeight: semibold },
    typing: { paddingBottom: 12 },
    section: { fontSize: 14, fontWeight: semibold, color: colors.text, marginTop: 8 },
    lead: { fontSize: 14, lineHeight: 20, color: colors.text },
    title: { fontSize: 16, fontWeight: semibold, color: colors.text, marginBottom: 6 },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
    note: { fontSize: 12, lineHeight: 17, color: colors.muted },
    name: { fontSize: 15, fontWeight: semibold, color: colors.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    more: { paddingVertical: 8, paddingLeft: 4 },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
    boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  });

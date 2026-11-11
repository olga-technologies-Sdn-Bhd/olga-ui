import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, CircleAlert } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { withRetries } from '../../api/client';
import { coreApi } from '../../api/core';
import { maskPhone } from '../../auth/phone';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { showDialog } from '../../components/DialogHost';
import { Screen } from '../../components/Screen';
import { HomeStackParamList } from '../../navigation/types';
import { attemptSignature, buildInviteAttempt, CONTACT_RETENTION_DAYS, DeviceContact, INVITE_BATCH_MAX, InviteAttempt } from '../../sci/contacts';
import { askForContactsAccess, openPhoneSettings, readDeviceContacts } from '../../sci/deviceContacts';
import { inviteMessage, inviteProblem } from '../../sci/invitations';
import { inviteUrl } from '../../sci/inviteLink';
import { safeLogLine } from '../../sci/problems';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { semibold } from '../../theme/typography';

type Props = NativeStackScreenProps<HomeStackParamList, 'Invite'>;

type Phase = 'intro' | 'reading' | 'denied' | 'pick' | 'done';
type Link = { link_id: string; name: string; url: string };

// Invite people the member knows: they pick up to 20 contacts, Ol-ga imports
// those people and makes an invitation link for each, and the member sends each
// link themselves. Contact details stay in memory and are never logged.
export function InviteScreen({ navigation, route }: Props) {
  const { ventureId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  // The same people picked again reuse the same IDs and keys (a retry of one
  // action); a different pick is a new action.
  const attempt = useRef<InviteAttempt | null>(null);

  const start = async () => {
    setPhase('reading');
    try {
      if (!(await askForContactsAccess())) return setPhase('denied');
      setContacts(await readDeviceContacts());
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

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts;
  }, [contacts, search]);

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
      setLinks(batch.invitations.map((i) => ({ link_id: i.link_id, name: a.names[i.link_id] ?? '', url: inviteUrl(i.token) })));
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
        <Text style={styles.lead}>Your invitations are ready. Send each link to the person it is for.</Text>
        {links.map((l) => (
          <Card key={l.link_id}>
            <View style={styles.row}>
              <Text style={[styles.name, styles.flex]} numberOfLines={1}>
                {l.name}
              </Text>
              <Button label="Share" small onPress={() => share(l)} />
            </View>
          </Card>
        ))}
        <Text style={styles.note}>The links are shown only here. If you leave this screen, you will need to make new ones.</Text>
        <Button label="Done" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      {header}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search your contacts"
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
      <FlatList
        style={styles.flex}
        data={shown}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = selected.has(item.id);
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
                  {item.email ?? (item.phone ? maskPhone(item.phone) : '')}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      <Button
        label={selected.size ? `Invite ${selected.size} ${selected.size === 1 ? 'person' : 'people'}` : 'Pick people to invite'}
        loading={busy}
        disabled={selected.size === 0}
        onPress={send}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    lead: { fontSize: 14, lineHeight: 20, color: colors.text },
    title: { fontSize: 16, fontWeight: semibold, color: colors.text, marginBottom: 6 },
    body: { fontSize: 13, lineHeight: 19, color: colors.text },
    note: { fontSize: 12, lineHeight: 17, color: colors.muted },
    name: { fontSize: 15, fontWeight: semibold, color: colors.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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

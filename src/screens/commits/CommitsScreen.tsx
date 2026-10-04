import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { newIdempotencyKey } from '../../api/client';
import { coreApi } from '../../api/core';
import type { IncomingCommit, Meeting, OutgoingCommit } from '../../api/types';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { Silhouette } from '../../components/Silhouette';
import { useLive } from '../../context/LiveContext';
import { CommitsStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { commitErrorMessage, expiresIn, planLine, roleLabel, WHEN_LABELS, whereLabel } from '../../utils/commitText';
import { getInitials } from '../../utils/initials';

type Props = NativeStackScreenProps<CommitsStackParamList, 'Commits'>;

// Incoming Commits have no push yet, so refresh while the screen is open.
const REFRESH_MS = 15000;

const STATUS_LABELS: Record<OutgoingCommit['status'], string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
};

function formatTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Board 10 without the chat itself (not Phase 1): "Commits for you" above,
// answered with Accept or Decline; meetings below, only after Accept.
export function CommitsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { filters } = useLive();
  const [incoming, setIncoming] = useState<IncomingCommit[] | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingCommit[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  // One key per answer, reused if that same answer is retried.
  const answerKeys = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [inc, out, meet] = await Promise.all([
        coreApi.getIncomingCommits(),
        coreApi.getOutgoingCommits(),
        coreApi.getMeetings().catch(() => null),
      ]);
      setIncoming(inc);
      setOutgoing(out);
      if (meet) setMeetings(meet.items.filter((m) => m.plan));
      setLoadError(null);
    } catch (e) {
      setLoadError(commitErrorMessage(e, "Couldn't load your Commits"));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') load();
      }, REFRESH_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  function keyFor(requestId: string, decision: string) {
    const k = `${requestId}:${decision}`;
    answerKeys.current[k] ??= newIdempotencyKey();
    return answerKeys.current[k];
  }

  async function accept(commit: IncomingCommit) {
    setBusy(commit.request_id);
    setRowErrors(({ [commit.request_id]: _, ...rest }) => rest);
    try {
      const result = await coreApi.acceptCommit(commit.request_id, { idempotencyKey: keyFor(commit.request_id, 'ACCEPT') });
      setIncoming((list) => (list ?? []).filter((c) => c.request_id !== commit.request_id));
      navigation.navigate('Meetup', {
        name: result.display_name,
        headline: commit.sender.headline,
        where: commit.plan.where,
        when: commit.plan.when,
        eventName: commit.event.name,
        picker: 'you', // "Their choice" means the receiver picks
      });
      load();
    } catch (e) {
      setRowErrors((r) => ({ ...r, [commit.request_id]: commitErrorMessage(e, "Couldn't accept") }));
      load();
    } finally {
      setBusy(null);
    }
  }

  async function decline(commit: IncomingCommit) {
    setBusy(commit.request_id);
    setRowErrors(({ [commit.request_id]: _, ...rest }) => rest);
    try {
      await coreApi.declineCommit(commit.request_id, { idempotencyKey: keyFor(commit.request_id, 'DECLINE') });
      setIncoming((list) => (list ?? []).filter((c) => c.request_id !== commit.request_id));
      setNotice("Declined. They won't be told.");
    } catch (e) {
      setRowErrors((r) => ({ ...r, [commit.request_id]: commitErrorMessage(e, "Couldn't decline") }));
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen onRefresh={load}>
      <View>
        <Text style={styles.eyebrow}>Chat</Text>
        <Text style={styles.h2}>Chat</Text>
        <Pressable
          onPress={() => navigation.getParent()?.navigate('GoLiveTab', { screen: 'Filters' })}
          accessibilityRole="link"
          style={styles.filterLine}
        >
          <Text style={styles.sub}>
            Requests filtered to {filters.minMatch}%+ · <Text style={styles.link}>Change</Text>
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Commits for you{incoming ? ` · ${incoming.length}` : ''}</Text>
      {incoming === null && !loadError && <ActivityIndicator color={colors.brand} />}
      {loadError && <Text style={styles.error}>{loadError}</Text>}
      {notice && <Text style={styles.sub}>{notice}</Text>}
      {incoming?.length === 0 && (
        <Card>
          <Text style={styles.sub}>No Commits right now. When someone in your room commits to meeting you, it shows here.</Text>
        </Card>
      )}

      {incoming?.map((c) => (
        <Card key={c.request_id}>
          <View style={styles.row}>
            <Silhouette />
            <View style={styles.flex}>
              <Text style={styles.h3}>{c.sender.headline || 'Attendee'}</Text>
              {c.sender.role_category && <Text style={styles.sub}>{roleLabel(c.sender.role_category)}</Text>}
            </View>
            {typeof c.sender.score === 'number' && <Pill label={`${Math.round(c.sender.score * 100)}%`} tone="positive" />}
          </View>
          <View style={styles.tags}>
            <Pill label={whereLabel(c.plan.where)} tone="active" />
            <Pill label={WHEN_LABELS[c.plan.when] ?? c.plan.when} tone="active" />
          </View>
          <Text style={styles.small}>
            {c.event.name} · Expires when the room closes ({expiresIn(c.expires_at).toLowerCase()})
          </Text>
          <View style={styles.actions}>
            <Button label="Accept" variant="charcoal" small style={styles.flex} loading={busy === c.request_id} disabled={busy !== null} onPress={() => accept(c)} />
            <Button label="Decline" variant="secondary" small style={styles.flex} disabled={busy !== null} onPress={() => decline(c)} />
          </View>
          {rowErrors[c.request_id] && <Text style={styles.error}>{rowErrors[c.request_id]}</Text>}
          <Text style={styles.small}>Accept reveals both names at the same moment. Decline is silent: they're never told.</Text>
        </Card>
      ))}

      {meetings.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Meeting</Text>
          {meetings.map((m) => (
            <Pressable
              key={m.conversation_id}
              accessibilityRole="button"
              onPress={() =>
                m.plan &&
                navigation.navigate('Meetup', { name: m.display_name, headline: m.headline, where: m.plan.where, when: m.plan.when })
              }
            >
              <Card style={styles.row}>
                <Avatar initials={m.display_name ? getInitials(m.display_name) : '?'} />
                <View style={styles.flex}>
                  <Text style={styles.h3}>{m.display_name ?? 'Your meeting'}</Text>
                  {m.headline && <Text style={styles.sub}>{m.headline}</Text>}
                  {m.plan && (
                    <View style={styles.planRow}>
                      <Check size={14} color={colors.positive} strokeWidth={2.6} />
                      <Text style={styles.planText}>{planLine(m.plan)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.small}>{formatTime(m.last_activity_at)}</Text>
              </Card>
            </Pressable>
          ))}
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Sent</Text>
          {outgoing.map((o) => {
            const accepted = o.status === 'ACCEPTED';
            return (
              <Pressable
                key={o.request_id}
                disabled={!accepted}
                onPress={() =>
                  navigation.navigate('Meetup', {
                    name: o.recipient.display_name,
                    headline: o.recipient.headline,
                    where: o.plan.where,
                    when: o.plan.when,
                    eventName: o.event.name,
                    picker: 'them',
                  })
                }
              >
                <Card style={styles.row}>
                  {accepted && o.recipient.display_name ? <Avatar initials={getInitials(o.recipient.display_name)} /> : <Silhouette />}
                  <View style={styles.flex}>
                    {/* The name appears only once they accept. */}
                    <Text style={styles.h3}>{accepted && o.recipient.display_name ? o.recipient.display_name : o.recipient.headline || 'Attendee'}</Text>
                    {accepted && o.recipient.headline && <Text style={styles.sub}>{o.recipient.headline}</Text>}
                    <Text style={styles.small}>{planLine(o.plan)}</Text>
                  </View>
                  <Pill label={STATUS_LABELS[o.status]} tone={accepted ? 'positive' : 'default'} />
                </Card>
              </Pressable>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
    h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
    sub: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    small: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 8 },
    link: { color: colors.text, fontWeight: '700', textDecorationLine: 'underline' },
    filterLine: { alignSelf: 'flex-start', marginTop: 2 },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 10 },
    error: { fontSize: 13, color: colors.danger, marginTop: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    planRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    planText: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: colors.positive },
  });

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError, newIdempotencyKey } from '../../api/client';
import { coreApi } from '../../api/core';
import type { CommitQuota, CommitWhen, MeetingSpot } from '../../api/types';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { commitErrorMessage, THEIR_CHOICE_LABEL, WHEN_LABELS } from '../../utils/commitText';
import { MatchSummary } from './LiveMatchesScreen';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'Commit'>;

const WHEN_ORDER: CommitWhen[] = ['NOW', 'IN_10_MIN', 'NEXT_BREAK', 'AFTER_SESSION'];
const THEIR_CHOICE = 'THEIR_CHOICE';

function formatTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Board 16. A commitment to a short meeting here, while both are in the room.
// Not a connection request. Five per person per room; expires when the room
// closes; the receiver sees role, intent, score and plan, never the name.
export function CommitScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { activeEvent, matches, committedIds, markCommitted } = useLive();
  const { memberId } = route.params;
  const card = matches?.find((m) => m.match.member_id === memberId);
  const eventId = activeEvent?.eventId;
  const [spots, setSpots] = useState<MeetingSpot[]>([]);
  const [quota, setQuota] = useState<CommitQuota | null>(null);
  const [where, setWhere] = useState(THEIR_CHOICE);
  const [when, setWhen] = useState<CommitWhen>('IN_10_MIN');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notLive, setNotLive] = useState(false);
  const [sent, setSent] = useState(committedIds.includes(memberId));
  // One key per Commit: reused if the same send is retried.
  const sendKey = useRef(newIdempotencyKey());

  useEffect(() => {
    if (!eventId) return;
    coreApi.getMeetingSpots(eventId).then(setSpots).catch(() => setSpots([]));
    coreApi.getCommitQuota(eventId).then(setQuota).catch(() => {});
  }, [eventId]);

  async function send() {
    if (!eventId) return;
    setSending(true);
    setError(null);
    setNotLive(false);
    try {
      const result = await coreApi.sendCommit(
        {
          recipient_member_id: memberId,
          context_id: eventId,
          ...(card?.match.match_result_id != null ? { match_result_id: card.match.match_result_id } : {}),
          plan: { where: where === THEIR_CHOICE ? { type: 'THEIR_CHOICE' } : { type: 'SPOT', spot_id: where }, when },
        },
        { idempotencyKey: sendKey.current }
      );
      setQuota((q) => ({ limit: q?.limit ?? 5, used: (q?.limit ?? 5) - result.commits_remaining, remaining: result.commits_remaining }));
      markCommitted(memberId);
      setSent(true);
    } catch (e) {
      if (__DEV__ && e instanceof ApiError) console.warn(`Send commit failed (${e.code}), correlation_id=${e.correlationId ?? 'none'}`);
      if (e instanceof ApiError && e.code === 'COMMIT_ALREADY_SENT') {
        markCommitted(memberId);
        setSent(true);
      }
      if (e instanceof ApiError && e.code === 'COMMIT_SENDER_NOT_LIVE') setNotLive(true);
      if (e instanceof ApiError && e.code === 'COMMIT_LIMIT_REACHED') setQuota((q) => (q ? { ...q, used: q.limit, remaining: 0 } : q));
      // A failed send that reached the server won't be replayed: next try is a new Commit.
      if (e instanceof ApiError && e.status > 0) sendKey.current = newIdempotencyKey();
      setError(commitErrorMessage(e, "Couldn't send your Commit"));
    } finally {
      setSending(false);
    }
  }

  const limit = quota?.limit ?? 5;
  const remaining = quota?.remaining;
  const noneLeft = remaining === 0;
  const sendLabel =
    remaining === undefined ? 'Send commit' : noneLeft ? 'No Commits left in this room' : `Send commit · ${remaining} of ${limit} left in this room`;

  return (
    <Screen>
      <View style={styles.header}>
        <BackHeader onBack={() => navigation.goBack()} />
        <Text style={styles.eyebrow} numberOfLines={1}>
          {activeEvent?.name ?? ''}
        </Text>
      </View>
      <View>
        <Text style={styles.h2}>Commit</Text>
        <Text style={styles.sub}>Not a connection request. A commitment to a short meeting, here, while you're both in the room.</Text>
      </View>

      {card ? (
        <Card>
          <MatchSummary card={card} />
        </Card>
      ) : (
        <Text style={styles.sub}>This match is no longer available.</Text>
      )}

      {sent ? (
        <View style={styles.consequence}>
          <Text style={styles.h3}>Commit sent</Text>
          <Text style={styles.consequenceText}>
            If they accept, you both see names at once. If not, nothing happens and you're never told.
            {activeEvent ? ` It disappears at ${formatTime(activeEvent.endsAt)} with the room.` : ''}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Where</Text>
          <View style={styles.tags}>
            {spots.map((s) => (
              <Pill key={s.spot_id} label={s.label} tone={where === s.spot_id ? 'active' : 'default'} onPress={() => setWhere(s.spot_id)} />
            ))}
            <Pill label={THEIR_CHOICE_LABEL} tone={where === THEIR_CHOICE ? 'active' : 'default'} onPress={() => setWhere(THEIR_CHOICE)} />
          </View>

          <Text style={styles.sectionTitle}>When</Text>
          <View style={styles.tags}>
            {WHEN_ORDER.map((w) => (
              <Pill key={w} label={WHEN_LABELS[w]} tone={when === w ? 'active' : 'default'} onPress={() => setWhen(w)} />
            ))}
          </View>

          <View style={styles.consequence}>
            <Text style={styles.consequenceText}>
              They see your role, intent and this plan. Not your name. If they <Text style={styles.bold}>accept</Text>, you
              both see names at once. If not, nothing happens and you're never told.
              {activeEvent ? ` The request disappears at ${formatTime(activeEvent.endsAt)} with the room.` : ''}
            </Text>
          </View>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {notLive && (
        <Button label="Go Live" variant="secondary" onPress={() => navigation.navigate('GoLive')} />
      )}

      {sent ? (
        <Button label="Back to your matches" variant="secondary" onPress={() => navigation.goBack()} />
      ) : (
        <Button
          label={sendLabel}
          variant="charcoal"
          loading={sending}
          disabled={!card || !eventId || noneLeft}
          onPress={send}
        />
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eyebrow: { flex: 1, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text },
    h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    sub: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 4 },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 6 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    consequence: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14, marginTop: 6 },
    consequenceText: { fontSize: 13, lineHeight: 19, color: colors.text },
    bold: { fontWeight: '800' },
    error: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  });

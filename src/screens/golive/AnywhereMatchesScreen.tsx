import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError, newIdempotencyKey } from '../../api/client';
import { coreApi } from '../../api/core';
import { MatchCard } from '../../api/matching';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { ReportMemberLink, ReportMemberSheet } from '../../components/ReportMemberSheet';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { commitErrorMessage } from '../../utils/commitText';
import { haptics } from '../../utils/haptics';
import { MatchSummary } from './LiveMatchesScreen';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'AnywhereMatches'>;

// Connect: a plain connection request (not a Commit, which is event-only).
type Sent = { state: 'sending' } | { state: 'sent' } | { state: 'error'; message: string };

// Requests sent from this phone this session (per signed-in member, by
// recipient), so a card keeps "Request sent" when the list is reopened.
// A second send returns the pending one, never a duplicate.
const sentThisSession = new Map<string, Map<string, Sent>>();
const sentBy = (memberId: string | null) => {
  const key = memberId ?? '';
  if (!sentThisSession.has(key)) sentThisSession.set(key, new Map());
  return sentThisSession.get(key)!;
};

// Go Live > Anywhere: the people found, strongest first. The same cards as
// at an event (LiveMatches); Connect instead of Commit, since there's no
// room or meeting spot.
export function AnywhereMatchesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { memberId } = useAuth();
  const { generalMatches } = useLive();
  const [sent, setSent] = useState<Record<string, Sent>>(() => Object.fromEntries(sentBy(memberId)));
  const [reporting, setReporting] = useState<MatchCard | null>(null);
  const connectKeys = useRef<Record<string, string>>({});
  const shown = generalMatches ?? [];

  function mark(id: string, value: Sent) {
    sentBy(memberId).set(id, value);
    setSent((s) => ({ ...s, [id]: value }));
  }

  async function connect(card: MatchCard) {
    const id = card.match.member_id;
    if (sent[id]?.state === 'sending' || sent[id]?.state === 'sent') return;
    mark(id, { state: 'sending' });
    connectKeys.current[id] ??= newIdempotencyKey();
    try {
      await coreApi.sendConnectionRequest(
        { recipient_member_id: id, ...(card.match.match_result_id ? { match_result_id: card.match.match_result_id } : {}) },
        { idempotencyKey: connectKeys.current[id] }
      );
      haptics.success();
      mark(id, { state: 'sent' });
    } catch (e) {
      // Connected meanwhile: the next search leaves them out.
      if (e instanceof ApiError && e.code === 'CONNECTION_EXISTS') mark(id, { state: 'sent' });
      else mark(id, { state: 'error', message: commitErrorMessage(e, "Couldn't send your request") });
    }
  }

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} right={<Pill label="● ANYWHERE" tone="positive" />} />
      <View>
        <Text style={styles.eyebrow}>Anywhere</Text>
        <Text style={styles.h2}>Relevant people</Text>
      </View>

      {shown.length === 0 && (
        <Card>
          <Text style={styles.sub}>No matches yet. Try making what you’re looking for more specific: the role, the industry and the market.</Text>
        </Card>
      )}

      {shown.map((card) => {
        const s = sent[card.match.member_id];
        return (
          <Card key={card.match.member_id}>
            <MatchSummary card={card} />
            <View style={styles.actions}>
              <Button
                label={s?.state === 'sent' ? 'Request sent' : 'Connect'}
                variant="charcoal"
                small
                style={styles.flex}
                loading={s?.state === 'sending'}
                disabled={s?.state === 'sent'}
                onPress={() => connect(card)}
              />
            </View>
            {s?.state === 'error' && <Text style={styles.error}>{s.message}</Text>}
            <ReportMemberLink onPress={() => setReporting(card)} />
          </Card>
        );
      })}

      {shown.length > 0 && <Text style={styles.footer}>Names stay hidden until they accept.</Text>}

      <ReportMemberSheet
        visible={reporting !== null}
        onClose={() => setReporting(null)}
        target={{ memberId: reporting?.match.member_id ?? '' }}
        who={reporting?.profile?.headline}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: semibold },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: semibold, color: colors.text, marginTop: 4 },
    sub: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    error: { fontSize: 12, color: colors.danger, marginTop: 6 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    footer: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  });

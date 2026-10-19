import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { ReportMemberLink, ReportMemberSheet } from '../../components/ReportMemberSheet';
import { useNearby } from '../../context/NearbyContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { NearbyPersonSummary } from './NearbyPeopleScreen';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'NearbyCommit'>;


// A Commit to someone nearby. It goes straight to their phone over Bluetooth
// (no internet needed) and is saved to Ol-ga once either of you is online.
export function NearbyCommitScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { people, requests, sendCommit } = useNearby();
  const { memberId } = route.params;
  const person = people.find((p) => p.card.m === memberId);
  // Already connected (either way round), or a Commit of yours is waiting: nothing new to send.
  const sent =
    requests.find((r) => r.peer.m === memberId && r.status === 'accepted') ??
    requests.find((r) => r.direction === 'out' && r.peer.m === memberId && r.status === 'pending');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const shown = person ?? (sent ? { card: sent.peer, score: 0, scoreSource: 'estimate' as const } : undefined);

  async function send() {
    setSending(true);
    setError(null);
    const request = await sendCommit(memberId);
    setSending(false);
    if (!request) setError('They’re no longer nearby. Your Commit wasn’t sent.');
  }

  const status = !sent
    ? null
    : sent.status === 'accepted'
      ? sent.direction === 'out'
        ? `${sent.peerName || 'They'} accepted. You're connected.`
        : `You accepted their Commit. You're connected${sent.peerName ? ` with ${sent.peerName}` : ''}.`
      : sent.delivered
        ? 'Delivered to their phone. If they accept, you both see names at once.'
        : 'Sending to their phone…';

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} />
      <View>
        <Text style={styles.h2}>Commit</Text>
        <Text style={styles.sub}>A commitment to a short meeting, here, while you're both nearby.</Text>
      </View>

      {shown ? (
        <Card>
          {person ? <NearbyPersonSummary person={person} /> : <NearbyPersonSummary person={shown} />}
          <ReportMemberLink onPress={() => setReporting(true)} />
        </Card>
      ) : (
        <Text style={styles.sub}>This person is no longer nearby.</Text>
      )}

      {sent ? (
        <View style={styles.consequence}>
          <Text style={styles.h3}>{sent.status === 'accepted' ? 'Connected' : 'Commit sent'}</Text>
          <Text style={styles.consequenceText}>{status}</Text>
          <Text style={styles.small}>
            {sent.sync.outcome === 'already-connected'
              ? 'You were already connected on Ol-ga.'
              : sent.sync.outcome === 'not-allowed'
                ? "Ol-ga couldn't save this one."
                : sent.sync.created
                  ? 'Saved to Ol-ga.'
                  : 'Saved on your phone; Ol-ga gets it when you’re online.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.consequence}>
            <Text style={styles.consequenceText}>
              They see your role and what you're looking for. Not your name. If they <Text style={styles.bold}>accept</Text>, you both see
              names at once. If not, nothing happens and you're never told.
            </Text>
          </View>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {sent ? (
        <Button label="Back to people nearby" variant="secondary" onPress={() => navigation.goBack()} />
      ) : (
        <Button label="Send Commit" variant="charcoal" loading={sending} disabled={!person} onPress={send} />
      )}
      <ReportMemberSheet visible={reporting} onClose={() => setReporting(false)} memberId={memberId} />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: semibold, color: colors.text },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: semibold, color: colors.text, marginBottom: 4 },
    sub: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
    small: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 6 },
    consequence: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14, marginTop: 6 },
    consequenceText: { fontSize: 12, lineHeight: 18, color: colors.text },
    bold: { fontWeight: semibold },
    error: { fontSize: 12, color: colors.danger, textAlign: 'center' },
  });

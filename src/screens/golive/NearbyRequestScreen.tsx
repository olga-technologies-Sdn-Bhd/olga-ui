import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useNearby } from '../../context/NearbyContext';
import { estimateScore } from '../../nearby/score';
import { GoLiveStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { NearbyPersonSummary } from './NearbyPeopleScreen';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'NearbyRequest'>;

// A Commit from someone nearby (or one you've already answered).
export function NearbyRequestScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { requests, respond, people, myCard, banner, dismissBanner } = useNearby();
  const request = requests.find((r) => r.id === route.params.requestId);
  // Already looking at it (opened from the notification or the banner): no banner on top.
  const bannerId = banner?.id;
  useEffect(() => {
    if (bannerId === route.params.requestId) dismissBanner();
  }, [bannerId, route.params.requestId, dismissBanner]);
  const live = request && people.find((p) => p.card.m === request.peer.m);
  const person = live ?? (request && { card: request.peer, score: myCard ? estimateScore(myCard, request.peer) : 0, scoreSource: 'estimate' as const });

  if (!request || !person) {
    return (
      <Screen>
        <BackHeader onBack={() => navigation.goBack()} />
        <Text style={styles.sub}>This Commit is no longer here.</Text>
      </Screen>
    );
  }

  const incoming = request.direction === 'in';
  const title = incoming
    ? request.status === 'pending'
      ? 'Wants to meet you'
      : request.status === 'accepted'
        ? `You're connected${request.peerName ? ` with ${request.peerName}` : ''}`
        : 'You declined'
    : request.status === 'accepted'
      ? `${request.peerName || 'They'} accepted your Commit`
      : 'Commit sent';

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} />
      <View>
        <Text style={styles.eyebrow}>Nearby</Text>
        <Text style={styles.h2}>{title}</Text>
      </View>

      <Card>
        <NearbyPersonSummary person={person} />
      </Card>

      {incoming && request.status === 'pending' ? (
        <>
          <View style={styles.note}>
            <Text style={styles.noteText}>
              They'd like to meet you. If you accept, you both see names at once. If you decline,
              they're never told.
            </Text>
          </View>
          <View style={styles.actions}>
            <Button label="Accept" variant="charcoal" style={styles.flex} onPress={() => respond(request.id, true)} />
            <Button label="Decline" variant="secondary" style={styles.flex} onPress={() => respond(request.id, false)} />
          </View>
        </>
      ) : (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            {request.status === 'accepted'
              ? request.peerName
                ? `You'll find ${request.peerName} in Chat once you're online.`
                : 'Their name appears once one of you is back online.'
              : request.status === 'declined'
                ? "They won't be told."
                : request.delivered
                  ? 'Delivered to their phone. If they accept, you both see names at once.'
                  : 'Waiting to reach their phone. Stay nearby.'}
          </Text>
          <Text style={styles.small}>
            {request.sync.done || request.sync.created || request.sync.decided
              ? request.sync.outcome === 'already-connected'
                ? 'You were already connected on Ol-ga.'
                : request.sync.outcome === 'not-allowed'
                  ? "Ol-ga couldn't save this one."
                  : 'Saved to Ol-ga.'
              : 'Saved on your phone. Syncs when you’re online.'}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
    sub: { fontSize: 12, lineHeight: 18, color: colors.muted },
    small: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 6 },
    note: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14 },
    noteText: { fontSize: 12, lineHeight: 18, color: colors.text },
    actions: { flexDirection: 'row', gap: 10 },
  });

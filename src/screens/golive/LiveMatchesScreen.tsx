import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { MatchCard, MatchingError } from '../../api/matching';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { Silhouette } from '../../components/Silhouette';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'LiveMatches'>;

// Board 09: at most three, strongest first. Never padded with weak matches.
const MAX_SHOWN = 3;

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function topMatches(matches: MatchCard[] | null, passedIds: string[]) {
  return (matches ?? [])
    .filter((m) => !passedIds.includes(m.match.member_id))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, MAX_SHOWN);
}

export function MatchSummary({ card }: { card: MatchCard }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { match, profile } = card;
  return (
    <>
      <View style={styles.row}>
        <Silhouette />
        <View style={styles.flex}>
          <Text style={styles.h3}>{profile?.headline || 'Attendee'}</Text>
          {profile?.role_category && <Text style={styles.sub}>{profile.role_category}</Text>}
        </View>
        <Pill label={`${Math.round(match.score * 100)}%`} tone="positive" />
      </View>
      {!!match.reason_text && <Text style={styles.reason}>{match.reason_text}</Text>}
    </>
  );
}

export function LiveMatchesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { activeEvent, activeUntil, matches, runMatching, passedIds, pass, committedIds } = useLive();
  const [error, setError] = useState<string | null>(null);
  const shown = topMatches(matches, passedIds);

  // Go Live already ran matching; only run it here when there's nothing yet.
  const load = useCallback(async () => {
    if (!activeEvent) return;
    setError(null);
    try {
      const found = await runMatching();
      if (!found.length) navigation.replace('EmptyRoom');
    } catch (e) {
      if (e instanceof MatchingError)
        setError(
          e.reason === 'TIMED_OUT'
            ? 'Still matching. Try again in a moment.'
            : e.reason === 'CONSENT_DENIED'
              ? "Matching is off, so we can't find your matches."
              : "Couldn't find matches right now."
        );
      else setError(e instanceof ApiError && e.status > 0 ? `Couldn't load matches (${e.status})` : "Couldn't reach the server");
    }
  }, [activeEvent, runMatching, navigation]);

  useEffect(() => {
    if (matches === null) load();
    else if (matches.length === 0) navigation.replace('EmptyRoom');
    // Run once on open; later changes come from Go Live / refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <BackHeader
        onBack={() => navigation.goBack()}
        right={activeUntil ? <Pill label={`● LIVE · ${formatTime(activeUntil)}`} tone="positive" /> : undefined}
      />
      <View>
        <Text style={styles.eyebrow}>{activeEvent?.name ?? 'Event'}</Text>
        <Text style={styles.h2}>{shown.length === 3 ? 'Your three' : 'Your matches'}</Text>
      </View>

      {matches === null && !error && <Text style={styles.sub}>Finding people worth meeting…</Text>}
      {error && <Text style={[styles.sub, { color: colors.danger }]}>{error}</Text>}
      {matches !== null && matches.length > 0 && shown.length === 0 && (
        <Card>
          <Text style={styles.sub}>You've passed on everyone for now. New matches appear when someone new goes live.</Text>
        </Card>
      )}

      {shown.map((card) => (
        <Card key={card.match.member_id}>
          <MatchSummary card={card} />
          <View style={styles.actions}>
            <Button
              label={committedIds.includes(card.match.member_id) ? 'Commit sent' : 'Commit'}
              variant="charcoal"
              small
              style={styles.flex}
              onPress={() => navigation.navigate('Commit', { memberId: card.match.member_id })}
            />
            <Button label="Pass" variant="secondary" small style={styles.pass} onPress={() => pass(card.match.member_id)} />
          </View>
        </Card>
      ))}

      {shown.length > 0 && <Text style={styles.footer}>Passing is silent. They're never told.</Text>}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
    h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
    sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
    reason: { fontSize: 13, lineHeight: 19, color: colors.text, marginTop: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    pass: { minWidth: 84 },
    footer: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  });

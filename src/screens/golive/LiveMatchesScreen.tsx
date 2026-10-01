import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { MatchingError } from '../../api/matching';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { getInitials } from '../../utils/initials';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'LiveMatches'>;

export function LiveMatchesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { activeEvent, matches, runMatching } = useLive();
  const [error, setError] = useState<string | null>(null);

  // Go Live already ran matching; only run it here when there's nothing yet.
  const load = useCallback(async () => {
    if (!activeEvent) return;
    setError(null);
    try {
      const found = await runMatching();
      if (!found.length) navigation.replace('EmptyRoom');
    } catch (e) {
      if (e instanceof MatchingError) setError(e.reason === 'TIMED_OUT' ? 'Still matching. Try again in a moment.' : "Couldn't find matches right now.");
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
      <View style={styles.topline}>
        <View>
          <Text style={styles.eyebrow}>{activeEvent?.name ?? 'Event'}</Text>
          <Text style={styles.h2}>Matching you now</Text>
        </View>
        <Pill label="● LIVE" tone="positive" />
      </View>

      {matches === null && !error && <Text style={styles.sub}>Finding people worth meeting…</Text>}
      {error && <Text style={[styles.sub, { color: colors.danger }]}>{error}</Text>}

      {matches?.map(({ match, profile }) => (
        <Card key={match.member_id}>
          <View style={styles.row}>
            <Avatar initials={getInitials(profile?.headline ?? '?')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.h3}>{profile?.headline ?? 'Attendee'}</Text>
              {profile?.role_category && <Text style={styles.sub}>{profile.role_category}</Text>}
            </View>
            <Text style={styles.matchScore}>{Math.round(match.score * 100)}%</Text>
          </View>
          {!!match.reason_text && <Text style={[styles.sub, { marginTop: 10 }]}>{match.reason_text}</Text>}
        </Card>
      ))}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchScore: { fontFamily: fonts.headingExtraBold, fontWeight: '800', color: colors.positive, fontSize: 14 },
});

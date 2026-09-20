import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { MatchCandidate, nlpApi } from '../../api/nlp';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { getInitials } from '../../utils/initials';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'LiveMatches'>;

export function LiveMatchesScreen({ navigation }: Props) {
  const { activeEvent, filters } = useLive();
  const [matches, setMatches] = useState<MatchCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeEvent) return;
    setError(null);
    try {
      const result = await nlpApi.requestMatches({ eventId: activeEvent.eventId, minMatch: filters.minMatch });
      if (!result.matches?.length) {
        navigation.replace('EmptyRoom');
        return;
      }
      setMatches(result.matches);
    } catch (e) {
      setError(e instanceof ApiError ? `Couldn't load matches (${e.status})` : "Couldn't reach the server");
      setMatches([]);
    }
  }, [activeEvent, filters.minMatch, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={styles.topline}>
        <View>
          <Text style={styles.eyebrow}>{activeEvent?.name ?? 'Event'}</Text>
          <Text style={styles.h2}>Matching you now</Text>
        </View>
        <Pill label="● LIVE" tone="green" />
      </View>

      {matches === null && !error && <Text style={styles.sub}>Finding people worth meeting…</Text>}
      {error && <Text style={[styles.sub, { color: colors.danger }]}>{error}</Text>}

      {matches?.map((match) => (
        <Card key={match.memberId}>
          <View style={styles.row}>
            <Avatar initials={getInitials(match.headline ?? '?')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.h3}>{match.headline ?? 'Attendee'}</Text>
              {match.subheadline && <Text style={styles.sub}>{match.subheadline}</Text>}
            </View>
            <Text style={styles.matchScore}>{Math.round(match.matchScore)}%</Text>
          </View>
          {match.rationale && <Text style={[styles.sub, { marginTop: 10 }]}>{match.rationale}</Text>}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  h3: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchScore: { fontWeight: '800', color: colors.green, fontSize: 14 },
});

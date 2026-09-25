import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import { intentIdFor, MatchCandidate, nlpApi } from '../../api/nlp';
import type { Profile } from '../../api/types';
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
  const [matches, setMatches] = useState<{ match: MatchCandidate; profile?: Profile }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeEvent) return;
    setError(null);
    try {
      const result = await nlpApi.requestMatches({
        intent_id: intentIdFor(activeEvent.eventId, 'WANT'),
        context_id: activeEvent.eventId,
        options: { threshold: filters.minMatch / 100 },
      });
      if (!result.matches?.length) {
        navigation.replace('EmptyRoom');
        return;
      }
      // Match results only carry member IDs; the card text comes from each
      // member's profile. A failed lookup falls back to the generic card.
      const profiles = await Promise.all(
        result.matches.map((m) => coreApi.getMember(m.member_id).catch(() => undefined))
      );
      setMatches(result.matches.map((match, i) => ({ match, profile: profiles[i] })));
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't load matches (${e.status})` : "Couldn't reach the server");
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

const styles = StyleSheet.create({
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  h3: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchScore: { fontWeight: '800', color: colors.green, fontSize: 14 },
});

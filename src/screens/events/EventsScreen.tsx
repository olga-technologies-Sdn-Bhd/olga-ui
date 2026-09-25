import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ApiError } from '../../api/client';
import { coreApi, CoreEvent } from '../../api/core';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { useTopInset } from '../../components/Screen';
import { useLive } from '../../context/LiveContext';
import { EventsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { formatEventDate } from '../../utils/formatEventDate';

type Props = NativeStackScreenProps<EventsStackParamList, 'Events'>;

export function EventsScreen({ navigation }: Props) {
  const topInset = useTopInset();
  const { setActiveEvent } = useLive();
  const [events, setEvents] = useState<CoreEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await coreApi.getEvents();
      setEvents(data);
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't load events (${e.status})` : "Couldn't reach the server");
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handleGoLive(event: CoreEvent) {
    setActiveEvent({ eventId: event.event_id, name: event.name, liveCount: event.live_count, matchCount: event.match_count });
    navigation.getParent()?.navigate('GoLiveTab' as never);
  }

  const [featured, ...openForSignUp] = events ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: 20 + topInset }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.topline}>
        <View>
          <Text style={styles.eyebrow}>Discover</Text>
          <Text style={styles.h2}>Events</Text>
        </View>
        <Pill label="Kuala Lumpur" />
      </View>

      {events === null && !error && <Text style={styles.sub}>Loading events…</Text>}
      {error && <Text style={[styles.sub, { color: colors.danger }]}>{error}</Text>}
      {events && events.length === 0 && !error && <Text style={styles.sub}>No upcoming events yet.</Text>}

      {featured && (
        <>
          <Text style={styles.sectionTitle}>You're going</Text>
          <Pressable onPress={() => navigation.navigate('EventDetail', { event: featured })}>
            <Card style={styles.featuredCard}>
              <LinearGradient
                colors={['#ffd2dc', '#ab98ff', '#6b4d91']}
                locations={[0, 0.45, 1]}
                start={{ x: 0.15, y: 0.2 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.eventArt}
              />
              <View style={styles.featuredBody}>
                <View style={styles.eventTop}>
                  <View>
                    <Text style={styles.h3}>{featured.name}</Text>
                    <Text style={styles.sub}>{[featured.venue, formatEventDate(featured.starts_at)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {typeof featured.live_count === 'number' && <Pill label={`${featured.live_count} live`} tone="green" />}
                </View>
                {typeof featured.match_count === 'number' && (
                  <Text style={[styles.sub, { marginTop: 8 }]}>{featured.match_count} attendees match your intent</Text>
                )}
                <Button label="Go Live in this room" style={{ marginTop: 14 }} onPress={() => handleGoLive(featured)} />
              </View>
            </Card>
          </Pressable>
        </>
      )}

      {openForSignUp.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Open for sign-up</Text>
          <View style={{ gap: 10 }}>
            {openForSignUp.map((event, i) => (
              <Card key={event.event_id} style={styles.listRow}>
                <View style={styles.row}>
                  <Avatar initials={String(i + 3).padStart(2, '0')} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.h3}>{event.name}</Text>
                    <Text style={styles.sub}>
                      {[event.venue, event.attendee_count ? `${event.attendee_count} signed up` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {typeof event.match_count === 'number' && (
                      <Text style={styles.match}>{event.match_count} match your intent</Text>
                    )}
                  </View>
                  <Button label="View" variant="ghost" small onPress={() => navigation.navigate('EventDetail', { event })} />
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  h3: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  match: { fontSize: 13, color: colors.green, fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 6 },
  featuredCard: { padding: 0, overflow: 'hidden' },
  eventArt: {
    height: 118,
  },
  featuredBody: { padding: 16 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  listRow: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

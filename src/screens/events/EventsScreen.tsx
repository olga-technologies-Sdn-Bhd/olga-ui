import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { useTopInset } from '../../components/Screen';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { EventsStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { formatEventDate } from '../../utils/formatEventDate';

type Props = NativeStackScreenProps<EventsStackParamList, 'Events'>;

export function EventsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const topInset = useTopInset();
  const { events, error, refresh } = useEvents();
  const [refreshing, setRefreshing] = useState(false);

  // Refetch whenever the screen comes into focus (e.g. back from a register).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const list = events ?? [];

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

      {/* Every published event, registered or not, in one list (soonest first,
          as the API returns them). Registration shows on the row itself; Go Live
          is on the event detail screen. */}
      {list.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Upcoming events</Text>
          <View style={{ gap: 10 }}>
            {list.map((event, i) => (
              <Card key={event.event_id} style={styles.listRow}>
                <View style={styles.row}>
                  <Avatar initials={String(i + 1).padStart(2, '0')} />
                  {/* Rows have a fixed height (listRow) and single-line text, so every row is the same size. */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.h3} numberOfLines={1}>
                      {event.name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {[
                        formatEventDate(event.starts_at),
                        event.venue,
                        typeof event.attendee_count === 'number' ? `${event.attendee_count} signed up` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {isRegistered(event) ? (
                      <Text style={styles.match} numberOfLines={1}>
                        ✓ You're going
                      </Text>
                    ) : (
                      typeof event.match_count === 'number' && (
                        <Text style={styles.match} numberOfLines={1}>
                          {event.match_count} match your intent
                        </Text>
                      )
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  h3: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  match: { fontSize: 13, color: colors.green, fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 6 },
  listRow: { gap: 4, height: 104, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

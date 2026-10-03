import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EventHero } from '../../components/EventHero';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { useLive } from '../../context/LiveContext';
import { EventsStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { formatEventDate } from '../../utils/formatEventDate';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventDetail'>;

export function EventDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { getEvent, isGone, register, refresh, refreshIfStale } = useEvents();
  const { setActiveEvent, intentText } = useLive();
  // Always the latest server data (admins can edit name, times, venue).
  const { eventId } = route.params;
  const event = getEvent(eventId);
  const gone = isGone(eventId);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshIfStale();
    }, [refreshIfStale])
  );

  // Cancelled or unpublished by an admin: the notice comes from EventsContext.
  useEffect(() => {
    if (gone && navigation.canGoBack()) navigation.goBack();
  }, [gone, navigation]);

  if (!event) {
    return (
      <Screen>
        <BackHeader onBack={() => navigation.goBack()} />
        <Text style={styles.sub}>{gone ? 'This event was cancelled.' : 'Loading event…'}</Text>
      </Screen>
    );
  }
  const registered = isRegistered(event);

  async function handleRegister() {
    setRegistering(true);
    setError(null);
    try {
      await register(eventId);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EVENT_NOT_FOUND') {
        setError('This event was cancelled.');
      } else {
        setError(e instanceof ApiError && e.status > 0 ? `Couldn't register (${e.status})` : "Couldn't reach the server");
      }
      if (e instanceof ApiError) console.warn(`Event registration failed (${e.code}), correlation_id=${e.correlationId}`);
    } finally {
      setRegistering(false);
    }
  }

  function handleGoLive() {
    if (!event) return;
    setActiveEvent({
      eventId: event.event_id,
      name: event.name,
      endsAt: event.ends_at,
      liveCount: event.live_count,
      matchCount: event.match_count,
    });
    navigation.getParent()?.navigate('GoLiveTab' as never);
  }

  return (
    <Screen onRefresh={refresh}>
      <BackHeader
        onBack={() => navigation.goBack()}
        right={typeof event.match_count === 'number' ? <Pill label={`${event.match_count} matches`} tone="positive" /> : undefined}
      />

      <EventHero
        minHeight={250}
        topLeft={<Pill label={event.name} tone="positive" />}
        title="The room where useful conversations start."
      >
        <Text style={styles.heroSub}>{[formatEventDate(event.starts_at), event.venue].filter(Boolean).join(' · ')}</Text>
      </EventHero>

      {!!event.description && (
        <>
          <Text style={styles.sectionTitle}>About this event</Text>
          <Card>
            <Text style={styles.description}>{event.description}</Text>
          </Card>
        </>
      )}

      <Text style={styles.sectionTitle}>Your fit</Text>
      <Card soft>
        <Text style={[styles.eyebrowBrand]}>Intent for this event</Text>
        <Text style={styles.intentText}>{intentText}</Text>
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={styles.statRow}>
          <Text style={styles.sub}>Signed up</Text>
          <Text style={styles.statValue}>{event.attendee_count ?? '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.sub}>Match your intent</Text>
          <Text style={[styles.statValue, { color: colors.positive }]}>{event.match_count ?? '—'}</Text>
        </View>
      </Card>

      {error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}

      <View style={{ gap: 10, marginTop: 4 }}>
        {registered && event.live_mode_enabled ? (
          <Button label="Go Live in this room" onPress={handleGoLive} />
        ) : (
          <Button
            label={registered ? "You're signed up" : 'Sign up for this event'}
            onPress={handleRegister}
            loading={registering}
            disabled={registered}
          />
        )}
        <Button label="See who's going" variant="secondary" onPress={() => navigation.navigate('WhosGoing', { eventId })} />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  heroSub: { color: colors.muted, marginTop: 4, fontSize: 13 },
  sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 4 },
  eyebrowBrand: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.brand, fontWeight: '700' },
  intentText: { marginTop: 8, lineHeight: 20, color: colors.text },
  description: { lineHeight: 21, color: colors.text, fontSize: 14 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statValue: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: '800', color: colors.text },
  divider: { height: 1, backgroundColor: colors.line },
  sub: { fontSize: 13, color: colors.muted },
});

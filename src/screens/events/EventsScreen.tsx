import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { CoreEvent } from '../../api/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateBlock } from '../../components/DateBlock';
import { Pill } from '../../components/Pill';
import { useTopInset } from '../../components/Screen';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { EventsStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = NativeStackScreenProps<EventsStackParamList, 'Events'>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isEventLive(event: CoreEvent, now = Date.now()) {
  return new Date(event.starts_at).getTime() <= now && now < new Date(event.ends_at).getTime();
}

// Board 02: date blocks, titles that wrap, and three sections. Match counts
// per card need Core (not in GET /v1/events yet). Built to take other room
// types (venues) in Phase 2: a row only needs a name, times and a venue.
export function EventsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const topInset = useTopInset();
  const { events, error, refresh, refreshIfStale, register } = useEvents();
  const [refreshing, setRefreshing] = useState(false);
  const [signingUp, setSigningUp] = useState<string | null>(null);
  const [signUpError, setSignUpError] = useState<string | null>(null);

  // Refetch whenever the screen comes into focus (e.g. back from a register).
  useFocusEffect(
    useCallback(() => {
      refreshIfStale(); // at most every ~30 s; pull to refresh forces it
    }, [refreshIfStale])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function signUp(eventId: string) {
    setSigningUp(eventId);
    setSignUpError(null);
    try {
      await register(eventId);
    } catch (e) {
      setSignUpError(
        e instanceof ApiError && e.code === 'EVENT_NOT_FOUND'
          ? 'That event was cancelled.'
          : e instanceof ApiError && e.status > 0
            ? `Couldn't sign you up (${e.status})`
            : "Couldn't reach the server"
      );
    } finally {
      setSigningUp(null);
    }
  }

  const now = Date.now();
  const list = events ?? [];
  const past = list.filter((e) => new Date(e.ends_at).getTime() <= now);
  const upcoming = list.filter((e) => new Date(e.ends_at).getTime() > now);
  const going = upcoming.filter(isRegistered);
  const open = upcoming.filter((e) => !isRegistered(e));

  function renderEvent(event: CoreEvent) {
    const registered = isRegistered(event);
    const start = new Date(event.starts_at);
    const live = isEventLive(event, now) && typeof event.live_count === 'number' && event.live_count > 0;
    return (
      <Pressable
        key={event.event_id}
        onPress={() => navigation.navigate('EventDetail', { eventId: event.event_id })}
        accessibilityRole="button"
        accessibilityLabel={event.name}
      >
        <Card style={styles.row}>
          <DateBlock iso={event.starts_at} />
          <View style={styles.flex}>
            <Text style={styles.h3} numberOfLines={2}>
              {event.name}
            </Text>
            <Text style={styles.sub}>{[WEEKDAYS[start.getDay()], event.venue].filter(Boolean).join(' · ')}</Text>
            <View style={styles.stats}>
              {live && <Text style={styles.live}>● {event.live_count} live</Text>}
              {typeof event.attendee_count === 'number' && (
                <Text style={styles.sub}>{event.attendee_count} signed up</Text>
              )}
            </View>
            {registered ? (
              <View style={styles.signedUp}>
                <Check size={14} color={colors.text} strokeWidth={2.6} />
                <Text style={styles.signedUpText}>Signed up</Text>
              </View>
            ) : (
              <Button
                label="Sign up"
                variant="secondary"
                small
                style={styles.signUp}
                loading={signingUp === event.event_id}
                onPress={() => signUp(event.event_id)}
              />
            )}
          </View>
        </Card>
      </Pressable>
    );
  }

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
        <Pill label="All cities" tone="active" />
      </View>

      {events === null && !error && <Text style={styles.sub}>Loading events…</Text>}
      {error && <Text style={[styles.sub, { color: colors.danger }]}>{error}</Text>}
      {signUpError && <Text style={[styles.sub, { color: colors.danger }]}>{signUpError}</Text>}

      {going.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>You're going</Text>
          <View style={styles.list}>{going.map(renderEvent)}</View>
        </>
      )}

      {events !== null && (
        <>
          <Text style={styles.sectionTitle}>Open for sign-up</Text>
          {open.length > 0 ? (
            <View style={styles.list}>{open.map(renderEvent)}</View>
          ) : (
            <Text style={styles.sub}>No other upcoming events right now.</Text>
          )}

          <Text style={styles.sectionTitle}>Past</Text>
          {past.length > 0 ? (
            <View style={styles.list}>{past.map(renderEvent)}</View>
          ) : (
            <Text style={styles.sub}>Events you attend will appear here, with who you met.</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
    topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
    h3: { fontFamily: fonts.headingBold, fontSize: 16, lineHeight: 21, fontWeight: '700', color: colors.text },
    sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 6 },
    list: { gap: 10 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    stats: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 },
    // Green text token, never the green fill colour (board 02).
    live: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: colors.positive, marginTop: 2 },
    signedUp: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    signedUpText: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: colors.text },
    signUp: { alignSelf: 'flex-start', marginTop: 10 },
  });

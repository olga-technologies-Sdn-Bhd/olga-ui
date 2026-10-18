import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronDown } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { CoreEvent } from '../../api/core';
import { Avatar } from '../../components/Avatar';
import { SlidingUnderline } from '../../components/SlidingUnderline';
import { Button } from '../../components/Button';
import { DateBlock } from '../../components/DateBlock';
import { FLOATING_TAB_SPACE, usePullToRefresh, useTopInset } from '../../components/Screen';
import { useAuth } from '../../context/AuthContext';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { EventsStackParamList, MainTabParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';

type Props = CompositeScreenProps<
  NativeStackScreenProps<EventsStackParamList, 'Events'>,
  BottomTabScreenProps<MainTabParamList>
>;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Tab = 'upcoming' | 'past';

export function isEventLive(event: CoreEvent, now = Date.now()) {
  return new Date(event.starts_at).getTime() <= now && now < new Date(event.ends_at).getTime();
}

// Upcoming (Registered, then Open for registration) and Past, as flat rows.
// The location filter lists the venues of the published events. Built to take
// other room types (venues) in Phase 2: a row only needs a name, times and a
// venue.
export function EventsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const topInset = useTopInset();
  const { name } = useAuth();
  const { events, error, refresh, refreshIfStale, register } = useEvents();
  const { refreshing, handleRefresh } = usePullToRefresh(refresh);
  const [tab, setTab] = useState<Tab>('upcoming');
  // null = all locations.
  const [location, setLocation] = useState<string | null>(null);
  const [choosingLocation, setChoosingLocation] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const initial = (name?.trim()[0] ?? '?').toUpperCase();

  // Refetch whenever the screen comes into focus (e.g. back from a register).
  useFocusEffect(
    useCallback(() => {
      refreshIfStale(); // at most every ~30 s; pull to refresh forces it
    }, [refreshIfStale])
  );

  async function handleRegister(eventId: string) {
    setRegistering(eventId);
    setRegisterError(null);
    try {
      await register(eventId);
    } catch (e) {
      setRegisterError(
        e instanceof ApiError && e.code === 'EVENT_NOT_FOUND'
          ? 'That event was cancelled.'
          : e instanceof ApiError && e.status > 0
            ? `Couldn't register you (${e.status})`
            : "Couldn't connect. Try again."
      );
    } finally {
      setRegistering(null);
    }
  }

  const now = Date.now();
  const all = events ?? [];
  const locations = [...new Set(all.map((e) => e.venue?.trim()).filter((v): v is string => Boolean(v)))].sort();
  // A venue can disappear from the list (event unpublished): fall back to all.
  const activeLocation = location && locations.includes(location) ? location : null;
  const list = activeLocation ? all.filter((e) => e.venue?.trim() === activeLocation) : all;
  const upcoming = list.filter((e) => new Date(e.ends_at).getTime() > now);
  // Most recent first.
  const past = list.filter((e) => new Date(e.ends_at).getTime() <= now).reverse();
  const registered = upcoming.filter(isRegistered);
  const open = upcoming.filter((e) => !isRegistered(e));

  function renderEvent(event: CoreEvent) {
    const mine = isRegistered(event);
    const isPast = new Date(event.ends_at).getTime() <= now;
    const start = new Date(event.starts_at);
    const live = isEventLive(event, now) && typeof event.live_count === 'number' && event.live_count > 0;
    const attending =
      typeof event.attendee_count === 'number'
        ? `${event.attendee_count.toLocaleString('en-US')} ${event.attendee_count === 1 ? 'member' : 'members'} ${isPast ? 'attended' : 'attending'}`
        : null;
    return (
      <Pressable
        key={event.event_id}
        style={styles.row}
        onPress={() => navigation.navigate('EventDetail', { eventId: event.event_id })}
        accessibilityRole="button"
        accessibilityLabel={event.name}
      >
        <View style={styles.flex}>
          <Text style={styles.h3} numberOfLines={2}>
            {event.name}
          </Text>
          <Text style={styles.where}>{[WEEKDAYS[start.getDay()], event.venue].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.stat}>
            {mine && !isPast && (
              <Text style={styles.registered}>
                <Check size={13} color={colors.positive} strokeWidth={3} /> Registered
              </Text>
            )}
            {mine && !isPast && (live || attending) ? ' · ' : ''}
            {live && <Text style={styles.live}>● {event.live_count} live</Text>}
            {live && attending ? ' · ' : ''}
            {attending}
          </Text>
          {!mine && !isPast && (
            <Button
              label="Register"
              variant="ghost"
              small
              style={styles.register}
              loading={registering === event.event_id}
              onPress={() => handleRegister(event.event_id)}
            />
          )}
        </View>
        {/* The date sits on the right; the whole row opens the event. */}
        <DateBlock iso={event.starts_at} outlined />
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.top, { paddingTop: 12 + topInset }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Events</Text>
          <Pressable
            style={styles.locationButton}
            onPress={() => setChoosingLocation(true)}
            accessibilityRole="button"
            accessibilityLabel={`Location: ${activeLocation ?? 'All locations'}`}
          >
            <Text style={styles.locationText} numberOfLines={1}>
              {activeLocation ?? 'All locations'}
            </Text>
            <ChevronDown size={16} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('HomeTab', { screen: 'Profile' })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Your account"
          >
            <Avatar initials={initial} size="sm" dark />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {(['upcoming', 'past'] as const).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                style={styles.tab}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{key === 'upcoming' ? 'Upcoming' : 'Past'}</Text>
              </Pressable>
            );
          })}
          <SlidingUnderline count={2} index={tab === 'upcoming' ? 0 : 1} lineWidth={76} color={colors.selected} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {events === null && !error && <Text style={styles.note}>Loading events…</Text>}
        {error && <Text style={[styles.note, styles.error]}>{error}</Text>}
        {registerError && <Text style={[styles.note, styles.error]}>{registerError}</Text>}

        {events !== null && tab === 'upcoming' && (
          <>
            {registered.length > 0 && (
              <>
                <Text style={styles.section}>Registered</Text>
                {registered.map(renderEvent)}
              </>
            )}
            <Text style={styles.section}>Open for registration</Text>
            {open.length > 0 ? open.map(renderEvent) : <Text style={styles.note}>More events are on the way.</Text>}
            <Text style={styles.footnote}>Events you attend move to Past, along with the professionals you met.</Text>
          </>
        )}

        {events !== null && tab === 'past' && (
          <>
            {past.map(renderEvent)}
            {past.length === 0 && <Text style={styles.note}>Events you attend will appear here, with the professionals you met.</Text>}
          </>
        )}
      </ScrollView>

      <Modal visible={choosingLocation} transparent animationType="fade" onRequestClose={() => setChoosingLocation(false)}>
        <Pressable style={styles.backdrop} onPress={() => setChoosingLocation(false)} accessibilityLabel="Close">
          <Pressable style={[styles.menu, { marginTop: 64 + topInset }]}>
            <ScrollView>
              {[null, ...locations].map((option) => {
                const selected = option === activeLocation;
                return (
                  <Pressable
                    key={option ?? 'all'}
                    style={styles.menuRow}
                    onPress={() => {
                      setLocation(option);
                      setChoosingLocation(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.menuText, selected && styles.menuTextActive]}>{option ?? 'All locations'}</Text>
                    {selected && <Check size={16} color={colors.text} strokeWidth={2.6} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.surface },
    top: { borderBottomWidth: 1, borderBottomColor: colors.line },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
    title: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 18, fontWeight: semibold, color: colors.text },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 190,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.brand2,
    },
    locationText: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.text },
    tabs: { flexDirection: 'row', marginTop: 10 },
    tab: { flex: 1, alignItems: 'center', paddingTop: 10, minHeight: 44 },
    tabText: { fontSize: 14, color: colors.muted, paddingBottom: 10 },
    tabTextActive: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: colors.text },
    content: { paddingBottom: FLOATING_TAB_SPACE },
    section: { fontFamily: fonts.bodyBold, fontSize: 17, fontWeight: semibold, color: colors.text, paddingHorizontal: 20, marginTop: 16 },
    // Rows run edge to edge, split by hairlines.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    register: { alignSelf: 'flex-start', marginTop: 8 },
    h3: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, fontWeight: semibold, color: colors.text },
    where: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    stat: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 2 },
    // Green text token, never the green fill colour.
    registered: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: colors.positive },
    live: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: colors.positive },
    note: { fontSize: 13, color: colors.muted, paddingHorizontal: 20, paddingVertical: 14 },
    error: { color: colors.danger },
    footnote: { fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 20, paddingTop: 16 },
    backdrop: { flex: 1, backgroundColor: 'rgba(23,19,16,0.25)', alignItems: 'flex-end', paddingHorizontal: 20 },
    menu: {
      minWidth: 220,
      maxWidth: 300,
      maxHeight: 360,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      paddingVertical: 6,
    },
    menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, paddingHorizontal: 16 },
    menuText: { flexShrink: 1, fontSize: 14, color: colors.text },
    menuTextActive: { fontFamily: fonts.bodyBold, fontWeight: semibold },
  });

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Lock } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import type { EventAttendeesResponse } from '../../api/types';
import { Button } from '../../components/Button';
import { BackHeader } from '../../components/BackHeader';
import { Screen } from '../../components/Screen';
import { Silhouette } from '../../components/Silhouette';
import { useEvents } from '../../context/EventsContext';
import { EventsStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = NativeStackScreenProps<EventsStackParamList, 'WhosGoing'>;

const TOP = 5;

export function WhosGoingScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { getEvent } = useEvents();
  const event = getEvent(route.params.eventId);
  const [data, setData] = useState<EventAttendeesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await coreApi.getEventAttendees(route.params.eventId));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      setError(
        code === 'EVENT_REGISTRATION_REQUIRED'
          ? "Register for this event to see who's going."
          : code === 'EVENT_NOT_FOUND'
            ? 'This event is no longer available.'
            : e instanceof ApiError && e.status > 0
              ? `Couldn't load who's going (${e.status})`
              : "Couldn't reach Ol-ga. Check your connection."
      );
    }
  }, [route.params.eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const attendees = useMemo(() => data?.attendees ?? [], [data]);
  // Board 04: top five, then "Show all".
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? attendees : attendees.slice(0, TOP);
  // Who is in the room by role, most common first, from the same list.
  const roles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of attendees) {
      if (person.role_category) counts.set(person.role_category, (counts.get(person.role_category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [attendees]);

  return (
    <Screen style={styles.page}>
      <BackHeader onBack={() => navigation.goBack()} title="Who's going" />

      <View style={styles.summary}>
        {event && (
          <Text style={styles.event} numberOfLines={1}>
            {event.name}
          </Text>
        )}
        {data && (
          <View style={styles.countRow}>
            <Text style={styles.count}>{data.total.toLocaleString('en-US')}</Text>
            <Text style={styles.countLabel}>{countLine(data.total, event?.attendee_count)}</Text>
          </View>
        )}
        <View style={styles.privacy}>
          <Lock size={14} color={colors.muted} />
          <Text style={styles.privacyText}>Names appear only when you both accept, in the room.</Text>
        </View>
      </View>

      {roles.length > 0 && (
        <View style={styles.roles}>
          {roles.map(([code, count]) => (
            <View key={code} style={styles.role}>
              <Text style={styles.roleText}>{roleLabel(code)}</Text>
              <Text style={styles.roleCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      {!data && !error && <ActivityIndicator color={colors.muted} style={styles.loading} />}
      {error && (
        <View style={styles.error}>
          <Text style={styles.note}>{error}</Text>
          <Button label="Try again" variant="secondary" small onPress={load} />
        </View>
      )}
      {data && attendees.length === 0 && <Text style={styles.note}>You're among the first to register.</Text>}

      {shown.length > 0 && (
        <View style={styles.list}>
          {shown.map((person) => (
            <View key={person.member_id} style={styles.row}>
              <Silhouette />
              <View style={styles.flex}>
                <Text style={styles.headline} numberOfLines={2}>
                  {person.headline || 'Attendee'}
                </Text>
                {person.role_category && <Text style={styles.sub}>{roleLabel(person.role_category)}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
      {!showAll && attendees.length > TOP && (
        <Pressable onPress={() => setShowAll(true)} style={styles.more} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.moreText}>Show all {attendees.length}</Text>
        </Pressable>
      )}
    </Screen>
  );
}

// Same number as the event page; the list itself leaves out you (and anyone
// you've blocked), so say so when they differ.
function countLine(shown: number, signedUp?: number) {
  return typeof signedUp === 'number' && signedUp !== shown ? `shown here, of ${signedUp} registered` : 'registered';
}

// "PRODUCT_MANAGEMENT" -> "Product management"
function roleLabel(code: string) {
  const text = code.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { backgroundColor: colors.surface },
    summary: { gap: 6, marginTop: 4 },
    event: { fontSize: 13, color: colors.muted },
    countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    count: { fontFamily: fonts.headingBold, fontSize: 34, lineHeight: 38, fontWeight: '800', color: colors.text },
    countLabel: { flex: 1, fontSize: 14, color: colors.muted },
    privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    privacyText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.muted },
    roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    role: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.accentSoft,
    },
    roleText: { fontSize: 12, color: colors.text },
    roleCount: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700', color: colors.text },
    loading: { marginTop: 24 },
    error: { gap: 10 },
    note: { fontSize: 13, lineHeight: 18, color: colors.muted },
    // Rows run edge to edge, split by hairlines.
    list: { marginHorizontal: -20, borderTopWidth: 1, borderTopColor: colors.line },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    headline: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.text },
    sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    more: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
    moreText: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: colors.text, textDecorationLine: 'underline' },
  });

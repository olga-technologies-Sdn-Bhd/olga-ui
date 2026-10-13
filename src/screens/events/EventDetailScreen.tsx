import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../api/client';
import { intentIdFor, nlpApi } from '../../api/nlp';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { DateBlock } from '../../components/DateBlock';
import { Screen } from '../../components/Screen';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { useLive } from '../../context/LiveContext';
import { usePrefs } from '../../context/PrefsContext';
import { EventsStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { isEventLive } from './EventsScreen';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventDetail'>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function longDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Board 03: name, date and venue lead (no tagline). No Go Live before the
// event: signing up doesn't make you visible. Per-event intent and "Leave
// this event" need Core/NLP support, so the general intent shows here.
export function EventDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { getEvent, isGone, register, refresh, refreshIfStale } = useEvents();
  const { setActiveEvent, intentText, setIntentText } = useLive();
  // Always the latest server data (admins can edit name, times, venue).
  const { eventId } = route.params;
  const event = getEvent(eventId);
  const gone = isGone(eventId);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(intentText);
  const { prefs } = usePrefs();
  const minMatch = prefs.filters.minMatch;
  // People live in this room who match the member's saved intent at their
  // minimum match. null until known: no intent yet, still processing, or the
  // call failed.
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const canCount = Boolean(event && isRegistered(event) && isEventLive(event));

  useFocusEffect(
    useCallback(() => {
      if (!canCount) {
        setMatchCount(null);
        return;
      }
      let active = true;
      nlpApi
        .getLiveMatchCount(eventId, intentIdFor(eventId, 'WANT'), minMatch / 100)
        .then((result) => {
          if (active) setMatchCount(result.count);
        })
        .catch(() => {
          if (active) setMatchCount(null);
        });
      return () => {
        active = false;
      };
    }, [canCount, eventId, minMatch])
  );

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
  const open = isEventLive(event);
  const checkedIn = event.registration_status === 'CHECKED_IN';
  // Check-in (badge desk staff, not the app) doesn't block Go Live, but
  // where the event requires it, matching skips members not checked in.
  const awaitingCheckIn = Boolean(event.check_in_required && !checkedIn);

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
    setActiveEvent({ eventId: event.event_id, name: event.name, endsAt: event.ends_at, liveCount: event.live_count });
    navigation.getParent()?.navigate('GoLiveTab', { screen: 'GoLive' });
  }

  function startEditing() {
    setDraft(intentText);
    setEditing(true);
  }

  function saveIntent() {
    if (draft.trim()) setIntentText(draft.trim());
    setEditing(false);
  }

  return (
    <Screen onRefresh={refresh} style={styles.page}>
      <BackHeader onBack={() => navigation.goBack()} />

      <View style={styles.titleRow}>
        <DateBlock iso={event.starts_at} />
        <View style={styles.flex}>
          <Text style={styles.h2}>{event.name}</Text>
          <Text style={styles.sub}>{[longDate(event.starts_at), event.venue].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>

      {/* One row for attendance: the count, and the way in to who's going. */}
      <Pressable
        onPress={() => navigation.navigate('WhosGoing', { eventId })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.going, pressed && styles.pressed]}
      >
        <View style={styles.goingIcon}>
          <Users size={18} color={colors.text} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.goingTitle}>
            {typeof event.attendee_count === 'number'
              ? `${event.attendee_count.toLocaleString('en-US')} ${event.attendee_count === 1 ? 'professional' : 'professionals'} signed up`
              : "See who's going"}
          </Text>
          {open && matchCount !== null && matchCount > 0 ? (
            <Text style={styles.goingMatch}>{matchCount} matching your intent</Text>
          ) : (
            <Text style={styles.goingSub}>See who's going</Text>
          )}
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>

      {!!event.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this event</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.space}>
          <Text style={styles.sectionTitle}>Your intent</Text>
          {!editing && !!intentText.trim() && (
            <Pressable onPress={startEditing} hitSlop={10} accessibilityRole="button">
              <Text style={styles.link}>Edit</Text>
            </Pressable>
          )}
        </View>
        {editing ? (
          <View style={styles.editor}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              style={styles.intentInput}
              placeholder="For example: distribution partners for our platform"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.editorActions}>
              <Button label="Cancel" variant="ghost" small style={styles.flex} onPress={() => setEditing(false)} />
              <Button label="Save" small style={styles.flex} onPress={saveIntent} disabled={!draft.trim()} />
            </View>
          </View>
        ) : intentText.trim() ? (
          <View style={styles.intentBox}>
            <Text style={styles.intent}>{intentText.trim()}</Text>
          </View>
        ) : (
          <Pressable
            onPress={startEditing}
            accessibilityRole="button"
            style={({ pressed }) => [styles.intentEmpty, pressed && styles.pressed]}
          >
            <View style={styles.plus}>
              <Plus size={18} color={colors.onBrand} strokeWidth={2.4} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.intentPrompt}>Set your intent</Text>
              <Text style={styles.goingSub}>Tell me who you'd like to meet, and I'll find them in the room.</Text>
            </View>
          </Pressable>
        )}
        <Text style={styles.hint}>Your general intent. Changing it here changes it everywhere for now.</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {registered ? (
        <>
          <View style={styles.signedUp}>
            <View style={styles.check}>
              <Check size={16} color={colors.positive} strokeWidth={3} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.h3}>{checkedIn ? "You're checked in" : "You're signed up"}</Text>
              <Text style={styles.sub}>
                {open
                  ? "You stay private until you Go Live in the room."
                  : "You stay private until you Go Live. It opens on the day, once you check in at the badge desk."}
              </Text>
              {awaitingCheckIn && (
                <Text style={styles.sub}>This event needs check-in: check in at the badge desk before you appear in matches.</Text>
              )}
            </View>
          </View>
          {open && event.live_mode_enabled && <Button label="Go Live" variant="charcoal" onPress={handleGoLive} />}
        </>
      ) : (
        <Button label="Sign up for this event" onPress={handleRegister} loading={registering} />
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { backgroundColor: colors.surface },
    pressed: { opacity: 0.7 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    space: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 21, lineHeight: 26, fontWeight: '800', color: colors.text },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: '700', color: colors.text },
    sub: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    section: { gap: 8, marginTop: 8 },
    sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 15, fontWeight: '700', color: colors.text },
    link: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '700', color: colors.text, textDecorationLine: 'underline' },
    // Attendance: a full-width row between hairlines.
    going: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: -20,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.line,
    },
    goingIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goingTitle: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700', color: colors.text },
    goingSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    goingMatch: { fontFamily: fonts.bodyBold, fontSize: 12, fontWeight: '700', color: colors.positive, marginTop: 2 },
    description: { lineHeight: 20, color: colors.text, fontSize: 14 },
    editor: { gap: 8 },
    editorActions: { flexDirection: 'row', gap: 8 },
    intentInput: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.brand,
      borderRadius: radius.md,
      padding: 14,
      minHeight: 96,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    intentBox: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14 },
    intent: { fontSize: 15, lineHeight: 21, color: colors.text },
    // No intent yet: a clear, tappable invitation rather than faint text.
    intentEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1.5,
      borderColor: colors.brand2,
      borderRadius: radius.md,
      padding: 14,
    },
    plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
    intentPrompt: { fontFamily: fonts.bodyBold, fontSize: 15, fontWeight: '700', color: colors.text },
    hint: { fontSize: 11, color: colors.muted },
    error: { color: colors.danger, fontSize: 12 },
    signedUp: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 },
    check: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.positiveSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

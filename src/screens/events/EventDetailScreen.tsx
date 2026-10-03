import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../api/client';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateBlock } from '../../components/DateBlock';
import { GoLiveMark } from '../../components/GoLiveMark';
import { Screen } from '../../components/Screen';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { useLive } from '../../context/LiveContext';
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

  function saveIntent() {
    if (draft.trim()) setIntentText(draft.trim());
    setEditing(false);
  }

  return (
    <Screen onRefresh={refresh}>
      <BackHeader onBack={() => navigation.goBack()} />

      <View style={styles.titleRow}>
        <DateBlock iso={event.starts_at} />
        <View style={styles.flex}>
          <Text style={styles.h2}>{event.name}</Text>
          <Text style={styles.sub}>{[longDate(event.starts_at), event.venue].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{event.attendee_count ?? '—'}</Text>
          <Text style={styles.statLabel}>signed up</Text>
        </Card>
        {open && typeof event.live_count === 'number' && event.live_count > 0 && (
          <Card style={{ ...styles.stat, ...styles.statLive }}>
            <Text style={[styles.statValue, styles.statValueLive]}>{event.live_count}</Text>
            <Text style={styles.statLabel}>live now</Text>
          </Card>
        )}
      </View>

      <Button label="See who's going" variant="secondary" onPress={() => navigation.navigate('WhosGoing', { eventId })} />

      {!!event.description && (
        <>
          <Text style={styles.sectionTitle}>About this event</Text>
          <Card>
            <Text style={styles.description}>{event.description}</Text>
          </Card>
        </>
      )}

      <View style={styles.space}>
        <Text style={styles.sectionTitle}>Your intent for this event</Text>
        {!editing && (
          <Button
            label="Edit"
            variant="secondary"
            small
            onPress={() => {
              setDraft(intentText);
              setEditing(true);
            }}
          />
        )}
      </View>
      {editing ? (
        <View style={styles.editor}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            style={styles.intentBox}
            placeholder="What are you looking for at this event?"
            placeholderTextColor={colors.muted}
          />
          <Button label="Save intent" variant="secondary" small onPress={saveIntent} disabled={!draft.trim()} />
        </View>
      ) : (
        <View style={styles.intentBox}>
          <Text style={[styles.intent, !intentText.trim() && styles.intentMissing]}>
            {intentText.trim() || 'Add what you’re looking for.'}
          </Text>
        </View>
      )}
      <Text style={styles.hint}>Your general intent. Changing it here changes it everywhere for now.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {registered ? (
        <>
          <Card style={styles.signedUp}>
            <View style={styles.markWrap}>
              <GoLiveMark size={20} color={colors.text} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.h3}>You're signed up</Text>
              <Text style={styles.sub}>
                {open
                  ? "That doesn't make you visible. Go Live when you're in the room."
                  : "That doesn't make you visible. Go Live opens on the day, once you check in at the badge desk."}
              </Text>
            </View>
          </Card>
          {open && event.live_mode_enabled && <Button label="Go Live in this room" variant="charcoal" onPress={handleGoLive} />}
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
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    space: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, lineHeight: 27, fontWeight: '800', color: colors.text },
    h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
    sub: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    stats: { flexDirection: 'row', gap: 10 },
    stat: { flex: 1 },
    statLive: { backgroundColor: colors.positiveSoft, borderColor: colors.positiveSoft },
    statValue: { fontFamily: fonts.headingExtraBold, fontSize: 24, fontWeight: '800', color: colors.text },
    statValueLive: { color: colors.positive },
    statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
    description: { lineHeight: 21, color: colors.text, fontSize: 14 },
    editor: { gap: 8 },
    intentBox: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      padding: 14,
      minHeight: 56,
      color: colors.text,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    intent: { fontFamily: fonts.headingBold, fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.text },
    intentMissing: { fontFamily: fonts.bodyRegular, fontWeight: '400', color: colors.muted },
    hint: { fontSize: 12, color: colors.muted, marginTop: -4 },
    error: { color: colors.danger, fontSize: 13 },
    signedUp: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    markWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

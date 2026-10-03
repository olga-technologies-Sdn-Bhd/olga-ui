import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { MatchingError, MatchingFailure } from '../../api/matching';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateBlock } from '../../components/DateBlock';
import { FilterSummary } from '../../components/FilterSummary';
import { GoLiveDisc } from '../../components/GoLiveDisc';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { LIVE_MODE_DURATION_MINUTES } from '../../config/env';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { GoLiveBlocker, useLive } from '../../context/LiveContext';
import { usePrefs } from '../../context/PrefsContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { GO_LIVE_COLORS, goLiveColor } from '../../theme/goLiveColors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';
import { topMatches } from './LiveMatchesScreen';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'GoLive'>;

// The searching state plays at least this long, even if matching answers sooner.
const MIN_SEARCH_MS = 3000;
// Board 08: bounded automatic retries, then one manual retry. Never an
// endless spinner.
const AUTO_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const RETRYABLE: MatchingFailure[] = ['MATCHING_FAILED', 'TIMED_OUT'];

const LIVE_LINE = 'Only your matches in this room can see you: role and intent, never your name.';

const BLOCKER_MESSAGES: Record<Exclude<GoLiveBlocker, 'CONSENT_REQUIRED'>, string> = {
  REGISTRATION_REQUIRED: 'Sign up for this event first, then you can go live.',
  EVENT_NOT_ACTIVE: 'This event has ended.',
  LIVE_MODE_NOT_ENABLED: "Live Mode isn't available for this event.",
  EVENT_NOT_FOUND: 'This event was cancelled.',
  TAKEN_OFFLINE: "You've been taken offline. Contact support if you think this is a mistake.",
};

const MATCHING_MESSAGES: Record<MatchingFailure, string> = {
  INTENT_HAS_PII: 'Your intent includes personal details. Edit it in your filter, then try again.',
  INTENT_FAILED: "We couldn't read your intent. Try rephrasing it in your filter.",
  MATCHING_FAILED: "You're live, but matching failed.",
  TIMED_OUT: "You're live, but matching is taking longer than usual.",
};

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function GoLiveScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { events } = useEvents();
  const { prefs, setGoLiveColor } = usePrefs();
  const disc = goLiveColor(prefs.goLiveColor);
  const {
    activeEvent,
    setActiveEvent,
    isLive,
    activeUntil,
    goLive,
    grantLiveModeConsent,
    stopLive,
    runMatching,
    matches,
    passedIds,
    filters,
    intentText,
  } = useLive();
  const [now, setNow] = useState(() => Date.now());
  const [searching, setSearching] = useState(false);
  const [matchingFailed, setMatchingFailed] = useState(false);
  const [manualRetryUsed, setManualRetryUsed] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The room phase follows the clock (before -> open -> ended).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // The room: the selected event while it's still yours, else your next
  // registered event that hasn't ended.
  const room = useMemo(() => {
    const mine = (events ?? [])
      .filter((e) => isRegistered(e) && new Date(e.ends_at).getTime() > now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return mine.find((e) => e.event_id === activeEvent?.eventId) ?? mine[0] ?? null;
  }, [events, now, activeEvent?.eventId]);

  useEffect(() => {
    if (!room || isLive || room.event_id === activeEvent?.eventId) return;
    setActiveEvent({ eventId: room.event_id, name: room.name, endsAt: room.ends_at });
  }, [room, isLive, activeEvent?.eventId, setActiveEvent]);

  // Check-in is the presence gate, and Core has no check-in yet: until it
  // does, Go Live opens when the event starts (agreed interim rule).
  const opensAt = room ? new Date(room.starts_at) : null;
  const beforeRoom = Boolean(opensAt && opensAt.getTime() > now);
  const liveCount = activeEvent?.liveCount;

  // Matching with bounded retries; the member stays live whatever happens.
  const match = useCallback(async () => {
    setSearching(true);
    setMatchingFailed(false);
    setError(null);
    const started = Date.now();
    let lastError: unknown;
    for (let attempt = 1; attempt <= AUTO_ATTEMPTS; attempt++) {
      try {
        const result = await runMatching();
        await wait(Math.max(0, MIN_SEARCH_MS - (Date.now() - started)));
        if (!mounted.current) return;
        setSearching(false);
        if (result.length === 0) navigation.navigate('EmptyRoom');
        return;
      } catch (e) {
        lastError = e;
        const retryable = e instanceof MatchingError ? RETRYABLE.includes(e.reason) : !(e instanceof ApiError && e.status >= 400 && e.status < 500);
        if (!retryable || attempt === AUTO_ATTEMPTS) break;
        await wait(RETRY_DELAY_MS);
      }
    }
    if (!mounted.current) return;
    setSearching(false);
    setMatchingFailed(true);
    setError(
      lastError instanceof MatchingError
        ? MATCHING_MESSAGES[lastError.reason]
        : lastError instanceof ApiError && lastError.status > 0
          ? `You're live, but matching failed (${lastError.status}).`
          : "You're live, but we couldn't reach matching."
    );
  }, [runMatching, navigation]);

  async function handleGoLive() {
    if (!activeEvent) return;
    if (!intentText.trim()) {
      setError("Add what you're looking for first, so we can find your matches.");
      return;
    }
    setError(null);
    setManualRetryUsed(false);
    setSearching(true);
    try {
      const blocker = await goLive();
      if (blocker) {
        setSearching(false);
        if (blocker === 'CONSENT_REQUIRED') askForConsent();
        else setError(BLOCKER_MESSAGES[blocker]);
        return;
      }
    } catch (e) {
      setSearching(false);
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't go live (${e.status})` : "Couldn't reach the server");
      return;
    }
    match();
  }

  // Live Mode needs a LIVE_MODE consent on record (403 LIVE_MODE_CONSENT_REQUIRED).
  function askForConsent() {
    Alert.alert(
      'Allow Live Mode?',
      "While you're live, people at this event who match your intent can see you're here. You can go invisible anytime.",
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Allow',
          onPress: async () => {
            try {
              await grantLiveModeConsent();
              handleGoLive();
            } catch (e) {
              setError(
                e instanceof ApiError && e.code === 'CONSENT_POLICY_NOT_ACTIVE'
                  ? "Live Mode isn't available right now. Please try again later."
                  : e instanceof ApiError && e.status > 0
                    ? `Couldn't save your consent (${e.status})`
                    : "Couldn't reach the server"
              );
            }
          },
        },
      ]
    );
  }

  async function handleGoInvisible() {
    setStopping(true);
    setError(null);
    try {
      await stopLive();
      setMatchingFailed(false);
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't go invisible (${e.status})` : "Couldn't reach the server");
    } finally {
      setStopping(false);
    }
  }

  const openFilter = () => navigation.navigate('Filters');

  // No upcoming room: nothing to go live in.
  if (!room) {
    return (
      <Screen>
        <View>
          <Text style={styles.eyebrow}>Go Live</Text>
          <Text style={styles.h2}>Not in a room yet</Text>
        </View>
        <GoLiveDisc locked label="GO LIVE" caption="OPENS AT CHECK-IN" fill={disc.fill} textColor={disc.text} />
        <Text style={styles.lead}>Nobody can see you.</Text>
        <Card>
          <Text style={styles.sub}>Sign up for an event. Go Live opens when you check in at the badge desk.</Text>
          <Button label="Find an event" variant="secondary" small style={styles.cardButton} onPress={() => navigation.getParent()?.navigate('EventsTab')} />
        </Card>
        <FilterSummary title="Who you'll see" intent={intentText} filters={filters} onChange={openFilter} />
      </Screen>
    );
  }

  // Board 05: before the event. Locked, and says so plainly.
  if (beforeRoom && !isLive) {
    return (
      <Screen>
        <View>
          <Text style={styles.eyebrow}>Go Live</Text>
          <Text style={styles.h2}>Not in a room yet</Text>
        </View>
        <GoLiveDisc locked label="GO LIVE" caption="OPENS AT CHECK-IN" fill={disc.fill} textColor={disc.text} />
        <Text style={styles.lead}>Nobody can see you.</Text>
        <Card style={styles.roomCard}>
          <DateBlock iso={room.starts_at} size="sm" />
          <View style={styles.flex}>
            <Text style={styles.h3}>{room.name}</Text>
            <Text style={styles.sub}>Go Live opens when you check in at the badge desk.</Text>
          </View>
        </Card>
        <FilterSummary title="Who you'll see" intent={intentText} filters={filters} onChange={openFilter} />
      </Screen>
    );
  }

  const until = activeUntil ? formatTime(activeUntil) : null;
  const expectedEnd = formatTime(
    new Date(Math.min(now + LIVE_MODE_DURATION_MINUTES * 60000, new Date(room.ends_at).getTime()))
  );

  // Board 08: live.
  if (isLive) {
    const count = topMatches(matches, passedIds).length;
    const ready = !searching && count > 0;
    return (
      <Screen>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{room.name}</Text>
            <Text style={styles.h2}>You're live</Text>
          </View>
          {until && <Pill label={`● UNTIL ${until}`} tone="positive" />}
        </View>
        <GoLiveDisc
          waves
          label={searching ? 'SEARCHING' : ready ? `LIVE · ${count} READY` : 'LIVE'}
          caption={until ? `LIVE UNTIL ${until}` : undefined}
          fill={disc.fill}
          textColor={disc.text}
          onPress={ready ? () => navigation.navigate('LiveMatches') : undefined}
          accessibilityLabel={ready ? `Live, ${count} ready. Open your matches` : undefined}
        />
        <Text style={styles.lead}>
          {searching
            ? 'Finding your three strongest matches'
            : ready
              ? `Your ${count === 1 ? 'match is' : `${count} strongest matches are`} ready`
              : matches && matches.length === 0
                ? 'Nobody here clears your filter yet'
                : "You're live"}
        </Text>
        <Text style={styles.center}>{LIVE_LINE}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {matchingFailed && !manualRetryUsed && (
          <Button
            label="Try matching again"
            variant="secondary"
            onPress={() => {
              setManualRetryUsed(true);
              match();
            }}
          />
        )}
        {ready && <Button label="See your matches" onPress={() => navigation.navigate('LiveMatches')} />}
        <Button label="Go invisible" variant="secondary" loading={stopping} disabled={searching} onPress={handleGoInvisible} />
        <FilterSummary title="Live for" intent={intentText} filters={filters} onChange={openFilter} />
      </Screen>
    );
  }

  // Board 06: ready. Press and hold.
  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{room.name}</Text>
          <Text style={styles.h2}>Ready when you are</Text>
        </View>
        {typeof liveCount === 'number' && <Pill label={`● ${liveCount} LIVE`} tone="positive" />}
      </View>
      <GoLiveDisc
        label={searching ? 'SEARCHING' : 'GO LIVE'}
        caption={searching ? undefined : 'PRESS & HOLD'}
        waves={searching}
        fill={disc.fill}
        textColor={disc.text}
        disabled={searching}
        onHoldComplete={handleGoLive}
      />
      <Text style={styles.lead}>Press and hold to Go Live</Text>
      <Text style={styles.center}>
        Your three best matches in this room appear, and only they can see you. Nobody else. It ends at {expectedEnd}.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.colors}>
        {GO_LIVE_COLORS.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setGoLiveColor(c.key)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${c.label} button colour`}
            accessibilityState={{ selected: prefs.goLiveColor === c.key }}
            style={[styles.swatchRing, prefs.goLiveColor === c.key && styles.swatchRingOn]}
          >
            <View style={[styles.swatch, { backgroundColor: c.fill }, c.key === 'pearl' && styles.swatchPearl]} />
          </Pressable>
        ))}
        <Pressable onPress={() => navigation.navigate('GoLiveColour')} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Your colour</Text>
        </Pressable>
      </View>

      <FilterSummary title="You're going live for" intent={intentText} filters={filters} onChange={openFilter} />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
    h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
    lead: { fontFamily: fonts.bodyBold, fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
    center: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center', marginTop: -6, paddingHorizontal: 8 },
    sub: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
    roomCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardButton: { alignSelf: 'flex-start', marginTop: 12 },
    colors: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
    swatchRing: { padding: 3, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
    swatchRingOn: { borderColor: colors.text },
    swatch: { width: 24, height: 24, borderRadius: 12 },
    swatchPearl: { borderWidth: 1, borderColor: colors.brand2 },
    link: { fontSize: 13, fontWeight: '700', color: colors.text, textDecorationLine: 'underline', marginLeft: 6 },
  });

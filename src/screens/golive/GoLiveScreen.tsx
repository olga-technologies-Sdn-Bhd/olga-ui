import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Clock, Radio, Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { MatchCard, MatchingError, MatchingFailure } from '../../api/matching';
import { BottomSheet, SheetGroup, SheetOption } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateBlock } from '../../components/DateBlock';
import { FilterSummary } from '../../components/FilterSummary';
import { GoLiveDisc } from '../../components/GoLiveDisc';
import { Marquee } from '../../components/Marquee';
import { AVATAR_INK, GoLiveRadar, pastelFor, RadarPerson, RadarPhase, useCountUp } from '../../components/GoLiveRadar';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useNearby } from '../../context/NearbyContext';
import { isRegistered, useEvents } from '../../context/EventsContext';
import { ConsentPurpose, GoLiveBlocker, useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { topMatches } from './LiveMatchesScreen';
import { GoLiveModeSwitch, HEADER_ABOVE_WITH_SWITCH, NearbyView } from './NearbyView';
import { showDialog } from '../../components/DialogHost';
import { LiveDuration, usePrefs } from '../../context/PrefsContext';
import { haptics } from '../../utils/haptics';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'GoLive'>;

// The searching state plays at least this long, even if matching answers sooner.
const MIN_SEARCH_MS = 3000;
// Board 08: bounded automatic retries, then one manual retry. Never an
// endless spinner.
const AUTO_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const RETRYABLE: MatchingFailure[] = ['MATCHING_FAILED', 'TIMED_OUT'];

// GOL-02: 30/60/90/120 min or until the event ends; default 60 (prefs).
const LIVE_DURATIONS: { value: LiveDuration; label: string; short: string }[] = [
  { value: 30, label: '30 min', short: '30m' },
  { value: 60, label: '1 hr', short: '1h' },
  { value: 90, label: '1.5 hr', short: '1.5h' },
  { value: 120, label: '2 hr', short: '2h' },
  { value: 'event', label: 'Until the event ends', short: 'End' },
];

const LIVE_LINE = "Your role and what you're looking for. Never your name.";

const BLOCKER_MESSAGES: Record<Exclude<GoLiveBlocker, 'CONSENT_REQUIRED'>, string> = {
  REGISTRATION_REQUIRED: 'Register for this event first, then you can Go Live.',
  EVENT_NOT_ACTIVE: 'This event has ended.',
  LIVE_MODE_NOT_ENABLED: "Go Live isn't available for this event.",
  EVENT_NOT_FOUND: 'This event was cancelled.',
  TAKEN_OFFLINE: "You've been taken offline. Contact support if you think this is a mistake.",
};

const MATCHING_MESSAGES: Record<MatchingFailure, string> = {
  INTENT_HAS_PII: 'What you’re looking for includes personal details. Edit it in your filter, then try again.',
  INTENT_FAILED: "We couldn't read what you're looking for. Try rephrasing it in your filter.",
  MATCHING_FAILED: "You're live, but matching failed.",
  TIMED_OUT: "You're live, but matching is taking longer than usual.",
  CONSENT_DENIED: 'Matching is off. Go Live again and allow matching.',
};

// Consent wording is the app's; Core keeps the policy version and hash.
// MATCHING text is placeholder plain language until the client approves it.
const CONSENT_PROMPTS: Record<ConsentPurpose, { title: string; body: string }> = {
  LIVE_MODE: {
    title: 'Allow Go Live?',
    body: 'Relevant people at this event can see you while you’re live. End it anytime.',
  },
  MATCHING: {
    title: 'Allow matching?',
    body: "Ol-ga finds relevant people at this event. They see your role and what you're looking for, never your name.",
  },
};

const CHECK_IN_NOTE = 'Check in at the badge desk to appear to relevant people.';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Names stay hidden until a Commit is accepted, so a match is shown by the
// first two letters of their first name when we have it, and of their
// headline when we don't.
function initialsFor(card: MatchCard) {
  const source = (card.profile?.display_name || card.profile?.headline || '').trim().split(/\s+/)[0] ?? '';
  const letters = source.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
  return letters ? letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase() : '··';
}

// GOL-02: how much more time a live session can take (the server caps it at
// the event's end).
const EXTEND_OPTIONS = [
  { minutes: 30, label: '+30 minutes' },
  { minutes: 60, label: '+1 hour' },
  { minutes: 120, label: '+2 hours' },
];

export function GoLiveScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { events } = useEvents();
  const { mode, setMode, available: nearbyAvailable, online } = useNearby();
  const disc = { fill: colors.charcoal, text: colors.white };
  const {
    activeEvent,
    setActiveEvent,
    isLive,
    activeUntil,
    goLive,
    checkConsent,
    recordConsentDecision,
    stopLive,
    extendLive,
    runMatching,
    matches,
    passedIds,
    filters,
    intentText,
  } = useLive();
  const {
    prefs: { liveDuration },
    setLiveDuration,
  } = usePrefs();
  const durationIndex = Math.max(0, LIVE_DURATIONS.findIndex((d) => d.value === liveDuration));
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

  // Board 05: Go Live opens when the event starts. Check-in (done by event
  // staff) doesn't block it, but where the event requires check-in,
  // matching skips members who aren't CHECKED_IN: say so.
  const opensAt = room ? new Date(room.starts_at) : null;
  const beforeRoom = Boolean(opensAt && opensAt.getTime() > now);
  const awaitingCheckIn = Boolean(room?.check_in_required && room.registration_status !== 'CHECKED_IN');
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
        await runMatching();
        await wait(Math.max(0, MIN_SEARCH_MS - (Date.now() - started)));
        if (!mounted.current) return;
        setSearching(false);
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
  }, [runMatching]);

  async function handleGoLive() {
    if (!activeEvent) return;
    if (!intentText.trim()) {
      setError('Add what you’re looking for first, so I can find relevant people.');
      return;
    }
    setError(null);
    // Ask for what isn't on record yet (Live Mode, then matching). An
    // unknown answer (no policy, offline) doesn't block: the server decides.
    for (const purpose of ['LIVE_MODE', 'MATCHING'] as const) {
      if ((await checkConsent(purpose)) === 'ASK') {
        askForConsent(purpose);
        return;
      }
    }
    setManualRetryUsed(false);
    setSearching(true);
    try {
      const blocker = await goLive();
      if (blocker) {
        setSearching(false);
        // Fallback: the server still wants LIVE_MODE consent.
        if (blocker === 'CONSENT_REQUIRED') askForConsent('LIVE_MODE');
        else setError(BLOCKER_MESSAGES[blocker]);
        return;
      }
    } catch (e) {
      setSearching(false);
      const unreachable = !(e instanceof ApiError && e.status > 0);
      // No internet: Nearby still finds people close by, over Bluetooth.
      setError(
        unreachable
          ? 'No internet. Switch to Nearby to find people around you over Bluetooth.'
          : `Couldn't Go Live (${e instanceof ApiError ? e.status : 0})`
      );
      return;
    }
    match();
  }

  // Records the answer, then carries on with Go Live (which asks for the
  // next missing consent). Declining matching records DENIED and stops.
  function askForConsent(purpose: ConsentPurpose) {
    const save = async (decision: 'GRANTED' | 'DENIED') => {
      try {
        await recordConsentDecision(purpose, decision);
      } catch (e) {
        setError(
          e instanceof ApiError && e.code === 'CONSENT_POLICY_NOT_ACTIVE'
            ? purpose === 'LIVE_MODE'
              ? "Go Live isn't available right now. Please try again later."
              : "Matching isn't available right now. Please try again later."
            : e instanceof ApiError && e.status > 0
              ? `Couldn't save your consent (${e.status})`
              : "Couldn't connect. Try again."
        );
        return;
      }
      if (decision === 'GRANTED') handleGoLive();
      else setError(MATCHING_MESSAGES.CONSENT_DENIED);
    };
    showDialog(CONSENT_PROMPTS[purpose].title, CONSENT_PROMPTS[purpose].body, [
      // Not now on Live Mode just closes; on matching it's a recorded decline.
      { text: 'Not now', style: 'cancel', onPress: purpose === 'MATCHING' ? () => save('DENIED') : undefined },
      { text: 'Allow', onPress: () => save('GRANTED') },
    ], { icon: purpose === 'MATCHING' ? Sparkles : Radio });
  }

  // GOL-02: more time on the same session, before it ends.
  const [extendOpen, setExtendOpen] = useState(false);
  const [extending, setExtending] = useState(false);

  async function extend(minutes: number) {
    if (extending) return;
    setExtending(true);
    try {
      const result = await extendLive(minutes);
      setExtendOpen(false);
      if (result === 'EXTENDED') haptics.success();
      else if (result === 'AT_EVENT_END') showDialog('Already live until the end', 'Your session runs until the event closes.', undefined, { icon: Clock });
      else showDialog('Your session has ended', 'Press and hold Go Live to go live again.', undefined, { icon: Clock });
    } catch {
      showDialog("Couldn't add time", 'Check your connection and try again.', undefined, { icon: Clock, tone: 'danger' });
    } finally {
      setExtending(false);
    }
  }

  async function handleGoInvisible() {
    if (stopping || searching) return;
    setStopping(true);
    setError(null);
    try {
      await stopLive();
      setMatchingFailed(false);
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't end Go Live (${e.status})` : "Couldn't connect. Try again.");
    } finally {
      setStopping(false);
    }
  }

  const openFilter = () => navigation.navigate('Filters');

  // Stable inputs for the radar, so this screen re-rendering (it does every
  // 30 s) never rebuilds it mid-animation.
  const people = useMemo<RadarPerson[]>(
    () => topMatches(matches, passedIds).map((card) => ({ id: card.match.member_id, initials: initialsFor(card) })),
    [matches, passedIds]
  );
  // The count on the card climbs with the avatars as they arrive.
  const counted = useCountUp(people.length, isLive && !searching && people.length > 0);
  const goLiveRef = useRef(handleGoLive);
  useEffect(() => {
    goLiveRef.current = handleGoLive;
  });
  const onHoldComplete = useCallback(() => {
    goLiveRef.current();
  }, []);
  const openMatches = useCallback(() => navigation.navigate('LiveMatches'), [navigation]);

  // Nearby (no event): when there's no room, the member picked it, or there's
  // no internet (the event room needs Ol-ga; Nearby works without it).
  const nearby =
    !isLive && (!room || mode === 'nearby' || (mode === null && (nearbyAvailable || online === false)));
  if (nearby) {
    return <NearbyView navigation={navigation} onSwitchToEvent={room ? () => setMode('event') : undefined} />;
  }
  const modeSwitch = !isLive && <GoLiveModeSwitch mode="event" onChange={setMode} />;

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
          <Text style={styles.sub}>Register for an event. Go Live opens when you check in at the badge desk.</Text>
          <Button label="Find an event" variant="secondary" small style={styles.cardButton} onPress={() => navigation.getParent()?.navigate('EventsTab', { screen: 'Events' })} />
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
        {modeSwitch}
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

  // Boards 06 and 08: ready, then live. One tree for both, so the button can
  // rise and the radar can start without the screen being rebuilt.
  const count = people.length;
  const phase: RadarPhase = searching ? 'searching' : !isLive ? 'idle' : count > 0 ? 'found' : matches && !matchingFailed ? 'empty' : 'live';

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.eventNameBox}>
          <Marquee text={room.name} style={styles.eventName} />
        </View>
        {isLive ? (
          <View style={styles.status}>
            <Pill label="● LIVE" tone="positive" />
          </View>
        ) : (
          typeof liveCount === 'number' && (
            <View style={styles.status}>
              <Pill label={`● ${liveCount} LIVE`} tone="positive" />
            </View>
          )
        )}
      </View>
      {modeSwitch}

      <GoLiveRadar
        phase={phase}
        people={people}
        disabled={searching}
        onHoldComplete={onHoldComplete}
        onOpenMatches={openMatches}
        headerAbove={modeSwitch ? HEADER_ABOVE_WITH_SWITCH : undefined}
      />

      {phase === 'idle' && (
        <>
          <Text style={styles.lead}>Press and hold to Go Live</Text>
          <Text style={styles.center}>The most relevant people in this room appear, and only they can see you. Nobody else.</Text>
        </>
      )}
      {phase === 'searching' && <Text style={styles.searching}>Finding the most relevant people…</Text>}
      {phase === 'found' && (
        <Pressable
          onPress={openMatches}
          accessibilityRole="button"
          accessibilityLabel={`Relevant people found. ${count} great ${count === 1 ? 'connection' : 'connections'}. Open the list`}
          style={({ pressed }) => [styles.found, pressed && styles.pressed]}
        >
          <View style={styles.foundAvatars}>
            {people.slice(0, Math.min(3, counted)).map((person, i) => (
              <View key={person.id} style={[styles.foundAvatar, { backgroundColor: pastelFor(person.id) }, i > 0 && styles.foundAvatarNext]}>
                <Text style={styles.foundInitials}>{person.initials}</Text>
              </View>
            ))}
          </View>
          <View style={styles.flex}>
            <Text style={styles.h3}>Relevant people found</Text>
            <Text style={styles.sub}>
              {Math.max(1, counted)} great {counted <= 1 ? 'connection' : 'connections'}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      )}
      {phase === 'empty' && (
        <>
          <Text style={styles.lead}>Relevant people will appear here</Text>
          <Text style={styles.center}>Widen your filter to meet more of the room.</Text>
          <Button label="Widen my filter" variant="secondary" small style={styles.widen} onPress={openFilter} />
        </>
      )}
      {awaitingCheckIn && <Text style={styles.center}>{CHECK_IN_NOTE}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {isLive && matchingFailed && !manualRetryUsed && (
        <Button
          label="Try matching again"
          variant="secondary"
          onPress={() => {
            setManualRetryUsed(true);
            match();
          }}
        />
      )}
      {/* Switching this off is how you go invisible. */}
      {isLive && (
        <View style={[styles.visible, searching && styles.dimmed]}>
          <View style={styles.flex}>
            <Text style={styles.h3}>Visible to relevant people</Text>
            <Text style={styles.sub}>
              {activeUntil ? `Live until ${String(activeUntil.getHours()).padStart(2, '0')}:${String(activeUntil.getMinutes()).padStart(2, '0')}. ` : ''}
              {activeUntil && (
                <Text style={styles.extend} onPress={() => setExtendOpen(true)} accessibilityRole="button" suppressHighlighting>
                  Extend
                </Text>
              )}
              {activeUntil ? '\n' : ''}
              {LIVE_LINE}
            </Text>
          </View>
          <ToggleSwitch on={!stopping} onToggle={handleGoInvisible} label="Visible to relevant people" />
        </View>
      )}

      {/* How long to stay live (GOL-02), chosen before going live. */}
      {!isLive && (
        <View style={styles.duration}>
          <View style={styles.durationHead}>
            <Text style={styles.durationTitle}>Stay live for</Text>
            <Text style={styles.durationValue}>{LIVE_DURATIONS[durationIndex].label}</Text>
          </View>
          {/* A seekbar that snaps to the five stops, labelled underneath. */}
          <Slider
            minimumValue={0}
            maximumValue={LIVE_DURATIONS.length - 1}
            step={1}
            value={durationIndex}
            onValueChange={(i) => {
              const next = LIVE_DURATIONS[Math.round(i)].value;
              if (next !== liveDuration) haptics.tick();
              setLiveDuration(next);
            }}
            minimumTrackTintColor={colors.brand}
            maximumTrackTintColor={colors.track}
            thumbTintColor={colors.brand}
            accessibilityLabel="Stay live for"
          />
          <View style={styles.durationStops}>
            {LIVE_DURATIONS.map((d, i) => (
              <Text key={String(d.value)} style={[styles.durationStop, i === durationIndex && styles.durationStopOn]}>
                {d.short}
              </Text>
            ))}
          </View>
        </View>
      )}

      <FilterSummary title={isLive ? 'Live for' : "You're going live for"} intent={intentText} filters={filters} onChange={openFilter} />
      <BottomSheet
        visible={extendOpen}
        onClose={() => !extending && setExtendOpen(false)}
        title="Stay live longer"
        subtitle="Same relevant people, no new search. Never past the event's end."
      >
        <SheetGroup>
          {EXTEND_OPTIONS.map((o) => (
            <SheetOption key={o.minutes} label={o.label} onPress={() => extend(o.minutes)} />
          ))}
        </SheetGroup>
      </BottomSheet>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    // The event name sits in the centre; the live pill floats at the left
    // without pushing it off centre.
    header: { minHeight: 30, justifyContent: 'center' },
    eventName: {
      fontFamily: fonts.monoBold,
      fontSize: 11,
      fontWeight: semibold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.muted,
    },
    // Room on both sides for the live pill, so the name stays centred.
    eventNameBox: { marginHorizontal: 74 },
    // On the left, leaving the right-hand end for the wordmark when live.
    status: { position: 'absolute', left: 0 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: semibold },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: semibold, color: colors.text, marginTop: 4 },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: semibold, color: colors.text },
    lead: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: semibold, color: colors.text, textAlign: 'center' },
    center: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center', marginTop: -6, paddingHorizontal: 8 },
    searching: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    sub: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    extend: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: colors.accent },
    error: { color: colors.danger, fontSize: 12, textAlign: 'center' },
    roomCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardButton: { alignSelf: 'flex-start', marginTop: 12 },
    widen: { alignSelf: 'center' },
    visible: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 4 },
    duration: { gap: 8, paddingHorizontal: 4 },
    durationTitle: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.text },
    durationHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    durationValue: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: semibold, color: colors.text },
    // Labels line up under the slider's stops (the track is inset by the thumb's half-width).
    durationStops: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: -4 },
    durationStop: { width: 34, textAlign: 'center', fontSize: 11, color: colors.muted },
    durationStopOn: { color: colors.text, fontWeight: semibold },
    dimmed: { opacity: 0.5 },
    found: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.line,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    foundAvatars: { flexDirection: 'row' },
    foundAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    foundAvatarNext: { marginLeft: -10 },
    foundInitials: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: AVATAR_INK },
  });

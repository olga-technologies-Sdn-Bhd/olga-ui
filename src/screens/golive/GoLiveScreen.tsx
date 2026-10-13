import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { MatchCard, MatchingError, MatchingFailure } from '../../api/matching';
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
import { isRegistered, useEvents } from '../../context/EventsContext';
import { ConsentPurpose, GoLiveBlocker, useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
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

const LIVE_LINE = 'Role and intent only, never your name.';

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
  CONSENT_DENIED: "Matching is off, so we can't find your matches. Go Live again and allow matching to turn it on.",
};

// Consent wording is the app's; Core keeps the policy version and hash.
// MATCHING text is placeholder plain language until the client approves it.
const CONSENT_PROMPTS: Record<ConsentPurpose, { title: string; body: string }> = {
  LIVE_MODE: {
    title: 'Allow Live Mode?',
    body: "While you're live, people at this event who match your intent can see you're here. You can go invisible anytime.",
  },
  MATCHING: {
    title: 'Allow matching?',
    body: "To find your matches, Ol-ga compares what you're looking for with the other people at this event who allowed matching. Your matches see your role and intent, never your name.",
  },
};

const CHECK_IN_NOTE = 'This event needs check-in: check in at the badge desk before you appear in matches.';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Names stay hidden until a Commit is accepted, so a match is shown by the
// first two letters of their first name when we have it, and of their
// headline when we don't.
function initialsFor(card: MatchCard) {
  const source = (card.profile?.display_name || card.profile?.headline || '').trim().split(/\s+/)[0] ?? '';
  const letters = source.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
  return letters ? letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase() : '··';
}

export function GoLiveScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { events } = useEvents();
  const disc = { fill: colors.charcoal, text: colors.white };
  const {
    activeEvent,
    setActiveEvent,
    isLive,
    goLive,
    checkConsent,
    recordConsentDecision,
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
      setError('Set your intent first, so I can find your matches.');
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
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't go live (${e.status})` : "Couldn't reach the server");
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
              ? "Live Mode isn't available right now. Please try again later."
              : "Matching isn't available right now. Please try again later."
            : e instanceof ApiError && e.status > 0
              ? `Couldn't save your consent (${e.status})`
              : "Couldn't reach the server"
        );
        return;
      }
      if (decision === 'GRANTED') handleGoLive();
      else setError(MATCHING_MESSAGES.CONSENT_DENIED);
    };
    Alert.alert(CONSENT_PROMPTS[purpose].title, CONSENT_PROMPTS[purpose].body, [
      // Not now on Live Mode just closes; on matching it's a recorded decline.
      { text: 'Not now', style: 'cancel', onPress: purpose === 'MATCHING' ? () => save('DENIED') : undefined },
      { text: 'Allow', onPress: () => save('GRANTED') },
    ]);
  }

  async function handleGoInvisible() {
    if (stopping || searching) return;
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

      <GoLiveRadar phase={phase} people={people} disabled={searching} onHoldComplete={onHoldComplete} onOpenMatches={openMatches} />

      {phase === 'idle' && (
        <>
          <Text style={styles.lead}>Press and hold to Go Live</Text>
          <Text style={styles.center}>Your best matches in this room appear, and only they can see you. Nobody else.</Text>
        </>
      )}
      {phase === 'searching' && <Text style={styles.searching}>Finding your strongest matches…</Text>}
      {phase === 'found' && (
        <Pressable
          onPress={openMatches}
          accessibilityRole="button"
          accessibilityLabel={`Matches found. ${count} great ${count === 1 ? 'connection' : 'connections'}. Open your matches`}
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
            <Text style={styles.h3}>Matches found!</Text>
            <Text style={styles.sub}>
              {Math.max(1, counted)} great {counted <= 1 ? 'connection' : 'connections'}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      )}
      {phase === 'empty' && (
        <>
          <Text style={styles.lead}>No matches yet</Text>
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
            <Text style={styles.h3}>Visible to your matches</Text>
            <Text style={styles.sub}>{LIVE_LINE}</Text>
          </View>
          <ToggleSwitch on={!stopping} onToggle={handleGoInvisible} label="Visible to your matches" />
        </View>
      )}

      <FilterSummary title={isLive ? 'Live for' : "You're going live for"} intent={intentText} filters={filters} onChange={openFilter} />
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
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.muted,
    },
    // Room on both sides for the live pill, so the name stays centred.
    eventNameBox: { marginHorizontal: 74 },
    // On the left, leaving the right-hand end for the wordmark when live.
    status: { position: 'absolute', left: 0 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: '700', color: colors.text },
    lead: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
    center: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center', marginTop: -6, paddingHorizontal: 8 },
    searching: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    sub: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    error: { color: colors.danger, fontSize: 12, textAlign: 'center' },
    roomCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardButton: { alignSelf: 'flex-start', marginTop: 12 },
    widen: { alignSelf: 'center' },
    visible: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 4 },
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
    foundInitials: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: '600', color: AVATAR_INK },
  });

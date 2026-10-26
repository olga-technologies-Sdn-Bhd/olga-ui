import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Search, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { GENERAL_DURATIONS, MatchCard, MatchingError, MatchingFailure } from '../../api/matching';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { showDialog } from '../../components/DialogHost';
import { FilterSummary } from '../../components/FilterSummary';
import { GoLiveModeSwitch, GoLiveTop, HEADER_ABOVE_WITH_SWITCH } from '../../components/GoLiveModeSwitch';
import { AVATAR_INK, GoLiveRadar, pastelFor, RadarPerson, RadarPhase, useCountUp } from '../../components/GoLiveRadar';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { MATCH_LIMIT } from '../../config/env';
import { useLive } from '../../context/LiveContext';
import { GoLiveMode } from '../../context/NearbyContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, semibold } from '../../theme/typography';
import { haptics } from '../../utils/haptics';

const MATCHING_MESSAGES: Record<MatchingFailure, string> = {
  INTENT_HAS_PII: 'What you’re looking for includes personal details. Edit it, then try again.',
  INTENT_FAILED: "We couldn't read what you're looking for. Try rephrasing it.",
  MATCHING_FAILED: "Couldn't find relevant people right now. Try again.",
  TIMED_OUT: 'Matching is taking longer than usual. Try again in a moment.',
  CONSENT_DENIED: 'Matching is off. Go Live again and allow matching.',
};

// Consent wording is the app's; Core keeps the policy version and hash.
// Placeholder plain language until the client approves it.
const CONSENT = {
  title: 'Allow matching?',
  body: "Ol-ga finds relevant people for you, anywhere. They see your role and what you're looking for, never your name.",
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Mon 2 Nov, 15:27". Wording after the full prototype's Go Live ("share
// your intent", "visible to matching members").
function visibleLine(until: Date) {
  const time = `${String(until.getHours()).padStart(2, '0')}:${String(until.getMinutes()).padStart(2, '0')}`;
  return `Visible to matching members until ${WEEKDAYS[until.getDay()]} ${until.getDate()} ${MONTHS[until.getMonth()]}, ${time}. Your role, never your name.`;
}

// Initials for the radar: names stay hidden until they accept, so the
// first letters of their headline.
function initialsFor(card: MatchCard) {
  const word = (card.profile?.headline ?? '').trim().split(/\s+/)[0] ?? '';
  const letters = word.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
  return letters ? letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase() : '··';
}

type Props = {
  navigation: NativeStackNavigationProp<GoLiveStackParamList, 'GoLive'>;
  onSwitchMode: (mode: GoLiveMode) => void;
};

// Go Live > Anywhere: general matching, no event and no Bluetooth. The same
// disc and radar as the other two; "live" here means sharing your intent:
// findable by matching members anywhere for the time you chose (1 day to 30
// days), with the switch to stop. The search finds them for you.
export function AnywhereView({ navigation, onSwitchMode }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    intentText,
    filters,
    checkConsent,
    recordConsentDecision,
    generalMatches,
    generalUntil,
    generalDurationMs,
    setGeneralDurationMs,
    runGeneralMatching,
    stopGeneral,
    refreshGeneral,
  } = useLive();
  const [searching, setSearching] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needIntent, setNeedIntent] = useState(false);
  const durationIndex = Math.max(0, GENERAL_DURATIONS.findIndex((d) => d.ms === generalDurationMs));

  // Still sharing from before (another session, another phone)? Ask Ol-ga
  // each time the screen shows; it also fills in the last intent.
  useFocusEffect(
    useCallback(() => {
      refreshGeneral();
    }, [refreshGeneral])
  );
  // Sharing, but no search on this phone yet: search once, as Go Live does.
  const autoSearched = useRef(false);
  const sharing = Boolean(generalUntil);

  const openFilter = () => navigation.navigate('Filters');
  const openMatches = useCallback(() => navigation.navigate('AnywhereMatches'), [navigation]);

  async function find() {
    if (searching) return;
    if (!intentText.trim()) {
      setNeedIntent(true);
      return;
    }
    setError(null);
    const consent = await checkConsent('MATCHING');
    if (consent === 'ASK') {
      askForConsent();
      return;
    }
    if (consent === 'NO_POLICY') {
      setError("Matching isn't available right now. Please try again later.");
      return;
    }
    setSearching(true);
    try {
      await runGeneralMatching();
    } catch (e) {
      if (e instanceof MatchingError) setError(MATCHING_MESSAGES[e.reason]);
      else if (e instanceof ApiError && e.code.startsWith('REQUESTER_')) setError(MATCHING_MESSAGES.TIMED_OUT);
      else setError(e instanceof ApiError && e.status > 0 ? `Couldn't find matches (${e.status})` : "Couldn't connect. Try again.");
    } finally {
      setSearching(false);
    }
  }

  function askForConsent() {
    const save = async (decision: 'GRANTED' | 'DENIED') => {
      try {
        await recordConsentDecision('MATCHING', decision, 'go_live_anywhere_consent');
      } catch (e) {
        setError(
          e instanceof ApiError && e.code === 'CONSENT_POLICY_NOT_ACTIVE'
            ? "Matching isn't available right now. Please try again later."
            : e instanceof ApiError && e.status > 0
              ? `Couldn't save your consent (${e.status})`
              : "Couldn't connect. Try again."
        );
        return;
      }
      if (decision === 'GRANTED') find();
      else setError(MATCHING_MESSAGES.CONSENT_DENIED);
    };
    showDialog(
      CONSENT.title,
      CONSENT.body,
      [
        { text: 'Not now', style: 'cancel', onPress: () => save('DENIED') },
        { text: 'Allow', onPress: () => save('GRANTED') },
      ],
      { icon: Sparkles }
    );
  }

  async function stop() {
    if (stopping || searching) return;
    setStopping(true);
    setError(null);
    try {
      await stopGeneral();
      haptics.success();
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't stop sharing (${e.status})` : "Couldn't connect. Try again.");
    } finally {
      setStopping(false);
    }
  }

  const findRef = useRef(find);
  findRef.current = find;
  useEffect(() => {
    if (sharing && generalMatches === null && !autoSearched.current && intentText.trim()) {
      autoSearched.current = true;
      findRef.current();
    }
  }, [sharing, generalMatches, intentText]);
  const onHoldComplete = useCallback(() => {
    findRef.current();
  }, []);

  const shown = useMemo(() => (generalMatches ?? []).slice(0, MATCH_LIMIT), [generalMatches]);
  const people = useMemo<RadarPerson[]>(() => shown.map((card) => ({ id: card.match.member_id, initials: initialsFor(card) })), [shown]);
  const count = people.length;
  const counted = useCountUp(count, !searching && count > 0);
  const live = sharing;
  const phase: RadarPhase = searching ? 'searching' : !live ? 'idle' : generalMatches === null ? 'live' : count > 0 ? 'found' : 'empty';

  return (
    <Screen
      renderHeader={(scrollY) => (
        // Sharing runs for days in the background: the other modes stay open.
        <GoLiveTop scrollY={scrollY} modeSwitch={<GoLiveModeSwitch mode="anywhere" onChange={onSwitchMode} disabled={searching} scrollY={scrollY} />}>
          <View style={styles.header}>
            <Text style={styles.title}>ANYWHERE</Text>
            {live && (
              <View style={styles.status}>
                <Pill label="● SHARING" tone="positive" />
              </View>
            )}
          </View>
        </GoLiveTop>
      )}
    >

      <GoLiveRadar
        phase={phase}
        people={people}
        disabled={searching}
        onHoldComplete={onHoldComplete}
        onOpenMatches={openMatches}
        headerAbove={HEADER_ABOVE_WITH_SWITCH}
      />

      {phase === 'idle' && (
        <>
          <Text style={styles.lead}>Press and hold to share your intent</Text>
          <Text style={styles.center}>No event or Bluetooth needed. Members anywhere who can help appear here, and only they can see you.</Text>
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
          <View style={styles.row}>
            {people.slice(0, Math.min(3, counted)).map((person, i) => (
              <View key={person.id} style={[styles.avatar, { backgroundColor: pastelFor(person.id) }, i > 0 && styles.avatarNext]}>
                <Text style={styles.initials}>{person.initials}</Text>
              </View>
            ))}
          </View>
          <View style={styles.flex}>
            <Text style={styles.h3}>Relevant people found</Text>
            <Text style={styles.sub}>
              {Math.max(1, counted)} great {counted <= 1 ? 'connection' : 'connections'}, anywhere
            </Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      )}
      {phase === 'empty' && (
        <>
          <Text style={styles.lead}>No matches yet</Text>
          <Text style={styles.center}>Try making what you’re looking for more specific: the role, the industry and the market.</Text>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {live && !searching && generalMatches !== null && <Button label="Search again" variant="secondary" small style={styles.again} onPress={find} />}

      {/* Switching this off is how you stop sharing. */}
      {generalUntil && (
        <View style={[styles.visible, stopping && styles.dimmed]}>
          <View style={styles.flex}>
            <Text style={styles.h3}>Sharing your intent</Text>
            <Text style={styles.sub}>{visibleLine(generalUntil)}</Text>
          </View>
          <ToggleSwitch on={!stopping} onToggle={stop} label="Sharing your intent" />
        </View>
      )}

      {/* How long to share, chosen before sharing (as "Stay live for"). */}
      {!live && (
        <View style={styles.duration}>
          <View style={styles.durationHead}>
            <Text style={styles.durationTitle}>Share for</Text>
            <Text style={styles.durationValue}>{GENERAL_DURATIONS[durationIndex].label}</Text>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={GENERAL_DURATIONS.length - 1}
            step={1}
            value={durationIndex}
            onValueChange={(i) => {
              const next = GENERAL_DURATIONS[Math.round(i)].ms;
              if (next !== generalDurationMs) haptics.tick();
              setGeneralDurationMs(next);
            }}
            minimumTrackTintColor={colors.brand}
            maximumTrackTintColor={colors.track}
            thumbTintColor={colors.brand}
            accessibilityLabel="Share for"
          />
          <View style={styles.durationStops}>
            {GENERAL_DURATIONS.map((d, i) => (
              <Text key={d.ms} style={[styles.durationStop, i === durationIndex && styles.durationStopOn]}>
                {d.short}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* The event filters don't apply here: only what you're looking for. */}
      <FilterSummary title={live ? 'Looking for' : "You're going live for"} intent={intentText} filters={filters} onChange={openFilter} hideFilters />
      <ConfirmDialog
        visible={needIntent}
        icon={Search}
        tone="info"
        title="Add what you’re looking for"
        message="So Ol-ga can find members anywhere who offer it."
        primaryLabel="Add it"
        onPrimary={() => {
          setNeedIntent(false);
          openFilter();
        }}
        secondaryLabel="Not now"
        onSecondary={() => setNeedIntent(false)}
        onDismiss={() => setNeedIntent(false)}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    row: { flexDirection: 'row' },
    pressed: { opacity: 0.7 },
    header: { minHeight: 30, justifyContent: 'center', alignItems: 'center' },
    title: { fontFamily: fonts.monoBold, fontSize: 11, fontWeight: semibold, letterSpacing: 1.2, color: colors.muted },
    status: { position: 'absolute', left: 0 },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: semibold, color: colors.text },
    lead: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: semibold, color: colors.text, textAlign: 'center' },
    center: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center', marginTop: -6, paddingHorizontal: 8 },
    searching: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    sub: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    error: { color: colors.danger, fontSize: 12, textAlign: 'center' },
    again: { alignSelf: 'center' },
    visible: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 4 },
    dimmed: { opacity: 0.5 },
    // As "Stay live for" on the event screen.
    duration: { gap: 8, paddingHorizontal: 4 },
    durationHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    durationTitle: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.text },
    durationValue: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: semibold, color: colors.text },
    durationStops: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: -4 },
    durationStop: { width: 34, textAlign: 'center', fontSize: 11, color: colors.muted },
    durationStopOn: { color: colors.text, fontWeight: semibold },
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
    avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    avatarNext: { marginLeft: -10 },
    initials: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: AVATAR_INK },
  });

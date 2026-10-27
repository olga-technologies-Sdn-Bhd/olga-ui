import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bluetooth, ChevronRight, Search, Sparkles, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { GENERAL_DURATIONS, MatchCard, MatchingError, MatchingFailure } from '../../api/matching';
import { BleDebugPanel } from '../../components/BleDebugPanel';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { showDialog } from '../../components/DialogHost';
import { FilterSummary } from '../../components/FilterSummary';
import { GoLiveModeSwitch, GoLiveTop, HEADER_ABOVE_WITH_SWITCH } from '../../components/GoLiveModeSwitch';
import { AVATAR_INK, GoLiveRadar, pastelFor, RadarPerson, RadarPhase, useCountUp } from '../../components/GoLiveRadar';
import { NearbyAvatar } from '../../components/NearbyAvatar';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { MATCH_LIMIT } from '../../config/env';
import { useLive } from '../../context/LiveContext';
import { GoLiveMode, useNearby } from '../../context/NearbyContext';
import type { NearbyRequest } from '../../nearby/types';
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

// Bluetooth's own disclosure, before the system prompt (Play's prominent
// disclosure). Shown once; "Not now" still goes live, just not close by.
const NEARBY_CONSENT = {
  title: 'Also find people close by?',
  body: "Ol-ga members a few metres away see your role and what you're looking for over Bluetooth, even offline. Never your name. Only while Ol-ga is open.",
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

// Go Live > Everywhere: no event needed. One hold shares your intent with
// matching members anywhere (general matching, 1 to 30 days, with the switch
// to stop) and, while Ol-ga is open, makes you findable by people close by
// over Bluetooth (Nearby). Both land on the same radar; with no internet,
// only the Bluetooth half runs.
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
  const { available: nearbyOn, setAvailable, grantConsent, people: nearbyPeople, requests, ble, online } = useNearby();
  const [searching, setSearching] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'intent' | 'nearby' | null>(null);
  const durationIndex = Math.max(0, GENERAL_DURATIONS.findIndex((d) => d.ms === generalDurationMs));
  const offline = online === false;

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
  const openNearby = useCallback(() => navigation.navigate('NearbyPeople'), [navigation]);
  const openRequest = (r: NearbyRequest) => navigation.navigate('NearbyRequest', { requestId: r.id });

  // Event needs internet: offline, stay here and say why (briefly).
  const [offlineNote, setOfflineNote] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trySwitch = (next: GoLiveMode) => {
    if (offline) {
      setOfflineNote(true);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setOfflineNote(false), 4000);
      return;
    }
    onSwitchMode(next);
  };
  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);
  useEffect(() => {
    if (online) setOfflineNote(false);
  }, [online]);

  // The hold: close by first (it needs no internet), then anywhere.
  async function goLive() {
    if (searching) return;
    if (!intentText.trim()) {
      setDialog('intent');
      return;
    }
    if (!nearbyOn) {
      const result = await setAvailable(true);
      if (result === 'NEED_CONSENT') {
        setDialog('nearby');
        return;
      }
    }
    afterNearby();
  }

  function afterNearby() {
    if (!offline) find();
  }

  function allowNearby() {
    setDialog(null);
    grantConsent();
    // Consent is saved in the same tick: give it a moment to land.
    setTimeout(async () => {
      await setAvailable(true);
      afterNearby();
    }, 0);
  }

  function skipNearby() {
    setDialog(null);
    afterNearby();
  }

  async function find() {
    if (searching) return;
    if (!intentText.trim()) {
      setDialog('intent');
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

  // One switch ends both: Bluetooth at once, sharing once Ol-ga confirms.
  async function stop() {
    if (stopping || searching) return;
    if (nearbyOn) setAvailable(false);
    if (!generalUntil) {
      haptics.success();
      return;
    }
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

  const goLiveRef = useRef(goLive);
  goLiveRef.current = goLive;
  const findRef = useRef(find);
  findRef.current = find;
  useEffect(() => {
    if (sharing && generalMatches === null && !autoSearched.current && intentText.trim()) {
      autoSearched.current = true;
      findRef.current();
    }
  }, [sharing, generalMatches, intentText]);
  const onHoldComplete = useCallback(() => {
    goLiveRef.current();
  }, []);

  const shown = useMemo(() => (generalMatches ?? []).slice(0, MATCH_LIMIT), [generalMatches]);
  const close = useMemo(() => nearbyPeople.slice(0, MATCH_LIMIT), [nearbyPeople]);
  // One radar for both: people close by, then the rest of those found anywhere.
  const people = useMemo<RadarPerson[]>(() => {
    const near = close.map((p) => ({ id: p.card.m, initials: p.card.i }));
    const far = shown.filter((card) => !near.some((n) => n.id === card.match.member_id)).map((card) => ({ id: card.match.member_id, initials: initialsFor(card) }));
    return [...near, ...far].slice(0, MATCH_LIMIT);
  }, [close, shown]);
  const count = people.length;
  const counted = useCountUp(shown.length, !searching && shown.length > 0);
  const countedNear = useCountUp(close.length, nearbyOn && close.length > 0);
  const live = sharing || nearbyOn;
  const phase: RadarPhase = searching
    ? 'searching'
    : !live
      ? 'idle'
      : count > 0
        ? 'found'
        : generalMatches !== null && !nearbyOn
          ? 'empty'
          : 'live';
  const openFound = useCallback(() => (shown.length > 0 ? openMatches() : openNearby()), [shown.length, openMatches, openNearby]);

  const incoming = requests.filter((r) => r.direction === 'in' && r.status === 'pending');
  // One row per person, however many Commits went between you.
  const recent = requests
    .filter((r) => r.status === 'accepted')
    .filter((r, i, all) => all.findIndex((x) => x.peer.m === r.peer.m) === i)
    .slice(0, 3);

  const bluetoothNote =
    !nearbyOn || ble.bluetooth === 'on' || ble.bluetooth === 'unknown'
      ? null
      : ble.bluetooth === 'off'
        ? 'Bluetooth is off. Turn it on so people close by can find you.'
        : ble.bluetooth === 'unauthorized'
          ? 'Allow Nearby devices for Ol-ga in Settings so people close by can find you.'
          : "This phone can't use Bluetooth, so only members anywhere can find you.";

  const visibleSub = generalUntil
    ? `${visibleLine(generalUntil)}${nearbyOn ? ' Also people close by, over Bluetooth.' : ''}`
    : 'Visible to people close by, over Bluetooth, while Ol-ga is open. Your role, never your name.';

  return (
    <Screen
      renderHeader={(scrollY) => (
        // Sharing runs for days in the background: Event stays open.
        <GoLiveTop scrollY={scrollY} modeSwitch={<GoLiveModeSwitch mode="anywhere" onChange={trySwitch} disabled={searching} offline={offline} scrollY={scrollY} />}>
          <View style={styles.header}>
            <Text style={styles.title}>EVERYWHERE</Text>
            {live && (
              <View style={styles.status}>
                <Pill label="● LIVE" tone="positive" />
              </View>
            )}
          </View>
        </GoLiveTop>
      )}
    >
      {offlineNote && (
        <View style={styles.offlineNote} accessibilityLiveRegion="polite">
          <WifiOff size={14} color={colors.muted} strokeWidth={2} />
          <Text style={styles.offlineNoteText}>Event needs internet. People close by still find you.</Text>
        </View>
      )}

      <GoLiveRadar
        phase={phase}
        people={people}
        disabled={searching}
        onHoldComplete={onHoldComplete}
        onOpenMatches={openFound}
        headerAbove={HEADER_ABOVE_WITH_SWITCH}
      />

      {phase === 'idle' && (
        <>
          <Text style={styles.lead}>Press and hold to Go Live</Text>
          <Text style={styles.center}>No event needed. Members anywhere who can help, and people close by, appear here. Only they can see you.</Text>
        </>
      )}
      {phase === 'searching' && <Text style={styles.searching}>Finding the most relevant people…</Text>}
      {phase === 'live' && nearbyOn && (
        <>
          <Text style={styles.lead}>{generalMatches?.length === 0 ? 'No matches anywhere yet' : 'Looking around you…'}</Text>
          <Text style={styles.center}>Keep Ol-ga open. People close by appear as they come near.</Text>
        </>
      )}
      {phase === 'found' && shown.length > 0 && (
        <Pressable
          onPress={openMatches}
          accessibilityRole="button"
          accessibilityLabel={`Relevant people found. ${shown.length} great ${shown.length === 1 ? 'connection' : 'connections'}. Open the list`}
          style={({ pressed }) => [styles.found, pressed && styles.pressed]}
        >
          <View style={styles.row}>
            {shown.slice(0, Math.min(3, counted)).map((card, i) => (
              <View key={card.match.member_id} style={[styles.avatar, { backgroundColor: pastelFor(card.match.member_id) }, i > 0 && styles.avatarNext]}>
                <Text style={styles.initials}>{initialsFor(card)}</Text>
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
      {phase === 'found' && close.length > 0 && (
        <Pressable
          onPress={openNearby}
          accessibilityRole="button"
          accessibilityLabel={`${close.length} ${close.length === 1 ? 'person' : 'people'} close by. Open`}
          style={({ pressed }) => [styles.found, pressed && styles.pressed]}
        >
          <View style={styles.row}>
            {close.slice(0, Math.min(3, countedNear)).map((p, i) => (
              <View key={p.card.m} style={[styles.stacked, i > 0 && styles.avatarNext]}>
                <NearbyAvatar card={p.card} size={38} />
              </View>
            ))}
          </View>
          <View style={styles.flex}>
            <Text style={styles.h3}>People close by</Text>
            <Text style={styles.sub}>
              {Math.max(1, countedNear)} {countedNear <= 1 ? 'person matches' : 'people match'} what you're looking for
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
      {bluetoothNote && <Text style={styles.error}>{bluetoothNote}</Text>}
      {nearbyOn && offline && (
        <Text style={styles.center}>No internet. People close by still find you over Bluetooth; Commits are saved to Ol-ga when you're back online.</Text>
      )}
      {sharing && !searching && generalMatches !== null && <Button label="Search again" variant="secondary" small style={styles.again} onPress={find} />}
      {/* Live close by only (matching declined or failed): share anywhere too. */}
      {nearbyOn && !sharing && !searching && !offline && <Button label="Share anywhere too" variant="secondary" small style={styles.again} onPress={find} />}

      {incoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Wants to meet you</Text>
          {incoming.map((r) => (
            <Pressable key={r.id} onPress={() => openRequest(r)} style={({ pressed }) => [styles.request, pressed && styles.pressed]}>
              <NearbyAvatar card={r.peer} />
              <View style={styles.flex}>
                <Text style={styles.h3} numberOfLines={1}>
                  {r.peer.h}
                </Text>
                <Text style={styles.sub} numberOfLines={2}>
                  {r.peer.w}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      )}

      {recent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Connected close by</Text>
          {recent.map((r) => (
            <Pressable key={r.id} onPress={() => openRequest(r)} style={({ pressed }) => [styles.request, pressed && styles.pressed]}>
              <NearbyAvatar card={r.peer} />
              <View style={styles.flex}>
                <Text style={styles.h3} numberOfLines={1}>
                  {r.peerName || r.peer.h}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {r.peerName ? r.peer.h : 'Name appears once they’re back online'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Switching this off is how you stop: sharing and close by together. */}
      {live && (
        <View style={[styles.visible, stopping && styles.dimmed]}>
          <View style={styles.flex}>
            <Text style={styles.h3}>{sharing ? 'Sharing your intent' : 'Visible close by'}</Text>
            <Text style={styles.sub}>{visibleSub}</Text>
          </View>
          <ToggleSwitch on={!stopping} onToggle={stop} label="Go Live everywhere" />
        </View>
      )}

      {/* How long to share, chosen before sharing (as "Stay live for"). */}
      {!sharing && !searching && !offline && (
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
      {nearbyOn && <BleDebugPanel />}
      <ConfirmDialog
        visible={dialog === 'nearby'}
        icon={Bluetooth}
        tone="info"
        title={NEARBY_CONSENT.title}
        message={NEARBY_CONSENT.body}
        primaryLabel="Allow"
        onPrimary={allowNearby}
        secondaryLabel="Not now"
        onSecondary={skipNearby}
        onDismiss={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'intent'}
        icon={Search}
        tone="info"
        title="Add what you’re looking for"
        message="So Ol-ga can find the people who offer it."
        primaryLabel="Add it"
        onPrimary={() => {
          setDialog(null);
          openFilter();
        }}
        secondaryLabel="Not now"
        onSecondary={() => setDialog(null)}
        onDismiss={() => setDialog(null)}
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
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: semibold },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: semibold, color: colors.text },
    lead: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: semibold, color: colors.text, textAlign: 'center' },
    center: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center', marginTop: -6, paddingHorizontal: 8 },
    searching: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    sub: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    error: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
    again: { alignSelf: 'center' },
    offlineNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    offlineNoteText: { fontSize: 12, color: colors.muted },
    section: { gap: 8 },
    request: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
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
    stacked: { borderRadius: 21, borderWidth: 2, borderColor: colors.surface },
    initials: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: AVATAR_INK },
  });

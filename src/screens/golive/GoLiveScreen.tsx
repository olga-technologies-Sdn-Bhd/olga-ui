import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { MatchingError, MatchingFailure } from '../../api/matching';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { PulseRings } from '../../components/PulseRings';
import { RemovableTag } from '../../components/RemovableTag';
import { Screen } from '../../components/Screen';
import { TagInput } from '../../components/TagInput';
import { ProgressBar } from '../../components/ProgressBar';
import { GoLiveBlocker, useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'GoLive'>;

// Matches the prototype's `startLiveSearch()` step timings.
const SEARCH_STEPS: Array<{ delay: number; text: string }> = [
  { delay: 0, text: "You're live. Looking around the room" },
  { delay: 1200, text: 'Checking people against your intent' },
  { delay: 2600, text: 'Ranking your strongest matches' },
  { delay: 3900, text: 'Found people worth meeting' },
];

// Minimum time the searching animation plays before navigating on, even if
// the API responds sooner — keeps the choreographed steps from being cut off.
const SEARCH_DURATION_MS = 5000;

const QUICK_TAGS = ['Partnerships', 'Investors', 'Hiring', 'Customers'];

const IDLE_TEXT = 'Nobody can see you yet. Tap to become visible.';

const BLOCKER_MESSAGES: Record<Exclude<GoLiveBlocker, 'CONSENT_REQUIRED'>, string> = {
  REGISTRATION_REQUIRED: 'Sign up for this event first, then you can go live.',
  EVENT_NOT_ACTIVE: 'This event has ended.',
  LIVE_MODE_NOT_ENABLED: "Live Mode isn't available for this event.",
  EVENT_NOT_FOUND: 'This event was cancelled.',
  TAKEN_OFFLINE: "You've been taken offline. Contact support if you think this is a mistake.",
};

const MATCHING_MESSAGES: Record<MatchingFailure, string> = {
  INTENT_HAS_PII: 'Your intent includes personal details. Edit it on Home, then try again.',
  INTENT_FAILED: "We couldn't read your intent. Try rephrasing it on Home.",
  MATCHING_FAILED: "You're live, but matching failed. Try again in a moment.",
  TIMED_OUT: "You're live. Matching is taking longer than usual; check Live matches shortly.",
};

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function GoLiveScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    activeEvent,
    isLive,
    activeUntil,
    goLive,
    grantLiveModeConsent,
    stopLive,
    runMatching,
    filters,
    sessionTags,
    addSessionTag,
    removeSessionTag,
    intentText,
  } = useLive();
  const [searching, setSearching] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [statusText, setStatusText] = useState(IDLE_TEXT);
  const [error, setError] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!searching) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 575, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 575, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [searching, pulse]);

  async function handleGoLive() {
    if (!activeEvent) return;
    if (!intentText.trim()) {
      setError("Add what you're looking for on Home first, so we can find your matches.");
      return;
    }
    setSearching(true);
    setError(null);
    setStatusText(SEARCH_STEPS[0].text);
    const stepTimers = SEARCH_STEPS.slice(1).map(({ delay, text }) => setTimeout(() => setStatusText(text), delay));
    const reset = () => {
      stepTimers.forEach(clearTimeout);
      setSearching(false);
    };

    try {
      const blocker = await goLive();
      if (blocker) {
        reset();
        setStatusText(IDLE_TEXT);
        if (blocker === 'CONSENT_REQUIRED') askForConsent();
        else setError(BLOCKER_MESSAGES[blocker]);
        return;
      }
      // Live now; matching failures keep the member live and explain why.
      try {
        const [found] = await Promise.all([runMatching(), wait(SEARCH_DURATION_MS)]);
        reset();
        navigation.navigate(found.length ? 'LiveMatches' : 'EmptyRoom');
      } catch (e) {
        reset();
        if (e instanceof MatchingError) setError(MATCHING_MESSAGES[e.reason]);
        else setError(e instanceof ApiError && e.status > 0 ? `You're live, but matching failed (${e.status})` : "You're live, but we couldn't reach matching");
      }
    } catch (e) {
      reset();
      setStatusText(IDLE_TEXT);
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't go live (${e.status})` : "Couldn't reach the server");
    }
  }

  // Live Mode needs a LIVE_MODE consent on record (403 LIVE_MODE_CONSENT_REQUIRED).
  function askForConsent() {
    Alert.alert(
      'Allow Live Mode?',
      "While you're live, people at this event who match your intent can see you're here. You can stop anytime.",
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

  async function handleStopLive() {
    setStopping(true);
    setError(null);
    try {
      await stopLive();
      setStatusText(IDLE_TEXT);
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't stop Live Mode (${e.status})` : "Couldn't reach the server");
    } finally {
      setStopping(false);
    }
  }

  if (!activeEvent) {
    return (
      <Screen>
        <Text style={styles.h2}>Go Live</Text>
        <Card>
          <Text style={styles.sub}>
            Pick an event from the Events tab and tap "Go Live in this room" to become discoverable there.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>{activeEvent.name}</Text>
          <Text style={styles.h2}>{isLive ? "You're live" : 'Ready when you are'}</Text>
        </View>
        {typeof activeEvent.liveCount === 'number' && <Pill label={`● ${activeEvent.liveCount} live`} tone="positive" />}
      </View>

      <View style={styles.ringWrap}>
        {/* Live ring is always green — the live signal, independent of whatever disc colour is picked. */}
        <PulseRings active={searching} size={132} maxScale={1.75} color={colors.liveFill} />
        <View style={styles.halo2}>
          <View style={styles.halo1}>
            <Animated.View style={[styles.ring, { transform: [{ scale: pulse }] }]}>
              <Button
                label={searching ? 'SEARCHING' : isLive ? 'STOP' : 'GO LIVE'}
                onPress={isLive ? handleStopLive : handleGoLive}
                disabled={searching || stopping}
                style={styles.ringButton}
              />
            </Animated.View>
          </View>
        </View>
      </View>

      <Text style={styles.status}>
        {isLive && !searching && activeUntil ? `You're visible in this room until ${formatTime(activeUntil)}.` : statusText}
      </Text>

      {error && <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text>}

      <Text style={styles.sectionTitle}>Who you want to meet</Text>
      <Card>
        <View style={styles.filtersRow}>
          <Text style={styles.eyebrow}>Active filter</Text>
          <Button label="Change" variant="ghost" small onPress={() => navigation.navigate('Filters')} />
        </View>
        {filters.lookingFor.length > 0 && (
          <View style={styles.tags}>
            {filters.lookingFor.map((tag) => (
              <Pill key={tag} label={tag} tone="active" />
            ))}
          </View>
        )}
        <View style={[styles.filtersRow, { marginTop: 16 }]}>
          <Text style={styles.sub}>Minimum match</Text>
          <Text style={styles.matchValue}>{filters.minMatch}%</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <ProgressBar percent={filters.minMatch} />
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Add tags for this session</Text>
      <Card>
        <Text style={styles.h3}>What are you open to right now?</Text>
        <Text style={styles.sub}>Add quick tags so people can understand your current context before sending a commit.</Text>

        {sessionTags.length > 0 && (
          <View style={styles.tags}>
            {sessionTags.map((tag) => (
              <RemovableTag key={tag} label={tag} onRemove={() => removeSessionTag(tag)} />
            ))}
          </View>
        )}

        <View style={{ marginTop: 12 }}>
          <TagInput placeholder="e.g. Co-founder, Sales, Funding" onAdd={addSessionTag} />
        </View>

        <View style={styles.tags}>
          {QUICK_TAGS.map((tag) => (
            <Pill key={tag} label={`+ ${tag}`} onPress={() => addSessionTag(tag)} />
          ))}
        </View>
      </Card>

      {isLive && <Button label="See live matches" variant="secondary" onPress={() => navigation.navigate('LiveMatches')} />}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 26 },
  halo2: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo1: {
    width: 146,
    height: 146,
    borderRadius: 73,
    backgroundColor: colors.tint2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    borderColor: colors.tintLine,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  ringButton: { width: 92, height: 92, borderRadius: 46, paddingHorizontal: 0 },
  status: { textAlign: 'center', color: colors.muted, fontSize: 13, minHeight: 36 },
  sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 10 },
  filtersRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  matchValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});

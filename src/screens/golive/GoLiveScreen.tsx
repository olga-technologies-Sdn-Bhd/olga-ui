import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { coreApi } from '../../api/core';
import { intentIdFor, nlpApi } from '../../api/nlp';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { PulseRings } from '../../components/PulseRings';
import { RemovableTag } from '../../components/RemovableTag';
import { Screen } from '../../components/Screen';
import { TagInput } from '../../components/TagInput';
import { ProgressBar } from '../../components/ProgressBar';
import { useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

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

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function GoLiveScreen({ navigation }: Props) {
  const { activeEvent, isLive, setIsLive, filters, sessionTags, addSessionTag, removeSessionTag } = useLive();
  const [searching, setSearching] = useState(false);
  const [statusText, setStatusText] = useState('Nobody can see you yet. Tap to become visible.');
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
    setSearching(true);
    setError(null);
    setStatusText(SEARCH_STEPS[0].text);
    const stepTimers = SEARCH_STEPS.slice(1).map(({ delay, text }) => setTimeout(() => setStatusText(text), delay));

    try {
      const [result] = await Promise.all([
        (async () => {
          await coreApi.startLiveMode(activeEvent.eventId, {});
          setIsLive(true);
          return nlpApi.requestMatches({
            intent_id: intentIdFor(activeEvent.eventId, 'WANT'),
            context_id: activeEvent.eventId,
            options: { threshold: filters.minMatch / 100 },
          });
        })(),
        wait(SEARCH_DURATION_MS),
      ]);
      navigation.navigate(result.matches?.length ? 'LiveMatches' : 'EmptyRoom');
    } catch (e) {
      setError(e instanceof ApiError && e.status > 0 ? `Couldn't go live (${e.status})` : "Couldn't reach the server");
    } finally {
      stepTimers.forEach(clearTimeout);
      setSearching(false);
    }
  }

  async function handleStopLive() {
    if (!activeEvent) return;
    try {
      await coreApi.stopLiveMode(activeEvent.eventId);
    } catch {
      // best-effort — still reflect stopped state locally
    }
    setIsLive(false);
    setStatusText('Nobody can see you yet. Tap to become visible.');
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
        {typeof activeEvent.liveCount === 'number' && <Pill label={`● ${activeEvent.liveCount} live`} tone="green" />}
      </View>

      <View style={styles.ringWrap}>
        <PulseRings active={searching} size={132} maxScale={1.75} />
        <View style={styles.halo2}>
          <View style={styles.halo1}>
            <Animated.View style={[styles.ring, { transform: [{ scale: pulse }] }]}>
              <Button
                label={searching ? 'SEARCHING' : isLive ? 'STOP' : 'GO LIVE'}
                onPress={isLive ? handleStopLive : handleGoLive}
                disabled={searching}
                style={styles.ringButton}
              />
            </Animated.View>
          </View>
        </View>
      </View>

      <Text style={styles.status}>{isLive ? statusText || "You're visible to others live in this room." : statusText}</Text>

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

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  h3: { fontSize: 15, fontWeight: '700', color: colors.text },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 26 },
  halo2: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: '#f7f4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo1: {
    width: 146,
    height: 146,
    borderRadius: 73,
    backgroundColor: '#faf8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    borderColor: '#e8e1ff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  ringButton: { width: 92, height: 92, borderRadius: 46, paddingHorizontal: 0 },
  status: { textAlign: 'center', color: colors.muted, fontSize: 13, minHeight: 36 },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 10 },
  filtersRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  matchValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});

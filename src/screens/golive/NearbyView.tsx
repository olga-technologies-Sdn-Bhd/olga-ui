import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useMemo, useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BleDebugPanel } from '../../components/BleDebugPanel';
import { FilterSummary } from '../../components/FilterSummary';
import { AVATAR_INK, GoLiveRadar, pastelFor, RadarPerson, RadarPhase, useCountUp } from '../../components/GoLiveRadar';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { MATCH_LIMIT } from '../../config/env';
import { useLive } from '../../context/LiveContext';
import { GoLiveMode, useNearby } from '../../context/NearbyContext';
import type { NearbyCard, NearbyRequest } from '../../nearby/types';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

const NEARBY_CONSENT = {
  title: 'Allow Nearby?',
  body: "While you're available, Ol-ga members close to you can see your role and what you're looking for, over Bluetooth, even without internet. Never your name. You can go invisible anytime.",
};

const VISIBLE_LINE = 'Role and intent only, never your name.';

// The mode switch sits between the header and the radar; the radar flies the
// wordmark up to the header row, so it needs to know (its default, 27, is for
// the header alone). Header half-height 15 + gap 12 + switch 34 + gap 12.
const SWITCH_HEIGHT = 34;
export const HEADER_ABOVE_WITH_SWITCH = 15 + 12 + SWITCH_HEIGHT + 12;

// The person's initials on their pastel, as on the radar.
export function NearbyAvatar({ card, size = 40 }: { card: NearbyCard; size?: number }) {
  return (
    <View style={[avatarStyles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: pastelFor(card.m) }]}>
      <Text style={[avatarStyles.initials, { fontSize: size * 0.36 }]}>{card.i}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bodyBold, fontWeight: '600', color: AVATAR_INK },
});

// "This event | Nearby", when the member has an event to go live in.
export function GoLiveModeSwitch({ mode, onChange, disabled }: { mode: GoLiveMode; onChange: (mode: GoLiveMode) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const option = (value: GoLiveMode, label: string) => (
    <Pressable
      onPress={() => !disabled && onChange(value)}
      accessibilityRole="tab"
      accessibilityState={{ selected: mode === value, disabled }}
      style={[styles.switchOption, mode === value && styles.switchOn]}
    >
      <Text style={[styles.switchText, mode === value && styles.switchTextOn]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.switch, disabled && styles.dimmed]}>
      {option('event', 'This event')}
      {option('nearby', 'Nearby')}
    </View>
  );
}

type Props = {
  navigation: NativeStackNavigationProp<GoLiveStackParamList, 'GoLive'>;
  // Shown when the member also has an event room.
  onSwitchToEvent?: () => void;
};

// Go Live without an event: be found by, and find, Ol-ga members close by.
export function NearbyView({ navigation, onSwitchToEvent }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { intentText, filters } = useLive();
  const { available, setAvailable, grantConsent, people, requests, ble, online } = useNearby();

  const openFilter = () => navigation.navigate('Filters');
  const openPeople = useCallback(() => navigation.navigate('NearbyPeople'), [navigation]);
  const openRequest = (r: NearbyRequest) => navigation.navigate('NearbyRequest', { requestId: r.id });

  async function goAvailable() {
    const result = await setAvailable(true);
    if (result === 'NEED_INTENT') {
      Alert.alert('Add what you’re looking for', 'So people nearby who match it can find you.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Add it', onPress: openFilter },
      ]);
    } else if (result === 'NEED_CONSENT') {
      Alert.alert(NEARBY_CONSENT.title, NEARBY_CONSENT.body, [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Allow',
          onPress: () => {
            grantConsent();
            // Consent is saved in the same tick: give it a moment to land.
            setTimeout(() => setAvailable(true), 0);
          },
        },
      ]);
    }
  }
  const holdRef = useRef(goAvailable);
  holdRef.current = goAvailable;
  const onHoldComplete = useCallback(() => {
    holdRef.current();
  }, []);

  const shown = people.slice(0, MATCH_LIMIT);
  const radarPeople = useMemo<RadarPerson[]>(() => shown.map((p) => ({ id: p.card.m, initials: p.card.i })), [shown]);
  const count = shown.length;
  const counted = useCountUp(count, available && count > 0);
  const phase: RadarPhase = !available ? 'idle' : count > 0 ? 'found' : 'live';

  const incoming = requests.filter((r) => r.direction === 'in' && r.status === 'pending');
  // One row per person, however many Commits went between you.
  const recent = requests
    .filter((r) => r.status === 'accepted')
    .filter((r, i, all) => all.findIndex((x) => x.peer.m === r.peer.m) === i)
    .slice(0, 3);

  const bluetoothNote =
    !available || ble.bluetooth === 'on' || ble.bluetooth === 'unknown'
      ? null
      : ble.bluetooth === 'off'
        ? 'Bluetooth is off. Turn it on so people nearby can find you.'
        : ble.bluetooth === 'unauthorized'
          ? 'Allow Nearby devices for Ol-ga in Settings so people close by can find you.'
          : "This phone can't use Bluetooth for Nearby.";

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eventName}>NEARBY</Text>
        {available && (
          <View style={styles.status}>
            <Pill label="● AVAILABLE" tone="positive" />
          </View>
        )}
      </View>

      {onSwitchToEvent && <GoLiveModeSwitch mode="nearby" onChange={(m) => m === 'event' && onSwitchToEvent()} disabled={available} />}

      <GoLiveRadar
        phase={phase}
        people={radarPeople}
        onHoldComplete={onHoldComplete}
        onOpenMatches={openPeople}
        headerAbove={onSwitchToEvent ? HEADER_ABOVE_WITH_SWITCH : undefined}
      />

      {phase === 'idle' && (
        <>
          <Text style={styles.lead}>Press and hold to Go Live nearby</Text>
          <Text style={styles.center}>Ol-ga members close to you who match what you're looking for appear here. Works over Bluetooth, even without internet.</Text>
        </>
      )}
      {phase === 'live' && (
        <>
          <Text style={styles.lead}>Looking around you…</Text>
          <Text style={styles.center}>Keep Ol-ga open. People appear as they come close and go available.</Text>
        </>
      )}
      {phase === 'found' && (
        <Pressable
          onPress={openPeople}
          accessibilityRole="button"
          accessibilityLabel={`${count} ${count === 1 ? 'person' : 'people'} nearby. Open`}
          style={({ pressed }) => [styles.found, pressed && styles.pressed]}
        >
          <View style={styles.row}>
            {shown.slice(0, Math.min(3, counted)).map((p, i) => (
              <View key={p.card.m} style={[styles.stacked, i > 0 && styles.stackedNext]}>
                <NearbyAvatar card={p.card} size={38} />
              </View>
            ))}
          </View>
          <View style={styles.flex}>
            <Text style={styles.h3}>People nearby</Text>
            <Text style={styles.sub}>
              {Math.max(1, counted)} {counted <= 1 ? 'person matches' : 'people match'} what you're looking for
            </Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      )}

      {bluetoothNote && <Text style={styles.warn}>{bluetoothNote}</Text>}
      {available && online === false && (
        <Text style={styles.center}>No internet. Nearby still works over Bluetooth; Commits are saved to Ol-ga when you're back online.</Text>
      )}

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
          <Text style={styles.eyebrow}>Connected nearby</Text>
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

      {/* Switching this off is how you go invisible. */}
      {available && (
        <View style={styles.visible}>
          <View style={styles.flex}>
            <Text style={styles.h3}>Visible to people nearby</Text>
            <Text style={styles.sub}>{VISIBLE_LINE}</Text>
          </View>
          <ToggleSwitch on onToggle={() => setAvailable(false)} label="Visible to people nearby" />
        </View>
      )}

      <FilterSummary title={available ? 'Available for' : "You're going live for"} intent={intentText} filters={filters} onChange={openFilter} />
      {available && <BleDebugPanel />}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    row: { flexDirection: 'row' },
    pressed: { opacity: 0.7 },
    dimmed: { opacity: 0.5 },
    header: { minHeight: 30, justifyContent: 'center', alignItems: 'center' },
    eventName: { fontFamily: fonts.monoBold, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: colors.muted },
    status: { position: 'absolute', left: 0 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: '700', color: colors.text },
    lead: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
    center: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center', marginTop: -6, paddingHorizontal: 8 },
    warn: { fontSize: 12, lineHeight: 18, color: colors.danger, textAlign: 'center', paddingHorizontal: 8 },
    sub: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
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
    stacked: { borderRadius: 21, borderWidth: 2, borderColor: colors.surface },
    stackedNext: { marginLeft: -10 },
    visible: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 4 },
    switch: { flexDirection: 'row', alignSelf: 'center', height: SWITCH_HEIGHT, backgroundColor: colors.surface2, borderRadius: 999, padding: 3 },
    switchOption: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999 },
    switchOn: { backgroundColor: colors.surface },
    switchText: { fontSize: 12, fontWeight: '600', color: colors.muted },
    switchTextOn: { color: colors.text },
  });

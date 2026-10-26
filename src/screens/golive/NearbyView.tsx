import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bluetooth, ChevronRight, Info, Search, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BleDebugPanel } from '../../components/BleDebugPanel';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FilterSummary } from '../../components/FilterSummary';
import { GoLiveModeSwitch, GoLiveTop, HEADER_ABOVE_WITH_SWITCH } from '../../components/GoLiveModeSwitch';
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
import { fonts, semibold } from '../../theme/typography';

const NEARBY_CONSENT = {
  title: 'Allow Nearby?',
  body: "Ol-ga members close by see your role and what you're looking for over Bluetooth, even offline. Never your name. End it anytime.",
};

const VISIBLE_LINE = "Your role and what you're looking for. Never your name.";

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
  initials: { fontFamily: fonts.bodyBold, fontWeight: semibold, color: AVATAR_INK },
});

type Props = {
  navigation: NativeStackNavigationProp<GoLiveStackParamList, 'GoLive'>;
  // Event or Anywhere picked on the mode switch.
  onSwitchMode: (mode: GoLiveMode) => void;
};

// Go Live without an event: be found by, and find, Ol-ga members close by.
export function NearbyView({ navigation, onSwitchMode }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { intentText, filters } = useLive();
  const { available, setAvailable, grantConsent, people, requests, ble, online } = useNearby();

  const openFilter = () => navigation.navigate('Filters');
  const openPeople = useCallback(() => navigation.navigate('NearbyPeople'), [navigation]);
  const openRequest = (r: NearbyRequest) => navigation.navigate('NearbyRequest', { requestId: r.id });

  // In the app's own dialog style (not the system alert).
  const [dialog, setDialog] = useState<'intent' | 'consent' | null>(null);

  // Event and Anywhere need internet: offline, stay on Nearby and say why (briefly).
  const [offlineNote, setOfflineNote] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trySwitch = (next: GoLiveMode) => {
    if (online === false) {
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
  // Back online: the note no longer applies.
  useEffect(() => {
    if (online) setOfflineNote(false);
  }, [online]);

  // The "how it works" line lives in a hint bubble behind the (i).
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleHint = () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint((open) => {
      if (!open) hintTimer.current = setTimeout(() => setHint(false), 6000);
      return !open;
    });
  };
  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  async function goAvailable() {
    const result = await setAvailable(true);
    if (result === 'NEED_INTENT') setDialog('intent');
    else if (result === 'NEED_CONSENT') setDialog('consent');
  }

  function allowNearby() {
    setDialog(null);
    grantConsent();
    // Consent is saved in the same tick: give it a moment to land.
    setTimeout(() => setAvailable(true), 0);
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
    <Screen
      renderHeader={(scrollY) => (
        <GoLiveTop scrollY={scrollY} modeSwitch={<GoLiveModeSwitch mode="nearby" onChange={trySwitch} disabled={available} offline={online === false} scrollY={scrollY} />}>
          <View style={styles.header}>
            <Text style={styles.eventName}>NEARBY</Text>
            {available && (
              <View style={styles.status}>
                <Pill label="● AVAILABLE" tone="positive" />
              </View>
            )}
          </View>
        </GoLiveTop>
      )}
    >
      {offlineNote && (
        <View style={styles.offlineNote} accessibilityLiveRegion="polite">
          <WifiOff size={14} color={colors.muted} strokeWidth={2} />
          <Text style={styles.offlineNoteText}>Event and Anywhere need internet. Nearby works without it.</Text>
        </View>
      )}

      <GoLiveRadar
        phase={phase}
        people={radarPeople}
        onHoldComplete={onHoldComplete}
        onOpenMatches={openPeople}
        headerAbove={HEADER_ABOVE_WITH_SWITCH}
      />

      {phase === 'idle' && (
        <>
          <Pressable
            onPress={toggleHint}
            style={styles.leadRow}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Press and hold to Go Live nearby. How it works"
            accessibilityState={{ expanded: hint }}
          >
            <Text style={styles.lead}>Press and hold to Go Live nearby</Text>
            <Info size={16} color={colors.muted} strokeWidth={2} />
          </Pressable>
          {hint && (
            <Pressable onPress={toggleHint} style={styles.hintWrap} accessibilityRole="text">
              <View style={styles.hintArrow} />
              <View style={styles.hintBubble}>
                <Text style={styles.hintText}>
                  Ol-ga members close to you who match what you're looking for appear here. Works over Bluetooth, even without internet.
                </Text>
              </View>
            </Pressable>
          )}
        </>
      )}
      {phase === 'live' && (
        <>
          <Text style={styles.lead}>Looking around you…</Text>
          <Text style={styles.center}>Keep Ol-ga open. People appear as they come close and go live.</Text>
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
      <ConfirmDialog
        visible={dialog === 'consent'}
        icon={Bluetooth}
        tone="info"
        title={NEARBY_CONSENT.title}
        message={NEARBY_CONSENT.body}
        primaryLabel="Allow"
        onPrimary={allowNearby}
        secondaryLabel="Not now"
        onSecondary={() => setDialog(null)}
        onDismiss={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'intent'}
        icon={Search}
        tone="info"
        title="Add what you’re looking for"
        message="So people nearby who match it can find you."
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
    dimmed: { opacity: 0.5 },
    header: { minHeight: 30, justifyContent: 'center', alignItems: 'center' },
    eventName: { fontFamily: fonts.monoBold, fontSize: 11, fontWeight: semibold, letterSpacing: 1.2, color: colors.muted },
    status: { position: 'absolute', left: 0 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: semibold },
    h3: { fontFamily: fonts.headingBold, fontSize: 14, fontWeight: semibold, color: colors.text },
    lead: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: semibold, color: colors.text, textAlign: 'center' },
    leadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center' },
    // The hint: a white bubble with a hairline, pointing up at the line above.
    hintWrap: { alignItems: 'center', marginTop: -4 },
    hintArrow: {
      width: 12,
      height: 12,
      backgroundColor: colors.surface,
      borderLeftWidth: 1,
      borderTopWidth: 1,
      borderColor: colors.line,
      transform: [{ rotate: '45deg' }],
      marginBottom: -7,
      zIndex: 1,
    },
    hintBubble: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      maxWidth: 320,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    hintText: { fontSize: 13, lineHeight: 19, color: colors.text, textAlign: 'center' },
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
  });

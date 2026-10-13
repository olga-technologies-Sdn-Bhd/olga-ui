import { useIsFocused } from '@react-navigation/native';
import { Radio } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';

// idle: press and hold. searching: live, looking. found: live, with matches.
// empty: live, searched, nobody yet. live: live with nothing to show (e.g.
// matching failed), so the radar rests.
export type RadarPhase = 'idle' | 'searching' | 'found' | 'empty' | 'live';
export type RadarPerson = { id: string; initials: string };

type Props = {
  phase: RadarPhase;
  people: RadarPerson[];
  disabled?: boolean;
  onHoldComplete: () => void;
  // Tapping the live button once matches are in.
  onOpenMatches?: () => void;
};

// Geometry, in dp. The button rests a little low and rises when live, to the
// centre of the radar.
const BUTTON = 168;
const RING_GAP = 7; // thin outer border / hold progress, just outside the button
const LIFT = 40;
const LIVE_SCALE = 0.82;
const BRAND_H = 34;
const BRAND_GAP = 14;
const STAGE_H = 330;
const LIVE_CY = 160;
const IDLE_CY = LIVE_CY + LIFT;
const LIVE_R = (BUTTON / 2) * LIVE_SCALE;
// How far the ripples travel from the button before they fade out. Nothing
// in the radar stands still.
const REACH = LIVE_R + 78;
const RADAR = REACH * 2;

const HOLD_MS = 1000;
const AVATAR = 36;
const HALO = 6; // soft ring of the same colour around each avatar
const SPOT = AVATAR + HALO * 2;
const EDGE = 4;
const WOBBLE = 6; // how far an avatar drifts in and out as it goes round
const STAGGER_MS = 300;
const ORBIT_MS = 46000; // one slow turn of the room
const LANES = 3; // matches are spread a third of a turn apart

// Soft pastels; the same person always gets the same one.
const PASTELS = ['#DCE8F8', '#E6DFF5', '#DDF0E3', '#F8E3D4', '#F6DCE6', '#F5EDC9'];
const AVATAR_INK = '#1B2A41';

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// One match, roaming the radar. Every avatar rides the same slow turn, a
// third of the way round from the next, so they travel the whole room and
// never meet; each also drifts in and out on its own beat.
function Avatar({
  person,
  lane,
  radius,
  orbit,
  moving,
}: {
  person: RadarPerson;
  lane: number;
  radius: number;
  orbit: Animated.Value;
  moving: boolean;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0.5)).current;
  const tint = PASTELS[hash(person.id) % PASTELS.length];
  const seed = hash(person.id);
  const from = lane * (360 / LANES) - 150;

  useEffect(() => {
    const appear = Animated.sequence([
      Animated.delay(lane * STAGGER_MS),
      Animated.spring(enter, { toValue: 1, damping: 16, stiffness: 170, mass: 1, useNativeDriver: true }),
    ]);
    appear.start();
    return () => appear.stop();
    // The stagger belongs to the moment this avatar first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enter]);

  useEffect(() => {
    if (!moving) return;
    const ease = Easing.inOut(Easing.sin);
    const duration = 2600 + (seed % 5) * 260;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration, easing: ease, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift, moving, seed]);

  const turn = orbit.interpolate({ inputRange: [0, 1], outputRange: [`${from}deg`, `${from + 360}deg`] });
  const upright = orbit.interpolate({ inputRange: [0, 1], outputRange: [`${-from}deg`, `${-from - 360}deg`] });

  return (
    // A zero-size pivot at the radar's centre; the avatar sits out along its
    // arm and is turned back so its letters stay level.
    <Animated.View pointerEvents="none" style={[avatarStyles.pivot, { transform: [{ rotate: turn }] }]}>
      <Animated.View
        style={[
          avatarStyles.arm,
          { left: radius - SPOT / 2, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-WOBBLE, WOBBLE] }) }] },
        ]}
      >
        <Animated.View
          style={[
            avatarStyles.halo,
            {
              opacity: enter,
              transform: [{ rotate: upright }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }],
            },
          ]}
        >
          <View style={[avatarStyles.haloFill, { backgroundColor: tint }]} />
          <View style={[avatarStyles.face, { backgroundColor: tint }]}>
            <Text style={avatarStyles.text}>{person.initials}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const avatarStyles = StyleSheet.create({
  pivot: { position: 'absolute', width: 0, height: 0 },
  arm: { position: 'absolute', top: -SPOT / 2, width: SPOT, height: SPOT },
  halo: { width: SPOT, height: SPOT, alignItems: 'center', justifyContent: 'center' },
  haloFill: { ...StyleSheet.absoluteFill, borderRadius: SPOT / 2, opacity: 0.4 },
  face: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: fonts.bodyBold, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.2, color: AVATAR_INK },
});

// A line of text that fades and lifts into place whenever it changes.
function SwapText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    shown.setValue(0);
    const arrive = Animated.timing(shown, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    arrive.start();
    return () => arrive.stop();
  }, [text, shown]);
  return (
    <Animated.Text
      style={[style, { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }]}
    >
      {text}
    </Animated.Text>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The Go Live control: press and hold, then it rises to the middle of a quiet
// radar and breathes, and matches appear as initials travelling round it.
export function GoLiveRadar({ phase, people, disabled, onHoldComplete, onOpenMatches }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const live = phase !== 'idle';
  const scanning = phase === 'searching' || phase === 'found';
  const moving = focused && !reduceMotion;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // ---- press and hold
  const hold = useRef(new Animated.Value(0)).current; // 0..1 around the ring
  const press = useRef(new Animated.Value(0)).current; // 0..1 pressed in
  const fired = useRef(false);

  function release() {
    hold.stopAnimation();
    Animated.timing(hold, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    Animated.timing(press, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  }

  function handlePressIn() {
    if (live || disabled) return;
    fired.current = false;
    Animated.timing(press, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    Animated.timing(hold, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (!finished || fired.current) return;
      fired.current = true;
      onHoldComplete();
      release();
    });
  }

  function handlePressOut() {
    if (!fired.current) release();
  }

  // ---- rise when live, settle back when not
  const lift = useRef(new Animated.Value(0)).current;
  const radar = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      lift.setValue(live ? 1 : 0);
      radar.setValue(live ? 1 : 0);
      return;
    }
    const move = live
      ? Animated.parallel([
          Animated.sequence([
            Animated.delay(300),
            Animated.spring(lift, { toValue: 1, damping: 20, stiffness: 120, mass: 1, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(800),
            Animated.timing(radar, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
        ])
      : Animated.parallel([
          Animated.timing(radar, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.spring(lift, { toValue: 0, damping: 20, stiffness: 120, mass: 1, useNativeDriver: true }),
        ]);
    move.start();
    return () => move.stop();
  }, [live, lift, radar, reduceMotion]);

  // ---- while live the button breathes: slowly in, slowly out
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live || !moving) return;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1700, easing: ease, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1700, easing: ease, useNativeDriver: true }),
      ])
    );
    const start = setTimeout(() => loop.start(), 900);
    return () => {
      clearTimeout(start);
      loop.stop();
      breath.setValue(0);
    };
  }, [live, moving, breath]);

  // ---- ripples: three soft rings leaving the button one after another
  const ripples = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!scanning || !moving) return;
    const duration = phase === 'found' ? 5400 : 3900;
    const loops = ripples.map((value) =>
      Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }))
    );
    const timers = loops.map((loop, i) => setTimeout(() => loop.start(), (duration / loops.length) * i));
    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((loop) => loop.stop());
      ripples.forEach((value) => value.setValue(0));
    };
  }, [scanning, moving, phase, ripples]);

  // ---- the slow turn every match rides
  const orbit = useRef(new Animated.Value(0)).current;
  const showPeople = phase === 'found' && width > 0;
  useEffect(() => {
    if (!showPeople || !moving) return;
    const loop = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: ORBIT_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [showPeople, moving, orbit]);

  const ringSize = BUTTON + RING_GAP * 2;
  const ringR = ringSize / 2 - 1.5;
  const ringC = 2 * Math.PI * ringR;
  const cx = width / 2;
  // As far out as the screen allows, but never past the outer ring.
  const orbitR = Math.min(REACH - 6, cx - SPOT / 2 - EDGE - WOBBLE, LIVE_CY - SPOT / 2 - EDGE - WOBBLE);
  const canOpen = phase === 'found' && Boolean(onOpenMatches);
  const caption =
    phase === 'searching'
      ? 'FINDING MATCHES…'
      : phase === 'found'
        ? `${people.length} ${people.length === 1 ? 'MATCH' : 'MATCHES'}`
        : phase === 'empty'
          ? 'STILL QUIET'
          : null;

  return (
    <View style={styles.stage} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          {/* Radar, centred on where the button comes to rest when live. */}
          <Animated.View pointerEvents="none" style={[styles.radar, { left: cx - RADAR / 2, top: LIVE_CY - RADAR / 2, opacity: radar }]}>
            {ripples.map((value, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ripple,
                  {
                    opacity: value.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.34, 0] }),
                    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [(LIVE_R * 2) / RADAR, 1] }) }],
                  },
                ]}
              />
            ))}
          </Animated.View>

          {showPeople && (
            <View pointerEvents="none" style={[styles.centre, { left: cx, top: LIVE_CY }]}>
              {people.slice(0, LANES).map((person, lane) => (
                <Avatar key={person.id} person={person} lane={lane} radius={orbitR} orbit={orbit} moving={moving} />
              ))}
            </View>
          )}

          {/* The wordmark above the button; once live it moves inside it. */}
          <Animated.Text
            style={[
              styles.brand,
              {
                top: IDLE_CY - BUTTON / 2 - RING_GAP - BRAND_GAP - BRAND_H,
                opacity: lift.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }),
                transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT / 2] }) }],
              },
            ]}
          >
            Ol-ga
          </Animated.Text>

          <Animated.View
            style={[
              styles.core,
              {
                left: cx - ringSize / 2,
                top: IDLE_CY - ringSize / 2,
                transform: [
                  { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT] }) },
                  { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, LIVE_SCALE] }) },
                ],
              },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
              <Svg width={ringSize} height={ringSize} style={styles.holdRing}>
                <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke={colors.line} strokeWidth={1.5} fill="none" />
                <AnimatedCircle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringR}
                  stroke={colors.liveFill}
                  strokeWidth={3}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${ringC} ${ringC}`}
                  strokeDashoffset={hold.interpolate({ inputRange: [0, 1], outputRange: [ringC, 0] })}
                  opacity={hold.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] })}
                  rotation={-90}
                  origin={`${ringSize / 2}, ${ringSize / 2}`}
                />
              </Svg>
              <Animated.View style={{ transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }] }}>
                <Pressable
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  onPress={canOpen ? onOpenMatches : undefined}
                  disabled={disabled || (live && !canOpen)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    phase === 'idle'
                      ? 'Go Live. Press and hold'
                      : canOpen
                        ? `You're live, ${people.length} ready. Open your matches`
                        : "You're live"
                  }
                  style={styles.button}
                >
                  {live ? (
                    <>
                      <Radio size={24} color={colors.white} strokeWidth={1.8} />
                      <Text style={[styles.label, styles.labelLive]}>YOU'RE LIVE</Text>
                      {caption && <SwapText text={caption} style={styles.caption} />}
                    </>
                  ) : (
                    <>
                      <Radio size={26} color={colors.white} strokeWidth={1.8} />
                      <Text style={styles.label}>GO LIVE</Text>
                      <Text style={styles.caption}>PRESS & HOLD</Text>
                    </>
                  )}
                </Pressable>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stage: { height: STAGE_H, alignSelf: 'stretch' },
    radar: { position: 'absolute', width: RADAR, height: RADAR, alignItems: 'center', justifyContent: 'center' },
    ripple: {
      position: 'absolute',
      width: RADAR,
      height: RADAR,
      borderRadius: RADAR / 2,
      borderWidth: 1,
      borderColor: colors.charcoal,
      backgroundColor: colors.accentSoft,
    },
    centre: { position: 'absolute', width: 0, height: 0 },
    brand: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: BRAND_H,
      textAlign: 'center',
      fontFamily: fonts.headingBold,
      fontSize: 26,
      lineHeight: BRAND_H,
      fontWeight: '600',
      color: colors.text,
    },
    core: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    holdRing: { position: 'absolute' },
    button: {
      width: BUTTON,
      height: BUTTON,
      borderRadius: BUTTON / 2,
      margin: RING_GAP,
      backgroundColor: colors.charcoal,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    label: { fontFamily: fonts.headingBold, fontSize: 21, fontWeight: '800', letterSpacing: 1, color: colors.white, marginTop: 3 },
    caption: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.78)' },
    labelLive: { fontSize: 19 },
  });

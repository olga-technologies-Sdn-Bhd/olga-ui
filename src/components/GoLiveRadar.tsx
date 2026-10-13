import { useIsFocused } from '@react-navigation/native';
import { Radio } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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

// Geometry, in dp. The button rests low in the stage and rises when live;
// the headroom above the wordmark is what it rises into.
const BUTTON = 216;
const RING_GAP = 7; // thin outer border / hold progress, just outside the button
const LIFT = 70;
const LIVE_SCALE = 0.8;
const BRAND_H = 34;
const BRAND_GAP = 14;
const BOTTOM = 28;
const STAGE_H = LIFT + BRAND_H + BRAND_GAP + BUTTON + BOTTOM;
const IDLE_CY = LIFT + BRAND_H + BRAND_GAP + BUTTON / 2;
const LIVE_CY = IDLE_CY - LIFT;
const LIVE_R = (BUTTON / 2) * LIVE_SCALE;
const RINGS = [LIVE_R + 30, LIVE_R + 58, LIVE_R + 86];
const RADAR = RINGS[RINGS.length - 1] * 2;

const HOLD_MS = 1000;
const AVATAR = 46;
const AVATAR_GAP = 14; // least space between two avatars, and to the button
const EDGE = 4;
const STAGGER_MS = 300;

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

// Small seeded generator, so a person's spot depends on who they are and not
// on when the screen happened to render.
function seeded(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Spot = { x: number; y: number };

// A free spot for one avatar: inside the stage, clear of the live button, the
// wordmark above it and every avatar already placed.
function findSpot(id: string, width: number, taken: Spot[]): Spot {
  const random = seeded(hash(id));
  const half = AVATAR / 2;
  const cx = width / 2;
  const clear = LIVE_R + half + AVATAR_GAP;
  const brandBottom = LIVE_CY - LIVE_R - 4;
  const fits = (spot: Spot) =>
    Math.hypot(spot.x - cx, spot.y - LIVE_CY) >= clear &&
    !(spot.y - half < brandBottom && Math.abs(spot.x - cx) < 64 + half) &&
    taken.every((other) => Math.hypot(spot.x - other.x, spot.y - other.y) >= AVATAR + AVATAR_GAP);
  for (let attempt = 0; attempt < 200; attempt++) {
    const spot = {
      x: half + EDGE + random() * (width - AVATAR - EDGE * 2),
      y: half + EDGE + random() * (STAGE_H - AVATAR - EDGE * 2),
    };
    if (fits(spot)) return spot;
  }
  // Crowded: fall back to the corners, nearest free one first.
  const corners = [
    { x: half + EDGE, y: STAGE_H - half - EDGE },
    { x: width - half - EDGE, y: STAGE_H - half - EDGE },
    { x: half + EDGE, y: half + EDGE },
    { x: width - half - EDGE, y: half + EDGE },
  ];
  return corners.find(fits) ?? corners[taken.length % corners.length];
}

function Avatar({ person, spot, index, moving }: { person: RadarPerson; spot: Spot; index: number; moving: boolean }) {
  const enter = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const appear = Animated.sequence([
      Animated.delay(index * STAGGER_MS),
      Animated.spring(enter, { toValue: 1, damping: 16, stiffness: 170, mass: 1, useNativeDriver: true }),
    ]);
    appear.start();
    return () => appear.stop();
    // The stagger belongs to the moment this avatar first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enter]);

  useEffect(() => {
    if (!moving) return;
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const start = setTimeout(() => drift.start(), (hash(person.id) % 5) * 400);
    return () => {
      clearTimeout(start);
      drift.stop();
    };
  }, [float, moving, person.id]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        avatarStyles.wrap,
        {
          left: spot.x - AVATAR / 2,
          top: spot.y - AVATAR / 2,
          backgroundColor: PASTELS[hash(person.id) % PASTELS.length],
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) },
            { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-1.5, 1.5] }) },
          ],
        },
      ]}
    >
      <Text style={avatarStyles.text}>{person.initials}</Text>
    </Animated.View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: fonts.bodyBold, fontSize: 15, fontWeight: '600', color: AVATAR_INK },
});

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The Go Live control: press and hold, then it rises, a quiet radar starts
// around it, and matches appear as initials scattered about the room.
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
            Animated.timing(radar, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
        ])
      : Animated.parallel([
          Animated.timing(radar, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.spring(lift, { toValue: 0, damping: 20, stiffness: 120, mass: 1, useNativeDriver: true }),
        ]);
    move.start();
    return () => move.stop();
  }, [live, lift, radar, reduceMotion]);

  // ---- the radar itself: a slow sweep and two rings that widen and fade.
  // Slower once matches are in. Stops when the screen is not in view.
  const sweep = useRef(new Animated.Value(0)).current;
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!scanning || !moving) return;
    const calm = phase === 'found';
    const turn = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: calm ? 9000 : 5500, easing: Easing.linear, useNativeDriver: true })
    );
    const widen = (value: Animated.Value) =>
      Animated.loop(
        Animated.timing(value, { toValue: 1, duration: calm ? 5000 : 3500, easing: Easing.out(Easing.quad), useNativeDriver: true })
      );
    const a = widen(pulseA);
    const b = widen(pulseB);
    turn.start();
    a.start();
    const later = setTimeout(() => b.start(), calm ? 2500 : 1750);
    return () => {
      clearTimeout(later);
      turn.stop();
      a.stop();
      b.stop();
      sweep.setValue(0);
      pulseA.setValue(0);
      pulseB.setValue(0);
    };
  }, [scanning, moving, phase, sweep, pulseA, pulseB]);

  // ---- where each match sits. Worked out once per person and kept.
  const [spots] = useState(() => new Map<string, Spot>());
  const shown = phase === 'found' && width > 0 ? people : [];
  if (phase === 'idle') spots.clear();
  for (const person of shown) {
    if (!spots.has(person.id)) spots.set(person.id, findSpot(person.id, width, [...spots.values()]));
  }

  const ringSize = BUTTON + RING_GAP * 2;
  const ringR = ringSize / 2 - 1.5;
  const ringC = 2 * Math.PI * ringR;
  const cx = width / 2;

  const caption =
    phase === 'idle'
      ? 'PRESS & HOLD'
      : phase === 'searching'
        ? 'FINDING MATCHES…'
        : phase === 'found'
          ? `${people.length} READY`
          : phase === 'empty'
            ? 'STILL QUIET'
            : null;
  const canOpen = phase === 'found' && Boolean(onOpenMatches);

  return (
    <View style={styles.stage} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          {/* Radar, centred on where the button comes to rest when live. */}
          <Animated.View pointerEvents="none" style={[styles.radar, { left: cx - RADAR / 2, top: LIVE_CY - RADAR / 2, opacity: radar }]}>
            {RINGS.map((r) => (
              <View key={r} style={[styles.ring, { width: r * 2, height: r * 2, borderRadius: r }]} />
            ))}
            {[pulseA, pulseB].map((pulse, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.pulse,
                  {
                    opacity: pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.52, 1] }) }],
                  },
                ]}
              />
            ))}
            {scanning && (
              <Animated.View
                style={[
                  styles.sweep,
                  { transform: [{ rotate: sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
                ]}
              >
                <Svg width={RADAR} height={RADAR}>
                  <Path d={wedge(RADAR / 2, 0, 24)} fill={colors.charcoal} opacity={0.04} />
                  <Path d={wedge(RADAR / 2, 24, 48)} fill={colors.charcoal} opacity={0.02} />
                </Svg>
              </Animated.View>
            )}
          </Animated.View>

          {shown.map((person, index) => (
            <Avatar key={person.id} person={person} spot={spots.get(person.id)!} index={index} moving={moving} />
          ))}

          <Animated.Text
            style={[
              styles.brand,
              {
                top: LIFT,
                transform: [
                  { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -(LIFT - (BUTTON / 2 - LIVE_R))] }) },
                  { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) },
                ],
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
                <Radio size={30} color={colors.white} strokeWidth={1.8} />
                <Text style={[styles.label, live && styles.labelLive]}>{live ? "YOU'RE LIVE" : 'GO LIVE'}</Text>
                {caption && <Text style={styles.caption}>{caption}</Text>}
              </Pressable>
            </Animated.View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

// A thin pie slice from the centre, between two angles measured clockwise
// from straight up.
function wedge(radius: number, fromDeg: number, toDeg: number) {
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${radius + radius * Math.sin(rad)} ${radius - radius * Math.cos(rad)}`;
  };
  return `M ${radius} ${radius} L ${point(fromDeg)} A ${radius} ${radius} 0 0 1 ${point(toDeg)} Z`;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stage: { height: STAGE_H, alignSelf: 'stretch' },
    radar: { position: 'absolute', width: RADAR, height: RADAR, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', borderWidth: 1, borderColor: colors.brand2, opacity: 0.55 },
    pulse: {
      position: 'absolute',
      width: RADAR,
      height: RADAR,
      borderRadius: RADAR / 2,
      borderWidth: 1,
      borderColor: colors.muted,
    },
    sweep: { position: 'absolute', width: RADAR, height: RADAR },
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
      gap: 6,
    },
    label: { fontFamily: fonts.headingBold, fontSize: 24, fontWeight: '800', letterSpacing: 1, color: colors.white, marginTop: 4 },
    labelLive: { fontSize: 21 },
    caption: { fontFamily: fonts.bodyBold, fontSize: 11, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.78)' },
  });

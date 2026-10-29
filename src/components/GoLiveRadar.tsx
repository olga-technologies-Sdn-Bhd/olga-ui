import { useIsFocused } from '@react-navigation/native';
import { Radio } from 'lucide-react-native';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';
import { haptics } from '../utils/haptics';

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
  // How far above this component the centre of the screen's header row sits.
  // On going live the wordmark flies up there, to the right-hand end.
  headerAbove?: number;
};

// Geometry, in dp. The button rests a little low and rises when live, to the
// centre of the radar.
const BUTTON = 168;
const RING_GAP = 7; // thin outer border / hold progress, just outside the button
// The glow that builds behind the button while it's held.
const CHARGE = Math.round(BUTTON * 1.55);
const LIFT = 40;
const LIVE_SCALE = 0.82;
const BRAND_H = 34;
const BRAND_GAP = 14;
const BRAND_SMALL = 0.62; // the wordmark's size once it is in the header
const BRAND_SMALL_HALF = 24; // half its width at that size
const STAGE_H = 372;
const LIVE_CY = 184;
const IDLE_CY = LIVE_CY + LIFT;
// Idle, the stage ends just under the button so the line below sits close to
// it; it grows to the full radar (STAGE_H) the moment a hold starts, and
// everything under it slides down with one layout animation.
const IDLE_STAGE_H = IDLE_CY + BUTTON / 2 + RING_GAP + 18;
// After a completed hold the stage stays open while Go Live starts; if it
// never does (an error), it closes again after this long.
const OPEN_WAIT_MS = 8000;
const LIVE_R = (BUTTON / 2) * LIVE_SCALE;
const BRAND_TOP = IDLE_CY - BUTTON / 2 - RING_GAP - BRAND_GAP - BRAND_H;
// How far the ripples travel from the button before they fade out. Nothing
// in the radar stands still.
const REACH = LIVE_R + 114;
const RADAR = REACH * 2;

const HOLD_MS = 1000;
const AVATAR = 24;
const HALO = 4; // soft ring of the same colour around each avatar
const SPOT = AVATAR + HALO * 2;
const EDGE = 4;
const WOBBLE = 6; // how far an avatar drifts in and out as it goes round
const STAGGER_MS = 300;
const ORBIT_MS = 110000; // one very slow turn of the room

// Soft pastels; the same person always gets the same one.
const PASTELS = ['#DCE8F8', '#E6DFF5', '#DDF0E3', '#F8E3D4', '#F6DCE6', '#F5EDC9'];
export const AVATAR_INK = '#2A2622';

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// Counts up to the target one step at a time while active, and starts again
// from zero whenever it stops being active.
export function useCountUp(target: number, active: boolean, stepMs = STAGGER_MS) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) {
      setCount(0);
      return;
    }
    if (count >= target) {
      if (count > target) setCount(target);
      return;
    }
    const timer = setTimeout(() => setCount((c) => Math.min(target, c + 1)), count === 0 ? 0 : stepMs);
    return () => clearTimeout(timer);
  }, [active, target, count, stepMs]);
  return count;
}

export function pastelFor(id: string) {
  return PASTELS[hash(id) % PASTELS.length];
}

// Small seeded generator, so where a person sits depends on who they are and
// not on when the screen happened to render.
function seeded(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Place = { angle: number; radius: number };

// A place for one match: any direction, anywhere between just outside the
// button and the edge of the radar. Some land close to the button and some
// far out, some beside each other and some alone; the only rule is that two
// never touch.
function findPlace(id: string, near: number, far: number, taken: Place[]): Place {
  const random = seeded(hash(id));
  const apart = SPOT * 1.1 + WOBBLE * 2;
  const xy = (p: Place) => {
    const rad = (p.angle * Math.PI) / 180;
    return { x: p.radius * Math.cos(rad), y: p.radius * Math.sin(rad) };
  };
  let best: Place = { angle: random() * 360, radius: far };
  let bestGap = -1;
  for (let attempt = 0; attempt < 120; attempt++) {
    const place = { angle: random() * 360, radius: near + random() * (far - near) };
    const a = xy(place);
    const gap = Math.min(...taken.map((other) => Math.hypot(a.x - xy(other).x, a.y - xy(other).y)), Infinity);
    if (gap >= apart) return place;
    if (gap > bestGap) {
      best = place;
      bestGap = gap;
    }
  }
  return best;
}

// One match, roaming the radar. Every avatar rides the same slow turn from
// its own place, so they travel the whole room and keep their distances;
// each also drifts in and out on its own beat.
const Avatar = memo(function Avatar({
  person,
  lane,
  angle,
  radius,
  orbit,
  moving,
}: {
  person: RadarPerson;
  lane: number;
  angle: number;
  radius: number;
  orbit: Animated.Value;
  moving: boolean;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const tint = pastelFor(person.id);
  const seed = hash(person.id);
  const from = angle;

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
    const duration = 4600 + (seed % 5) * 380;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration, easing: ease, useNativeDriver: true }),
      ]),
      { iterations: -1, resetBeforeIteration: false }
    );
    // And each one swells and settles, slowly, on its own beat.
    const swell = 3200 + (seed % 7) * 240;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: swell, easing: ease, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: swell, easing: ease, useNativeDriver: true }),
      ]),
      { iterations: -1, resetBeforeIteration: false }
    );
    loop.start();
    breathe.start();
    return () => {
      loop.stop();
      breathe.stop();
    };
  }, [drift, pulse, moving, seed]);

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
          <Animated.View
            style={[avatarStyles.halo, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.1] }) }] }]}
          >
            <View style={[avatarStyles.haloFill, { backgroundColor: tint }]} />
            <View style={[avatarStyles.face, { backgroundColor: tint }]}>
              <Text style={avatarStyles.text}>{person.initials}</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

const avatarStyles = StyleSheet.create({
  pivot: { position: 'absolute', width: 0, height: 0 },
  arm: { position: 'absolute', top: -SPOT / 2, width: SPOT, height: SPOT },
  halo: { width: SPOT, height: SPOT, alignItems: 'center', justifyContent: 'center' },
  haloFill: { ...StyleSheet.absoluteFill, borderRadius: SPOT / 2, opacity: 0.4 },
  face: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: fonts.bodyBold, fontSize: 9.5, fontWeight: semibold, letterSpacing: 0.1, color: AVATAR_INK },
});

// A line of text that fades and lifts into place whenever it changes.
function SwapText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    shown.setValue(0.35);
    const arrive = Animated.timing(shown, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    arrive.start();
    return () => arrive.stop();
  }, [text, shown]);
  return (
    <Animated.Text
      style={[style, { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }]}
    >
      {text}
    </Animated.Text>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The Go Live control: press and hold, then it rises to the middle of a quiet
// radar and breathes, and matches appear as initials travelling round it.
export const GoLiveRadar = memo(function GoLiveRadar({ phase, people, disabled, onHoldComplete, onOpenMatches, headerAbove = 27 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const live = phase !== 'idle';
  // A hold in progress (finger down, not yet live).
  const [holding, setHolding] = useState(false);
  const tickTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const expanded = live || holding;
  // Once live (or if going live never happens) the hold is over.
  useEffect(() => {
    if (!holding) return;
    if (live) {
      setHolding(false);
      return;
    }
    const timer = setTimeout(() => setHolding(false), OPEN_WAIT_MS);
    return () => clearTimeout(timer);
  }, [holding, live]);
  const lastExpanded = useRef(expanded);
  if (lastExpanded.current !== expanded) {
    // Animate the stage's height change and the content below it, together.
    lastExpanded.current = expanded;
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
  }
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

  // keepOpen: the hold completed, so the stage stays open while Go Live starts.
  function release(keepOpen = false) {
    tickTimers.current.forEach(clearTimeout);
    tickTimers.current = [];
    if (!keepOpen) setHolding(false);
    hold.stopAnimation();
    Animated.timing(hold, { toValue: 0, duration: 220, useNativeDriver: false }).start();
    // Let go: the button springs back up, overshooting a touch, like a real key.
    Animated.spring(press, { toValue: 0, damping: 9, stiffness: 240, mass: 0.8, useNativeDriver: true }).start();
  }

  function handlePressIn() {
    if (live || disabled) return;
    fired.current = false;
    setHolding(true);
    haptics.tap();
    // Soft ticks as the ring fills, so the hold is felt as well as seen.
    const ticks = [0.34, 0.67].map((at) => setTimeout(() => !fired.current && haptics.tick(), HOLD_MS * at));
    tickTimers.current = ticks;
    // Press: the button sinks in with a quick, soft spring.
    Animated.spring(press, { toValue: 1, damping: 15, stiffness: 320, mass: 0.7, useNativeDriver: true }).start();
    Animated.timing(hold, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (!finished || fired.current) return;
      fired.current = true;
      haptics.success();
      onHoldComplete();
      release(true);
      // Done: a small pop as it springs back past its rest size.
      press.setValue(-0.9);
      Animated.spring(press, { toValue: 0, damping: 7, stiffness: 200, mass: 0.8, useNativeDriver: true }).start();
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

  // ---- the wordmark leaves its place above the button for the header
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      fly.setValue(live ? 1 : 0);
      return;
    }
    const move = Animated.sequence([
      Animated.delay(live ? 200 : 0),
      Animated.timing(fly, { toValue: live ? 1 : 0, duration: live ? 850 : 500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]);
    move.start();
    return () => move.stop();
  }, [live, fly, reduceMotion]);

  // ---- while live the button breathes: slowly in, slowly out
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live || !moving) return;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1700, easing: ease, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1700, easing: ease, useNativeDriver: true }),
      ]),
      { iterations: -1, resetBeforeIteration: false }
    );
    const start = setTimeout(() => loop.start(), 900);
    return () => {
      clearTimeout(start);
      loop.stop();
      breath.setValue(0);
    };
  }, [live, moving, breath]);

  // ---- ripples: five soft rings leaving the button one after another
  const ripples = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!scanning || !moving) return;
    const duration = phase === 'found' ? 7500 : 5500;
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
  // The nearest a match may sit: just clear of the button at its fullest.
  const nearR = LIVE_R * 1.06 + SPOT / 2 + WOBBLE + 6;
  // Worked out once per person and kept, so nobody jumps when the list changes.
  const [places] = useState(() => new Map<string, Place>());
  if (phase === 'idle') places.clear();
  if (showPeople) {
    for (const person of people) {
      if (!places.has(person.id)) places.set(person.id, findPlace(person.id, nearR, orbitR, [...places.values()]));
    }
  }
  const canOpen = phase === 'found' && Boolean(onOpenMatches);
  const counted = useCountUp(people.length, phase === 'found');
  const caption =
    phase === 'searching'
      ? 'FINDING PEOPLE…'
      : phase === 'found'
        ? `${Math.max(1, counted)} RELEVANT ${Math.max(1, counted) === 1 ? 'PERSON' : 'PEOPLE'}`
        : phase === 'empty'
          ? 'STILL QUIET'
          : null;

  return (
    <View style={[styles.stage, { height: expanded ? STAGE_H : IDLE_STAGE_H }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
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
                    opacity: value.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.3, 0] }),
                    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [(LIVE_R * 2) / RADAR, 1] }) }],
                  },
                ]}
              />
            ))}
          </Animated.View>

          {showPeople && (
            <View pointerEvents="none" style={[styles.centre, { left: cx, top: LIVE_CY }]}>
              {people.map((person, lane) => {
                const place = places.get(person.id)!;
                return (
                  <Avatar
                    key={person.id}
                    person={person}
                    lane={lane}
                    angle={place.angle}
                    radius={place.radius}
                    orbit={orbit}
                    moving={moving}
                  />
                );
              })}
            </View>
          )}

          {/* The wordmark above the button. On going live it rises first and
              then sweeps across, settling small at the right of the header. */}
          <Animated.Text
            style={[
              styles.brand,
              {
                top: BRAND_TOP,
                transform: [
                  {
                    translateX: fly.interpolate({
                      inputRange: [0, 0.45, 1],
                      outputRange: [0, (cx - BRAND_SMALL_HALF) * 0.22, cx - BRAND_SMALL_HALF],
                    }),
                  },
                  {
                    translateY: fly.interpolate({
                      inputRange: [0, 0.55, 1],
                      outputRange: [0, -(BRAND_TOP + BRAND_H / 2 + headerAbove) * 0.82, -(BRAND_TOP + BRAND_H / 2 + headerAbove)],
                    }),
                  },
                  { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, BRAND_SMALL] }) },
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
            <Animated.View style={{ transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
              {/* A warm glow that builds behind the button as the hold charges. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.charge,
                  {
                    left: (ringSize - CHARGE) / 2,
                    top: (ringSize - CHARGE) / 2,
                    opacity: hold.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 1] }),
                    transform: [{ scale: hold.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.1] }) }],
                  },
                ]}
              >
                <Svg width={CHARGE} height={CHARGE}>
                  <Defs>
                    <RadialGradient id="goLiveCharge" cx="50%" cy="50%" r="50%">
                      <Stop offset="0.45" stopColor={colors.liveTo} stopOpacity={0.55} />
                      <Stop offset="1" stopColor={colors.liveFrom} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Circle cx={CHARGE / 2} cy={CHARGE / 2} r={CHARGE / 2} fill="url(#goLiveCharge)" />
                </Svg>
              </Animated.View>
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
              {/* Pressed in: smaller, and a touch lower, as if pushed into the page. */}
              <Animated.View
                style={{
                  transform: [
                    { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) },
                    { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) },
                  ],
                }}
              >
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
                        ? `You're live, ${people.length} relevant people. Open the list`
                        : "You're live"
                  }
                  style={styles.button}
                >
                  {/* The sunrise: the theme's own gradient (coral into pink on Sunrise). */}
                  <LinearGradient
                    colors={[colors.liveFrom, colors.liveTo]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={styles.buttonFill}
                  />
                  {/* Light catching the top of the button; it dims as the button goes down. */}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.buttonFill, { opacity: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25], extrapolate: 'clamp' }) }]}
                  >
                    <LinearGradient colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={styles.buttonFill} />
                  </Animated.View>
                  {/* The shade of a pressed key. */}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.buttonFill, styles.pressShade, { opacity: press.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}
                  />
                  {live ? (
                    <>
                      <Radio size={24} color={colors.onLive} strokeWidth={1.8} />
                      <Text style={[styles.label, styles.labelLive]}>YOU'RE LIVE</Text>
                      {caption && <SwapText text={caption} style={styles.caption} />}
                    </>
                  ) : (
                    <>
                      <Radio size={26} color={colors.onLive} strokeWidth={1.8} />
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
});

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
      borderColor: colors.liveFrom,
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
      fontWeight: semibold,
      color: colors.text,
    },
    core: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    holdRing: { position: 'absolute' },
    button: {
      width: BUTTON,
      height: BUTTON,
      borderRadius: BUTTON / 2,
      margin: RING_GAP,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    buttonFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    pressShade: { backgroundColor: 'rgba(90,20,30,0.16)' },
    charge: { position: 'absolute', width: CHARGE, height: CHARGE },
    label: { fontFamily: fonts.headingBold, fontSize: 21, fontWeight: semibold, letterSpacing: 1, color: colors.onLive, marginTop: 3 },
    caption: { fontFamily: fonts.bodyBold, fontSize: 10, fontWeight: semibold, letterSpacing: 2, color: colors.onLive, opacity: 0.78 },
    labelLive: { fontSize: 19 },
  });

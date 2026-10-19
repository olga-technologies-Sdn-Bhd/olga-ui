import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// The Social Capital orb: the member's network, alive. Soft colour currents
// drift slowly round each other and breathe, with no hard edge, so its outline
// is always soft and always changing; a gentle light glows at its heart, and a
// warm halo swells and settles around it. Ol-ga's own
// design, built from plain circles and gradients. Long, eased loops keep it
// calm and fluid; every motion is a transform or opacity on the native driver.

type Current = { color: string; orbitMs: number; breatheMs: number; offset: number; size: number; reverse?: boolean };

const CURRENTS: Current[] = [
  { color: '#FF8A5B', orbitMs: 14000, breatheMs: 5200, offset: 0.18, size: 0.95 },
  { color: '#A78BFA', orbitMs: 18000, breatheMs: 6400, offset: 0.2, size: 0.9, reverse: true },
  { color: '#FF7EB6', orbitMs: 22000, breatheMs: 5800, offset: 0.16, size: 0.8 },
  { color: '#FFC85C', orbitMs: 16000, breatheMs: 7000, offset: 0.22, size: 0.75, reverse: true },
  { color: '#5EDCCB', orbitMs: 26000, breatheMs: 7600, offset: 0.18, size: 0.62 },
];

function spinLoop(value: Animated.Value, duration: number) {
  return Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
}

function swayLoop(value: Animated.Value, duration: number) {
  const to = (toValue: number) =>
    Animated.timing(value, { toValue, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
  return Animated.loop(Animated.sequence([to(1), to(0)]));
}

// A soft round glow: its colour fades out to nothing at the edge.
function SoftBlob({ color, size, id, strength = 0.9 }: { color: string; size: number; id: string; strength?: number }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="0.5" stopColor={color} stopOpacity={strength * 0.5} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

export function CapitalOrb({ size = 92 }: { size?: number }) {
  const orbits = useRef(CURRENTS.map(() => new Animated.Value(0))).current;
  const breaths = useRef(CURRENTS.map(() => new Animated.Value(0))).current;
  const glow = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const all = Animated.parallel([
      ...CURRENTS.map((c, i) => spinLoop(orbits[i], c.orbitMs)),
      ...CURRENTS.map((c, i) => swayLoop(breaths[i], c.breatheMs)),
      swayLoop(glow, 3600),
      spinLoop(shine, 20000),
    ]);
    all.start();
    return () => all.stop();
  }, [orbits, breaths, glow, shine]);

  // The halo grows with the sphere, so the orb works at any size.
  const outer = size + Math.round(size * 0.4);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: outer, height: outer, alignItems: 'center', justifyContent: 'center' },
        halo: { position: 'absolute' },
        // No clip and no disc behind: the currents set the shape.
        sphere: { width: size, height: size },
        layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
      }),
    [size, outer]
  );

  const spin = (v: Animated.Value, reverse?: boolean) =>
    v.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });

  return (
    <View style={styles.wrap} pointerEvents="none">
      {/* A warm halo that swells and settles, slowly. */}
      <Animated.View
        style={[
          styles.halo,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.75] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.02] }) }],
          },
        ]}
      >
        <SoftBlob color="#FFB385" size={outer} id="orbHalo" strength={0.7} />
      </Animated.View>

      <View style={styles.sphere}>
        {CURRENTS.map((c, i) => (
          // The layer turns, carrying the off-centre current round.
          <Animated.View key={c.color} style={[styles.layer, { transform: [{ rotate: spin(orbits[i], c.reverse) }] }]}>
            <Animated.View
              style={{
                transform: [
                  { translateX: size * c.offset },
                  { scale: breaths[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) },
                ],
              }}
            >
              <SoftBlob color={c.color} size={size * c.size} id={`orbCurrent${i}`} />
            </Animated.View>
          </Animated.View>
        ))}
        {/* A gentle light at the heart. */}
        <Animated.View
          style={[
            styles.layer,
            {
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }],
            },
          ]}
        >
          <SoftBlob color="#FFFFFF" size={size * 0.5} id="orbCore" strength={0.8} />
        </Animated.View>
        {/* A soft sheen drifting slowly round. */}
        <Animated.View style={[styles.layer, { transform: [{ rotate: spin(shine) }] }]}>
          <View style={{ transform: [{ translateX: -size * 0.22 }, { translateY: -size * 0.22 }] }}>
            <SoftBlob color="#FFFFFF" size={size * 0.55} id="orbShine" strength={0.7} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

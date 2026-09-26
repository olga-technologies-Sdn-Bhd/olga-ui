import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  active: boolean;
  count?: number;
  size?: number;
  maxScale?: number;
  duration?: number;
  color?: string;
};

// Radar-style search animation: `count` identical rings, each starting at
// `size` and expanding to `size * maxScale` while fading out, staggered
// evenly across `duration` so there's always one emerging as another fades —
// a continuous "looking outward" ripple rather than one pulse at a time.
export function PulseRings({
  active,
  count = 3,
  size = 132,
  maxScale = 2,
  duration = 1800,
  color,
}: Props) {
  const { colors } = useTheme();
  const ringColor = color ?? colors.brand;
  const progresses = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) {
      progresses.forEach((value) => value.setValue(0));
      return;
    }

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const loops: Animated.CompositeAnimation[] = [];

    progresses.forEach((value, i) => {
      timers.push(
        setTimeout(() => {
          const loop = Animated.loop(
            Animated.timing(value, {
              toValue: 1,
              duration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            })
          );
          loops.push(loop);
          loop.start();
        }, (duration / count) * i)
      );
    });

    return () => {
      timers.forEach(clearTimeout);
      loops.forEach((loop) => loop.stop());
    };
  }, [active, count, duration, progresses]);

  return (
    <>
      {progresses.map((value, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderColor: ringColor,
              opacity: value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
              transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, maxScale] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    borderWidth: 2,
  },
});

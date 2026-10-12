import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// Same artwork and size as the native splash, so the hand-over is seamless.
const LOGO = require('../assets/images/olga-logo.png');
const LOGO_SIZE = 288;

// The logo breathes: one second in, one second out, on a sine curve so it
// never jolts. The splash holds for three full breaths, six seconds.
const PHASE_MS = 1000;
export const SPLASH_MIN_MS = 6 * PHASE_MS;

export function Splash() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    const to = (toValue: number) => Animated.timing(scale, { toValue, duration: PHASE_MS, easing: ease, useNativeDriver: true });
    const breathe = Animated.loop(Animated.sequence([to(1.1), to(1)]));
    breathe.start();
    return () => breathe.stop();
  }, [scale]);

  return (
    <View style={styles.wrap}>
      <Animated.Image source={LOGO} resizeMode="contain" style={[styles.logo, { transform: [{ scale }] }]} />
    </View>
  );
}

// The wordmark is always black on white, whatever the theme.
const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});

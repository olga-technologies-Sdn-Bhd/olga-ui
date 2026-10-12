import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// Same artwork and size as the native splash, so the hand-over is seamless
// and the logo simply starts to beat.
const LOGO = require('../assets/images/olga-logo.png');
const LOGO_SIZE = 288;

// One slow heartbeat (two soft swells, then a rest) takes 2.4 s; the splash
// holds for two of them.
export const SPLASH_MIN_MS = 4800;

export function Splash() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.inOut(Easing.quad);
    const to = (toValue: number, duration: number) =>
      Animated.timing(scale, { toValue, duration, easing: ease, useNativeDriver: true });
    const beat = Animated.loop(
      Animated.sequence([to(1.1, 380), to(1, 380), to(1.06, 340), to(1, 420), Animated.delay(880)])
    );
    beat.start();
    return () => beat.stop();
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

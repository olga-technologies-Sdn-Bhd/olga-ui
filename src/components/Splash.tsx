import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// Same artwork and size as the native splash, so the hand-over is seamless.
const LOGO = require('../assets/images/olga-logo.png');
const LOGO_SIZE = 288;

// How long the splash holds: one slow, smooth zoom.
export const SPLASH_MIN_MS = 4200;

export function Splash() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const zoom = Animated.timing(progress, {
      toValue: 1,
      duration: SPLASH_MIN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    zoom.start();
    return () => zoom.stop();
  }, [progress]);

  // The logo eases from slightly small to full size and settles there.
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });

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

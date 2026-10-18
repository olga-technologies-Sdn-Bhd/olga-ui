import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Splash, SPLASH_FADE_MS, SPLASH_MIN_MS } from '../components/Splash';
import { useAuth } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';

export function RootNavigator() {
  const { isAuthenticated, isRestoring, needsOnboarding } = useAuth();
  // The splash stays until the name and its line have appeared and zoomed, even when the session restores
  // faster, so the app never opens on a flicker.
  const [beatDone, setBeatDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBeatDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // Also avoids flashing the sign-up screen while a stored Entra session is
  // still being read from the Keychain on app start.
  const ready = !isRestoring && beatDone;

  // Once ready, the app is drawn under the splash and the splash fades away
  // over it (no hard cut), then is removed.
  const fade = useRef(new Animated.Value(1)).current;
  const [splashGone, setSplashGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    Animated.timing(fade, { toValue: 0, duration: SPLASH_FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
      setSplashGone(true)
    );
  }, [ready, fade]);

  // One Splash for the whole start (it isn't remounted, so it doesn't replay).
  return (
    <View style={styles.fill}>
      {ready && (isAuthenticated && !needsOnboarding ? <MainTabs /> : <AuthStack />)}
      {!splashGone && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Splash />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

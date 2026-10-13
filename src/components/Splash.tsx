import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const LOGO = require('../assets/images/olga-logo.png');
const LOGO_SIZE = 288;

// Where each character of the wordmark ends inside the 288-wide artwork
// (O, l, -, g, a), measured from the image. Each character sits under its own
// white cover; the covers fade away one after another, so the name appears
// character by character. Once it is whole, the word zooms in once.
const EDGES = [0, 122.3, 132.6, 147.8, 184.1, LOGO_SIZE];
const LETTERS = EDGES.length - 1;

const FADE_MS = 420; // one character coming in
const STAGGER_MS = 200; // gap between characters
const REVEAL_MS = STAGGER_MS * (LETTERS - 1) + FADE_MS;
const ZOOM_MS = 1500; // the whole word, once
const HOLD_MS = 300;
export const SPLASH_MIN_MS = REVEAL_MS + ZOOM_MS + HOLD_MS;

export function Splash() {
  const covers = useRef(EDGES.slice(0, LETTERS).map(() => new Animated.Value(1))).current;
  const zoom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.sequence([
      Animated.stagger(
        STAGGER_MS,
        covers.map((cover) =>
          Animated.timing(cover, { toValue: 0, duration: FADE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        )
      ),
      Animated.timing(zoom, { toValue: 1, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [covers, zoom]);

  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.logo, { transform: [{ scale }] }]}>
        <Animated.Image source={LOGO} resizeMode="contain" style={styles.logo} />
        {covers.map((opacity, i) => (
          <Animated.View
            key={EDGES[i]}
            style={[styles.cover, { left: EDGES[i], width: EDGES[i + 1] - EDGES[i] + 0.5, opacity }]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// The wordmark is always black on white, whatever the theme.
const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  cover: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#FFFFFF' },
});

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { fonts } from '../theme/typography';

const LOGO = require('../assets/images/olga-logo.png');
const LOGO_SIZE = 288;
// The wordmark's lowest ink inside the artwork (the tail of the g).
const WORDMARK_BOTTOM = 176;

// Where each character of the wordmark ends inside the 288-wide artwork
// (O, l, -, g, a), measured from the image. Each character sits under its own
// white cover; the covers fade away one after another, so the name appears
// character by character. The line beneath then arrives word by word, and
// once everything is there the whole of it zooms in once.
const EDGES = [0, 122.3, 132.6, 147.8, 184.1, LOGO_SIZE];
const LETTERS = EDGES.length - 1;

// The same line as the sign-up screen.
const TAGLINE = 'Meet people who matter most.'.split(' ');

const FADE_MS = 420; // one character coming in
const STAGGER_MS = 200; // gap between characters
const WORD_FADE_MS = 380; // one word coming in
const WORD_STAGGER_MS = 170; // gap between words
const REVEAL_MS = STAGGER_MS * (LETTERS - 1) + FADE_MS;
const WORDS_MS = WORD_STAGGER_MS * (TAGLINE.length - 1) + WORD_FADE_MS;
const ZOOM_MS = 1500; // everything, once
const HOLD_MS = 300;
export const SPLASH_MIN_MS = REVEAL_MS + WORDS_MS + ZOOM_MS + HOLD_MS;

export function Splash() {
  const covers = useRef(EDGES.slice(0, LETTERS).map(() => new Animated.Value(1))).current;
  const words = useRef(TAGLINE.map(() => new Animated.Value(0))).current;
  const zoom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const run = Animated.sequence([
      Animated.stagger(
        STAGGER_MS,
        covers.map((cover) => Animated.timing(cover, { toValue: 0, duration: FADE_MS, easing: ease, useNativeDriver: true }))
      ),
      Animated.stagger(
        WORD_STAGGER_MS,
        words.map((word) => Animated.timing(word, { toValue: 1, duration: WORD_FADE_MS, easing: ease, useNativeDriver: true }))
      ),
      Animated.timing(zoom, { toValue: 1, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [covers, words, zoom]);

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
        <View style={styles.tagline} accessible accessibilityLabel={TAGLINE.join(' ')}>
          {TAGLINE.map((word, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.word,
                {
                  opacity: words[i],
                  transform: [{ translateY: words[i].interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
                },
              ]}
            >
              {word}
            </Animated.Text>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// The wordmark is always black on white, whatever the theme.
const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  cover: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#FFFFFF' },
  tagline: {
    position: 'absolute',
    top: WORDMARK_BOTTOM + 14,
    left: -40,
    right: -40,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  word: { fontFamily: fonts.bodyRegular, fontSize: 15, letterSpacing: 0.2, color: '#1A1A1A' },
});

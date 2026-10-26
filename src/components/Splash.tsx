import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { fonts } from '../theme/typography';

const LOGO = require('../assets/images/olga-logo.png');
const LOGO_SIZE = 288;
// The wordmark's lowest ink inside the artwork (the tail of the g).
const WORDMARK_BOTTOM = 176;

// Where each character of the wordmark ends inside the 288-wide artwork
// (O, l, -, g, a), measured from the image. Each character sits under its own
// white cover, so the name can appear piece by piece.
const EDGES = [0, 122.3, 132.6, 147.8, 184.1, LOGO_SIZE];
const LETTERS = EDGES.length - 1;
// The hyphen inside the artwork (measured): its two ends and its middle line.
const HYPHEN_LEFT = 133;
const HYPHEN_RIGHT = 147;
const HYPHEN_Y = 143;

// The hyphen in Ol-ga joins two halves, as Ol-ga joins two people. So: two
// people (coral dots) go live on either side with one soft pulse, glide
// together and meet where the hyphen is; they become it, one ring spreads
// from the meeting (a match), and the name opens out from there: l and g,
// then O and a. The line beneath arrives word by word, and the whole of it
// zooms in once.
const BRAND = '#EC6A55';
const DOT = 8;
const START_GAP = 104; // how far out each person starts, from the hyphen's ends
const APPEAR_MS = 260;
const PULSE_MS = 900;
const MEET_AT_MS = 320;
const MEET_MS = 760;
const MET_MS = MEET_AT_MS + MEET_MS;
const RING_MS = 1000;
const FADE_MS = 460; // one character coming in
const PAIR_STAGGER_MS = 170; // l and g, then O and a
// Covers in the order they lift: the hyphen, l and g together, O and a together.
const ORDER = [[2], [1, 3], [0, 4]];
const REVEAL_MS = PAIR_STAGGER_MS * (ORDER.length - 1) + FADE_MS;

// The same line as the sign-up screen.
const TAGLINE = 'Meet people who matter most.'.split(' ');
const WORD_FADE_MS = 420; // one word coming in
const WORD_STAGGER_MS = 120; // gap between words
const WORDS_MS = WORD_STAGGER_MS * (TAGLINE.length - 1) + WORD_FADE_MS;
// The phases overlap a little, so it reads as one continuous motion.
const OVERLAP_MS = 180;
const ZOOM_MS = 1300; // everything, once
const HOLD_MS = 150;
export const SPLASH_MIN_MS = MET_MS + REVEAL_MS + WORDS_MS + ZOOM_MS + HOLD_MS - OVERLAP_MS * 2;
// The splash then fades away over the app instead of cutting to it.
export const SPLASH_FADE_MS = 380;
// Apple-style ease: quick start, long soft settle.
const SOFT = Easing.bezier(0.22, 1, 0.36, 1);
// Gliding together: unhurried at both ends.
const GLIDE = Easing.bezier(0.65, 0, 0.35, 1);

export function Splash() {
  const covers = useRef(EDGES.slice(0, LETTERS).map(() => new Animated.Value(1))).current;
  const words = useRef(TAGLINE.map(() => new Animated.Value(0))).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const meet = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timing = (v: Animated.Value, toValue: number, duration: number, easing = SOFT) =>
      Animated.timing(v, { toValue, duration, easing, useNativeDriver: true });
    const after = (ms: number, anim: Animated.CompositeAnimation) => Animated.sequence([Animated.delay(ms), anim]);
    const letters = Animated.stagger(
      PAIR_STAGGER_MS,
      ORDER.map((group) => Animated.parallel(group.map((i) => timing(covers[i], 0, FADE_MS))))
    );
    const line = Animated.stagger(
      WORD_STAGGER_MS,
      words.map((word) => timing(word, 1, WORD_FADE_MS))
    );
    const run = Animated.parallel([
      timing(appear, 1, APPEAR_MS),
      timing(pulse, 1, PULSE_MS, Easing.out(Easing.quad)),
      after(MEET_AT_MS, timing(meet, 1, MEET_MS, GLIDE)),
      after(MET_MS - 60, timing(ring, 1, RING_MS, Easing.out(Easing.cubic))),
      after(MET_MS - 80, letters),
      after(MET_MS + REVEAL_MS - OVERLAP_MS, line),
      after(MET_MS + REVEAL_MS + WORDS_MS - OVERLAP_MS * 2, timing(zoom, 1, ZOOM_MS, Easing.inOut(Easing.cubic))),
    ]);
    run.start();
    return () => run.stop();
  }, [covers, words, zoom, appear, pulse, meet, ring]);

  // A gentle zoom, and the name settles up from just below as it appears.
  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const rise = covers[LETTERS - 1].interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  // The two people hand over to the hyphen as they meet.
  const dotsOpacity = Animated.multiply(appear, meet.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] }));

  const person = (side: -1 | 1) => {
    const end = side < 0 ? HYPHEN_LEFT + DOT / 2 : HYPHEN_RIGHT - DOT / 2;
    const travel = meet.interpolate({ inputRange: [0, 1], outputRange: [side * START_GAP, 0] });
    return (
      <View key={side} style={[styles.at, { left: end, top: HYPHEN_Y }]} pointerEvents="none">
        {/* Going live: one soft pulse where they start. */}
        <Animated.View
          style={[
            styles.ring,
            styles.pulse,
            {
              opacity: pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
              transform: [{ translateX: side * START_GAP }, { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 4.5] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dotsOpacity,
              transform: [{ translateX: travel }, { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
            },
          ]}
        />
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.logo, { transform: [{ scale }, { translateY: rise }] }]}>
        <Animated.Image source={LOGO} resizeMode="contain" style={styles.logo} />
        {covers.map((opacity, i) => (
          <Animated.View
            key={EDGES[i]}
            style={[styles.cover, { left: EDGES[i], width: EDGES[i + 1] - EDGES[i] + 0.5, opacity }]}
          />
        ))}
        {/* The match: one ring spreading from where they met. */}
        <View style={[styles.at, { left: (HYPHEN_LEFT + HYPHEN_RIGHT) / 2, top: HYPHEN_Y }]} pointerEvents="none">
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ring.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.5, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 16] }) }],
              },
            ]}
          />
        </View>
        {person(-1)}
        {person(1)}
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
  // A zero-size anchor; what's inside is centred on it.
  at: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: BRAND },
  ring: { position: 'absolute', width: DOT * 2, height: DOT * 2, borderRadius: DOT, borderWidth: 1, borderColor: BRAND },
  pulse: { borderWidth: 1.5 },
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

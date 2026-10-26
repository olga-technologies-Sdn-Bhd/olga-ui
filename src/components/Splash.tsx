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

const FADE_MS = 460; // one character coming in
const STAGGER_MS = 150; // gap between characters
const WORD_FADE_MS = 420; // one word coming in
const WORD_STAGGER_MS = 120; // gap between words
const REVEAL_MS = STAGGER_MS * (LETTERS - 1) + FADE_MS;
const WORDS_MS = WORD_STAGGER_MS * (TAGLINE.length - 1) + WORD_FADE_MS;
// The phases overlap a little, so it reads as one continuous motion.
const OVERLAP_MS = 180;
const ZOOM_MS = 1300; // everything, once
const HOLD_MS = 150;
export const SPLASH_MIN_MS = REVEAL_MS + WORDS_MS + ZOOM_MS + HOLD_MS - OVERLAP_MS * 2;
// The splash then fades away over the app instead of cutting to it.
export const SPLASH_FADE_MS = 380;
// Apple-style ease: quick start, long soft settle.
const SOFT = Easing.bezier(0.22, 1, 0.36, 1);

// Behind the name, quietly: people (dots) appear around it and the ones that
// fit link up, as members do on Ol-ga; three links are matches, in the brand
// colour. Points are offsets from the centre, kept clear of the wordmark and
// the line beneath it.
const SPREAD = 0.86; // kept well inside the narrowest phones
const PEOPLE: [number, number][] = (
  [
    [-130, -190], [-40, -232], [72, -206], [152, -150], [-168, -108], [8, -150], [178, -60],
    [-176, 124], [168, 118], [-150, 160], [-48, 212], [62, 186], [142, 226], [-112, 252],
  ] as [number, number][]
).map(([x, y]) => [x * SPREAD, y * SPREAD]);
// Two small circles of people, one above the name and one below.
const LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [3, 6], [7, 9], [9, 10], [10, 13], [11, 12], [8, 12],
];
// The matches: drawn last, in the brand colour, their people a touch larger.
const MATCHES: [number, number][] = [[5, 2], [10, 11], [9, 13]];
const MATCHED = new Set(MATCHES.flat());
const BRAND = '#EC6A55';
const DOT_MS = 380;
const DOT_STAGGER_MS = 55;
const LINK_MS = 460;
const LINK_STAGGER_MS = 65;
const LINKS_AT_MS = 320;
const MATCHES_AT_MS = LINKS_AT_MS + LINK_STAGGER_MS * LINKS.length + 120;

function Link({ from, to, progress, match }: { from: [number, number]; to: [number, number]; progress: Animated.Value; match?: boolean }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return (
    <Animated.View
      style={[
        styles.link,
        match && styles.match,
        {
          left: from[0],
          top: from[1],
          width: Math.hypot(dx, dy),
          opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
          // Drawn out from the first person to the second.
          transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }, { scaleX: progress }],
        },
      ]}
    />
  );
}

// The network, drawn in under the name, then settling back as it zooms.
function Network({ settle }: { settle: Animated.Value }) {
  const dots = useRef(PEOPLE.map(() => new Animated.Value(0))).current;
  const links = useRef(LINKS.map(() => new Animated.Value(0))).current;
  const matches = useRef(MATCHES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const ease = (v: Animated.Value, ms: number) => Animated.timing(v, { toValue: 1, duration: ms, easing: SOFT, useNativeDriver: true });
    const run = Animated.parallel([
      Animated.stagger(DOT_STAGGER_MS, dots.map((d) => ease(d, DOT_MS))),
      Animated.sequence([Animated.delay(LINKS_AT_MS), Animated.stagger(LINK_STAGGER_MS, links.map((l) => ease(l, LINK_MS)))]),
      Animated.sequence([Animated.delay(MATCHES_AT_MS), Animated.stagger(140, matches.map((m) => ease(m, LINK_MS + 140)))]),
    ]);
    run.start();
    return () => run.stop();
  }, [dots, links, matches]);

  // Matched people swell once as their link completes.
  const swell = (i: number) => {
    const m = MATCHES.findIndex((pair) => pair.includes(i));
    return m < 0 ? 1 : matches[m].interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1.5, 1.15] });
  };

  return (
    <Animated.View
      style={[
        styles.network,
        {
          opacity: settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
          transform: [{ scale: settle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
        },
      ]}
      pointerEvents="none"
    >
      {LINKS.map(([a, b], i) => (
        <Link key={`l${i}`} from={PEOPLE[a]} to={PEOPLE[b]} progress={links[i]} />
      ))}
      {MATCHES.map(([a, b], i) => (
        <Link key={`m${i}`} from={PEOPLE[a]} to={PEOPLE[b]} progress={matches[i]} match />
      ))}
      {PEOPLE.map(([x, y], i) => (
        <Animated.View
          key={`p${i}`}
          style={[
            styles.dot,
            MATCHED.has(i) && styles.dotMatched,
            {
              left: x,
              top: y,
              opacity: dots[i],
              transform: [{ scale: Animated.multiply(dots[i].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), swell(i)) }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

export function Splash() {
  const covers = useRef(EDGES.slice(0, LETTERS).map(() => new Animated.Value(1))).current;
  const words = useRef(TAGLINE.map(() => new Animated.Value(0))).current;
  const zoom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const letters = Animated.stagger(
      STAGGER_MS,
      covers.map((cover) => Animated.timing(cover, { toValue: 0, duration: FADE_MS, easing: SOFT, useNativeDriver: true }))
    );
    const line = Animated.stagger(
      WORD_STAGGER_MS,
      words.map((word) => Animated.timing(word, { toValue: 1, duration: WORD_FADE_MS, easing: SOFT, useNativeDriver: true }))
    );
    const grow = Animated.timing(zoom, { toValue: 1, duration: ZOOM_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    // Each phase starts just before the last one finishes.
    const run = Animated.parallel([
      letters,
      Animated.sequence([Animated.delay(REVEAL_MS - OVERLAP_MS), line]),
      Animated.sequence([Animated.delay(REVEAL_MS + WORDS_MS - OVERLAP_MS * 2), grow]),
    ]);
    run.start();
    return () => run.stop();
  }, [covers, words, zoom]);

  // A gentle zoom, and the name settles up from just below as it appears.
  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const rise = covers[LETTERS - 1].interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <View style={styles.wrap}>
      <Network settle={zoom} />
      <Animated.View style={[styles.logo, { transform: [{ scale }, { translateY: rise }] }]}>
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
  // The network's origin is the centre of the screen; points are offsets from it.
  network: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
  // A hairline from its left end, turned towards the other person.
  link: { position: 'absolute', height: 1, marginTop: -0.5, backgroundColor: '#E4DED6', transformOrigin: '0% 50%' },
  match: { height: 1.5, marginTop: -0.75, backgroundColor: BRAND, opacity: 0.75 },
  dot: { position: 'absolute', width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: 3, backgroundColor: '#CBC3B9' },
  dotMatched: { width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: 4, backgroundColor: BRAND },
});

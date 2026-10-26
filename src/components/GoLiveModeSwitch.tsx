import { Bluetooth, Globe, Ticket } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { GoLiveMode } from '../context/NearbyContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { semibold } from '../theme/typography';

// The three ways to Go Live, side by side: one at an event, one with people
// close by (Bluetooth), one with members anywhere. The line under the switch
// says what the chosen one does, so they're never confused.
const MODES: { value: GoLiveMode; label: string; icon: typeof Ticket; line: string }[] = [
  { value: 'event', label: 'Event', icon: Ticket, line: 'People in your event’s room, while you’re there.' },
  { value: 'nearby', label: 'Nearby', icon: Bluetooth, line: 'People a few metres away, over Bluetooth. Works offline.' },
  { value: 'anywhere', label: 'Anywhere', icon: Globe, line: 'Members anywhere who offer what you’re looking for.' },
];

const SWITCH_HEIGHT = 36;
const OPTION_W = 100;
const LINE_HEIGHT = 17;

// The radar flies the wordmark up to the header row, so it needs the height
// above it: header half-height 15 + gap 12 + switch + gap 8 + line + gap 12.
export const HEADER_ABOVE_WITH_SWITCH = 15 + 12 + SWITCH_HEIGHT + 8 + LINE_HEIGHT + 12;

type Props = {
  mode: GoLiveMode;
  onChange: (mode: GoLiveMode) => void;
  // While live in this mode: the others wait until it ends.
  disabled?: boolean;
  // No internet: Event and Anywhere need Ol-ga, so they're shown faded (still
  // tappable, so the screen can say why).
  offline?: boolean;
  // In GoLiveTop: the page's scroll position, to tuck the line away.
  scrollY?: Animated.Value;
};

export function GoLiveModeSwitch({ mode, onChange, disabled, offline, scrollY }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const index = Math.max(0, MODES.findIndex((m) => m.value === mode));
  // The white pill glides to the chosen option and stretches in flight (native driver).
  const x = useRef(new Animated.Value(index * OPTION_W)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(x, { toValue: index * OPTION_W, damping: 18, stiffness: 190, mass: 0.9, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1.14, duration: 120, useNativeDriver: true }),
        Animated.spring(stretch, { toValue: 1, damping: 11, stiffness: 170, useNativeDriver: true }),
      ]),
    ]).start();
  }, [index, x, stretch]);

  const compact = scrollY && { transform: [{ scale: scrollY.interpolate({ inputRange: [0, COLLAPSE_AT], outputRange: [1, 0.94], extrapolate: 'clamp' }) }] };
  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.switch, disabled && styles.dimmed, compact]} accessibilityRole="tablist">
        <Animated.View style={[styles.pill, { transform: [{ translateX: x }, { scaleX: stretch }] }]} />
        {MODES.map(({ value, label, icon: Icon }) => {
          const on = mode === value;
          const faded = offline && value !== 'nearby';
          return (
            <Pressable
              key={value}
              onPress={() => !disabled && value !== mode && onChange(value)}
              accessibilityRole="tab"
              accessibilityLabel={`Go Live: ${label}`}
              accessibilityState={{ selected: on, disabled }}
              style={[styles.option, faded && styles.faded]}
            >
              <Icon size={13} color={on ? colors.text : colors.muted} strokeWidth={2.2} />
              <Text style={[styles.text, on && styles.textOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
      <Animated.Text
        style={[
          styles.line,
          scrollY && {
            opacity: scrollY.interpolate({ inputRange: [0, COLLAPSE_AT * 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
            transform: [{ translateY: scrollY.interpolate({ inputRange: [0, COLLAPSE_AT], outputRange: [0, -6], extrapolate: 'clamp' }) }],
          },
        ]}
        numberOfLines={1}
        accessibilityLiveRegion="polite"
      >
        {MODES[index].line}
      </Animated.Text>
    </View>
  );
}

// Scrolled this far, the top bar is compact: its ground has faded in and the
// line under the switch has tucked away.
const COLLAPSE_AT = 40;

// Go Live's top bar, pinned while the page scrolls (Screen's header): the
// title row and, before going live, the mode switch. Scrolling, its ground
// fades in (the page's warm top, feathering out below: no line, no shadow),
// the line under the switch goes and the switch eases into a compact pill,
// so the content slips softly beneath; back at the top it opens out again.
export function GoLiveTop({ scrollY, children, modeSwitch }: { scrollY: Animated.Value; children: React.ReactNode; modeSwitch?: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ground = scrollY.interpolate({ inputRange: [0, COLLAPSE_AT * 0.6], outputRange: [0, 1], extrapolate: 'clamp' });
  const tuck = modeSwitch ? scrollY.interpolate({ inputRange: [0, COLLAPSE_AT], outputRange: [0, -(8 + LINE_HEIGHT)], extrapolate: 'clamp' }) : 0;
  return (
    <View style={styles.top} pointerEvents="box-none">
      <Animated.View style={[styles.ground, { opacity: ground, transform: [{ translateY: tuck }] }]} pointerEvents="none">
        <LinearGradient colors={[colors.glowTop, colors.bg, colors.bg, colors.bgClear]} locations={[0, 0.55, 0.86, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {children}
      {modeSwitch}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    top: { paddingHorizontal: 20, gap: 12 },
    // Reaches up under the status bar and feathers out a little below the bar.
    ground: { position: 'absolute', top: -200, left: 0, right: 0, bottom: -34 },
    wrap: { alignItems: 'center', gap: 8 },
    switch: { flexDirection: 'row', height: SWITCH_HEIGHT, backgroundColor: colors.surface2, borderRadius: 999, padding: 3 },
    pill: { position: 'absolute', top: 3, bottom: 3, left: 3, width: OPTION_W, borderRadius: 999, backgroundColor: colors.surface },
    option: { width: OPTION_W, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, borderRadius: 999 },
    text: { fontSize: 12, fontWeight: semibold, color: colors.muted },
    textOn: { color: colors.text },
    faded: { opacity: 0.45 },
    dimmed: { opacity: 0.5 },
    line: { fontSize: 12, lineHeight: LINE_HEIGHT, color: colors.muted, textAlign: 'center' },
  });

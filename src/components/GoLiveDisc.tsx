import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';
import { PulseRings } from './PulseRings';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Boards 05, 06, 08 and 12. Hold about a second to go live: the ring fills
// while held and nothing happens until it completes; letting go early
// cancels. Live is also said in words and by the green waves, never by the
// disc colour alone.
const HOLD_MS = 1000;
const DISC = 156;
const RING = DISC + 22;
const STROKE = 4;
const R = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Props = {
  fill: string;
  textColor: string;
  label: string;
  caption?: string;
  // Locked (before the room opens): a flat sand disc, no hold.
  locked?: boolean;
  // Green waves while searching or live.
  waves?: boolean;
  onHoldComplete?: () => void;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function GoLiveDisc({
  fill,
  textColor,
  label,
  caption,
  locked,
  waves,
  onHoldComplete,
  onPress,
  disabled,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const progress = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const holding = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => () => holding.current?.stop(), []);

  const canHold = Boolean(onHoldComplete) && !locked && !disabled;

  function startHold() {
    Animated.spring(press, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start();
    if (!canHold) return;
    holding.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    holding.current.start(({ finished }) => {
      holding.current = null;
      if (finished) {
        progress.setValue(0);
        onHoldComplete?.();
      }
    });
  }

  function endHold() {
    Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
    if (holding.current) {
      holding.current.stop();
      holding.current = null;
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    }
  }

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE, 0] });

  return (
    <View style={styles.wrap}>
      <PulseRings active={Boolean(waves)} size={DISC} maxScale={1.6} color={colors.liveFill} />
      <View style={styles.halo}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={colors.line} strokeWidth={1} fill="none" />
          <AnimatedCircle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={colors.liveFill}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <Pressable
          onPressIn={startHold}
          onPressOut={endHold}
          onPress={onPress}
          disabled={disabled || locked}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={canHold ? 'Press and hold to go live' : undefined}
        >
          <Animated.View
            style={[
              styles.disc,
              { backgroundColor: locked ? colors.accentSoft : fill, transform: [{ scale: press }] },
              !locked && fill.toUpperCase() === '#FFFDF9' && styles.pearl,
            ]}
          >
            <Text style={[styles.label, { color: locked ? colors.brand2 : textColor }]} numberOfLines={1} adjustsFontSizeToFit>
              {label}
            </Text>
            {caption && (
              <Text style={[styles.caption, { color: locked ? colors.brand2 : textColor }]} numberOfLines={1}>
                {caption}
              </Text>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 22, height: RING + 24 },
    halo: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
    disc: {
      width: DISC,
      height: DISC,
      borderRadius: DISC / 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    pearl: { borderWidth: 1, borderColor: colors.line },
    label: { fontFamily: fonts.headingExtraBold, fontSize: 25, fontWeight: '800', letterSpacing: 0.5 },
    caption: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginTop: 4, opacity: 0.85 },
  });

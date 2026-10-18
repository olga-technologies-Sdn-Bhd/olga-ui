import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

export const TAB_BAR_HEIGHT = 58;
const PILL_INSET = 4;
const ICON_SIZE = 21;

export type GlassTab = { icon: LucideIcon; label: string; strong?: boolean };

type Props = BottomTabBarProps & { tabs: Record<string, GlassTab>; hidden?: boolean };

// A floating glass capsule. The active tab sits on a soft pill that glides to
// the next tab with a liquid stretch (it widens in flight, then settles), and
// the icons cross-fade between grey and navy. Everything runs on the native
// animation driver, so it stays smooth while JS is busy.
export function GlassTabBar({ state, navigation, tabs, hidden }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bottom } = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const slot = width > 0 ? (width - PILL_INSET * 2) / count : 0;

  const x = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);
  const last = useRef(state.index);

  useEffect(() => {
    if (!slot) return;
    const to = state.index * slot;
    if (!placed.current) {
      x.setValue(to);
      placed.current = true;
      last.current = state.index;
      return;
    }
    // Further jumps stretch more, like a drop of liquid pulled across.
    const distance = Math.abs(state.index - last.current);
    last.current = state.index;
    Animated.parallel([
      Animated.spring(x, { toValue: to, damping: 18, stiffness: 190, mass: 0.9, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1 + Math.min(0.55, 0.22 * distance), duration: 120, useNativeDriver: true }),
        Animated.spring(stretch, { toValue: 1, damping: 11, stiffness: 170, useNativeDriver: true }),
      ]),
    ]).start();
  }, [state.index, slot, x, stretch]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (hidden) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(bottom, 8) + 6 }]}>
      <View style={styles.bar} onLayout={onLayout}>
        <View style={[StyleSheet.absoluteFill, styles.clip]}>
          {/* No real blur in React Native: a frosted underlay keeps text behind the bar from showing through. */}
          <View style={[StyleSheet.absoluteFill, styles.frost]} />
          <LinearGradient colors={[colors.glass, colors.glassLow]} style={StyleSheet.absoluteFill} />
          <View style={[styles.highlight, { borderColor: colors.glassHighlight }]} />
        </View>
        {slot > 0 && <Animated.View style={[styles.pill, { width: slot, transform: [{ translateX: x }, { scaleX: stretch }] }]} />}
        {state.routes.map((route, i) => {
          const tab = tabs[route.name];
          const focused = state.index === i;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <TabButton
              key={route.key}
              tab={tab}
              focused={focused}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              styles={styles}
              colors={colors}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({
  tab,
  focused,
  onPress,
  onLongPress,
  styles,
  colors,
}: {
  tab: GlassTab;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  // A small lift when a tab becomes active, a press-in squeeze, and the
  // grey and navy versions cross-fading.
  const scale = useRef(new Animated.Value(1)).current;
  const on = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const wasFocused = useRef(focused);
  useEffect(() => {
    Animated.timing(on, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    if (focused && !wasFocused.current) {
      scale.setValue(0.86);
      Animated.spring(scale, { toValue: 1, damping: 9, stiffness: 220, useNativeDriver: true }).start();
    }
    wasFocused.current = focused;
  }, [focused, scale, on]);

  const Icon = tab.icon;
  const idle = tab.strong ? colors.charcoal : colors.muted;
  const off = on.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.9, speed: 40, bounciness: 0, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }).start()}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.label}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        <View>
          <Animated.View style={{ opacity: off }}>
            <Icon size={ICON_SIZE} color={idle} strokeWidth={tab.strong ? 2.4 : 1.8} />
          </Animated.View>
          <Animated.View style={[styles.layer, { opacity: on }]}>
            <Icon size={ICON_SIZE} color={colors.accent} strokeWidth={2.4} />
          </Animated.View>
        </View>
        <View>
          <Animated.Text style={[styles.label, { color: idle, opacity: off }]} numberOfLines={1}>
            {tab.label}
          </Animated.Text>
          <Animated.Text style={[styles.label, styles.layer, { color: colors.accent, opacity: on }]} numberOfLines={1}>
            {tab.label}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 24, right: 24 },
    bar: {
      height: TAB_BAR_HEIGHT,
      borderRadius: TAB_BAR_HEIGHT / 2,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: PILL_INSET,
      borderWidth: 1,
      borderColor: colors.glassLine,
      // A soft lift on iOS; Android draws elevation shadows through
      // translucent fills, so it goes without.
      ...Platform.select({
        ios: { shadowColor: '#0B1220', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
        default: {},
      }),
    },
    clip: { borderRadius: TAB_BAR_HEIGHT / 2, overflow: 'hidden' },
    frost: { backgroundColor: colors.bg, opacity: 0.85 },
    // Light catching the top edge of the glass.
    highlight: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: TAB_BAR_HEIGHT / 2,
      borderTopWidth: 1,
      borderLeftWidth: 0.5,
      borderRightWidth: 0.5,
      borderBottomWidth: 0,
    },
    pill: {
      position: 'absolute',
      left: PILL_INSET,
      top: PILL_INSET,
      bottom: PILL_INSET,
      borderRadius: (TAB_BAR_HEIGHT - PILL_INSET * 2) / 2,
      backgroundColor: colors.accentFill,
    },
    tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
    tabInner: { alignItems: 'center', gap: 2 },
    label: { fontSize: 10, fontWeight: '600' },
    layer: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  });

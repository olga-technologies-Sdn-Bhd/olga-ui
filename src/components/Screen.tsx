import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StatusBar, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { TopGlow } from './TopGlow';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  // Extra content padding/layout, e.g. a chat screen with a pinned composer.
  contentStyle?: StyleProp<ViewStyle>;
  // Drawn behind the content; every screen gets the warm top glow unless it
  // passes its own (or sets its own ground through style).
  background?: React.ReactNode;
  // false: no glow, for a panel embedded under another screen's header.
  glow?: boolean;
  // Pull-to-refresh (scrolling screens only).
  onRefresh?: () => Promise<void>;
};

// Android targets edge-to-edge display (OS-enforced on API 35+), so the app
// must account for the status bar inset itself rather than relying on the
// window to do it. useSafeAreaInsets() can lag/report 0 briefly, so it's
// combined with StatusBar.currentHeight (a synchronous OS value) as a floor.
export function useTopInset() {
  const insets = useSafeAreaInsets();
  const androidFallback = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  return Math.max(insets.top, androidFallback);
}

// The APIs can take up to a minute to answer after idling (cold start). The
// pull-to-refresh spinner stops after this long; the request carries on and
// the screen updates when the data arrives.
const REFRESH_SPINNER_MAX_MS = 10000;

// Room at the bottom of every screen so content clears the floating tab bar
// (58 tall, sitting 40 above the edge on an iPhone with a home indicator).
export const FLOATING_TAB_SPACE = 116;

export function usePullToRefresh(onRefresh?: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    const run = ++latest.current;
    const stop = () => {
      if (latest.current === run) setRefreshing(false);
    };
    setRefreshing(true);
    const timer = setTimeout(stop, REFRESH_SPINNER_MAX_MS);
    try {
      await onRefresh();
    } finally {
      clearTimeout(timer);
      stop();
    }
  }, [onRefresh]);
  return { refreshing, handleRefresh };
}

export function Screen({ children, scroll = true, style, contentStyle, background, glow = true, onRefresh }: Props) {
  const { refreshing, handleRefresh } = usePullToRefresh(onRefresh);
  const topInset = useTopInset();
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1 },
        page: { flex: 1, backgroundColor: colors.bg },
        container: { flex: 1, backgroundColor: 'transparent' },
        content: { paddingHorizontal: 20, paddingBottom: FLOATING_TAB_SPACE, gap: 12 },
      }),
    [colors]
  );
  const content = [styles.content, { paddingTop: 12 + topInset }, contentStyle];
  const containerStyle = [styles.container, style];

  const body = scroll ? (
    <ScrollView
      style={containerStyle}
      contentContainerStyle={content}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[containerStyle, content]}>{children}</View>
  );

  return (
    <View style={styles.page}>
      {background ?? (glow ? <TopGlow height={300} /> : null)}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? topInset : 0}
      >
        {body}
      </KeyboardAvoidingView>
    </View>
  );
}

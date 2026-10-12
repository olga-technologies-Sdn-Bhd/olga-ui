import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  background?: React.ReactNode;
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

// Room at the bottom of every screen so content clears the floating tab bar.
export const FLOATING_TAB_SPACE = 100;

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

export function Screen({ children, scroll = true, style, background, onRefresh }: Props) {
  const { refreshing, handleRefresh } = usePullToRefresh(onRefresh);
  const topInset = useTopInset();
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1 },
        container: { flex: 1, backgroundColor: colors.bg },
        transparent: { backgroundColor: 'transparent' },
        content: { paddingHorizontal: 20, paddingBottom: FLOATING_TAB_SPACE, gap: 12 },
      }),
    [colors]
  );
  const content = [styles.content, { paddingTop: 12 + topInset }];
  const containerStyle = [styles.container, background ? styles.transparent : null, style];

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
    <View style={styles.flex}>
      {background}
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

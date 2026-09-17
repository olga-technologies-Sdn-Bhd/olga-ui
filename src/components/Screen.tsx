import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
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

export function Screen({ children, scroll = true, style }: Props) {
  const topInset = useTopInset();
  const content = [styles.content, { paddingTop: 20 + topInset }];

  const body = scroll ? (
    <ScrollView style={[styles.container, style]} contentContainerStyle={content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.container, content, style]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? topInset : 0}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
});

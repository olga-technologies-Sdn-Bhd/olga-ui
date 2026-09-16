import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, scroll = true, style }: Props) {
  const insets = useSafeAreaInsets();
  const content = [styles.content, { paddingTop: 20 + insets.top }];

  if (!scroll) {
    return <View style={[styles.container, content, style]}>{children}</View>;
  }
  return (
    <ScrollView style={[styles.container, style]} contentContainerStyle={content}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
});

import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  soft?: boolean;
  style?: ViewStyle;
};

export function Card({ children, soft, style }: Props) {
  return <View style={[styles.base, soft && styles.soft, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 16,
  },
  soft: {
    backgroundColor: colors.brandSoft,
    borderColor: '#ece4ff',
  },
});

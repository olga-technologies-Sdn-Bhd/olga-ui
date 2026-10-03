import { User } from 'lucide-react-native';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const SIZES = { sm: 34, md: 42, lg: 58 };

// Boards 04 and 09: the same neutral person silhouette on every anonymous
// card, in place of "?" or initials. Never a name or photo.
export function Silhouette({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const { colors } = useTheme();
  const d = SIZES[size];
  return (
    <View
      style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <User size={Math.round(d * 0.45)} color={colors.muted} strokeWidth={2} />
    </View>
  );
}

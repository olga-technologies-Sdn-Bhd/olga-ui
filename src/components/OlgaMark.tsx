import { Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// Ol-ga's mark: an apricot sparkle on a soft glow. Her avatar wherever she
// speaks in a chat (sign-up, your introduction, the Olga agent), and the mark
// on the Ask Ol-ga bar.
export function OlgaMark({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.glowSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Sparkles size={Math.round(size * 0.5)} color={colors.glow} strokeWidth={1.8} />
    </View>
  );
}

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  from: 'them' | 'me';
  text: string;
};

// Matches the prototype's `.chat.them` / `.chat.me` bubble styling.
export function ChatBubble({ from, text }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { maxWidth: '82%', alignSelf: 'flex-start' },
        wrapMe: { alignSelf: 'flex-end' },
        text: {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 18,
          fontSize: 14,
          lineHeight: 19,
          overflow: 'hidden',
        },
        textThem: { backgroundColor: colors.surface, color: colors.text },
        // Same accent hue as the rest of the app, at its lightest tint.
        textMe: { backgroundColor: colors.accentSoft, color: colors.text },
      }),
    [colors]
  );

  return (
    <View style={[styles.wrap, from === 'me' && styles.wrapMe]}>
      <Text style={[styles.text, from === 'me' ? styles.textMe : styles.textThem]}>{text}</Text>
    </View>
  );
}

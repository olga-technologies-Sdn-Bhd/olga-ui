import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Avatar } from './Avatar';

type Props = {
  from: 'them' | 'me';
  text: string;
};

// Ol-ga's messages sit on the left with her avatar; the member's on the right.
export function ChatBubble({ from, text }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { maxWidth: '82%', alignSelf: 'flex-start' },
        wrapMe: { alignSelf: 'flex-end' },
        row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '92%' },
        bubble: { flexShrink: 1 },
        text: {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 18,
          fontSize: 13,
          lineHeight: 18,
          overflow: 'hidden',
        },
        textThem: { backgroundColor: colors.surface, color: colors.text },
        // Same accent hue as the rest of the app, at its lightest tint.
        textMe: { backgroundColor: colors.accentSoft, color: colors.text },
      }),
    [colors]
  );

  if (from === 'them') {
    return (
      <View style={styles.row}>
        <Avatar initials="O" size="sm" dark />
        <Text style={[styles.text, styles.textThem, styles.bubble]}>{text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.wrap, styles.wrapMe]}>
      <Text style={[styles.text, styles.textMe]}>{text}</Text>
    </View>
  );
}

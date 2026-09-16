import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  from: 'them' | 'me';
  text: string;
};

// Matches the prototype's `.chat.them` / `.chat.me` bubble styling.
export function ChatBubble({ from, text }: Props) {
  return (
    <View style={[styles.wrap, from === 'me' && styles.wrapMe]}>
      <Text style={[styles.text, from === 'me' ? styles.textMe : styles.textThem]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  textThem: { backgroundColor: '#f3f0ed', color: colors.text },
  textMe: { backgroundColor: colors.brand, color: colors.white },
});

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

type Props = {
  from: 'them' | 'me';
  text: string;
  // Conversation extras (sign-up uses none of these).
  person?: boolean;
  time?: string; // the prototype's `.chat-time` line under the bubble
  status?: 'pending' | 'failed';
  deleted?: boolean;
  // Their message looked abusive: shown covered until tapped.
  hidden?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRetry?: () => void;
};

// Ol-ga's messages sit on the left with her avatar; the member's on the right.
// In a conversation (person), the other member's bubbles have no avatar.
export function ChatBubble({ from, text, person, time, status, deleted, hidden, onPress, onLongPress, onRetry }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { maxWidth: '82%', alignSelf: 'flex-start' },
        wrapMe: { alignSelf: 'flex-end' },
        row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '92%' },
        bubble: { flexShrink: 1 },
        // Ol-ga's avatar is her wordmark: black on white, in both themes.
        olga: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: 'center',
          justifyContent: 'center',
        },
        olgaText: { fontFamily: fonts.bodyRegular, fontSize: 11, fontWeight: '400', color: '#000000' },
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
        // In a conversation: WhatsApp-style tails, ink for mine, white for theirs.
        personMe: { backgroundColor: colors.bubbleMe, color: colors.onBubbleMe, borderBottomRightRadius: 6 },
        personThem: {
          backgroundColor: colors.bubbleThem,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.bubbleThemLine,
          borderBottomLeftRadius: 6,
        },
        textPending: { opacity: 0.6 },
        textDeleted: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.line,
          color: colors.muted,
          fontStyle: 'italic',
        },
        meta: { fontSize: 9, color: colors.muted, marginTop: 3 },
        metaMe: { textAlign: 'right' },
        failed: { fontSize: 11, color: colors.danger, marginTop: 4, textAlign: 'right', fontWeight: semibold },
      }),
    [colors]
  );

  if (from === 'them' && !person) {
    return (
      <View style={styles.row}>
        <View style={styles.olga}>
          <Text style={styles.olgaText}>Ol-ga</Text>
        </View>
        <Text style={[styles.text, styles.textThem, styles.bubble]}>{text}</Text>
      </View>
    );
  }
  const meta = status === 'pending' ? 'Sending…' : time;
  return (
    <View style={[styles.wrap, from === 'me' && styles.wrapMe]}>
      <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onLongPress && !onPress} delayLongPress={350}>
        <Text
          style={[
            styles.text,
            from === 'me' ? (person ? styles.personMe : styles.textMe) : person ? styles.personThem : styles.textThem,
            status === 'pending' && styles.textPending,
            (deleted || hidden) && styles.textDeleted,
          ]}
        >
          {deleted ? 'This message was deleted' : hidden ? 'Hidden: may be offensive. Tap to view' : text}
        </Text>
      </Pressable>
      {status === 'failed' ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={styles.failed}>Not sent · Tap to retry</Text>
        </Pressable>
      ) : (
        meta && <Text style={[styles.meta, from === 'me' && styles.metaMe]}>{meta}</Text>
      )}
    </View>
  );
}

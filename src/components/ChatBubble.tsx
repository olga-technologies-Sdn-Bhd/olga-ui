import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { OlgaMark } from './OlgaMark';
import { semibold } from '../theme/typography';

type Props = {
  from: 'them' | 'me';
  text: string;
  // A conversation with another member (no Ol-ga mark beside their bubbles).
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

// Ol-ga's messages sit on the left with her sparkle mark; the member's on the
// right. In a conversation (person), the other member's bubbles have no avatar.
export function ChatBubble({ from, text, person, time, status, deleted, hidden, onPress, onLongPress, onRetry }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { maxWidth: '82%', alignSelf: 'flex-start' },
        wrapMe: { alignSelf: 'flex-end' },
        row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '92%' },
        bubble: { flexShrink: 1 },
        // One chat look across the app (conversations, sign-up, your
        // introduction, the Olga agent): theirs and Ol-ga's on light grey with a
        // tail on the left, mine on sand with a tail on the right.
        text: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 20,
          fontSize: 15,
          lineHeight: 21,
          overflow: 'hidden',
        },
        them: {
          backgroundColor: colors.bubbleThem,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.bubbleThemLine,
          borderBottomLeftRadius: 6,
        },
        me: { backgroundColor: colors.bubbleMe, color: colors.onBubbleMe, borderBottomRightRadius: 6 },
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
        <OlgaMark size={32} />
        <Text style={[styles.text, styles.them, styles.bubble]}>{text}</Text>
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
            from === 'me' ? styles.me : styles.them,
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

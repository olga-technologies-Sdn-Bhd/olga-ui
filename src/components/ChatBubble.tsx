import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
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
  // My message on Ol-ga: ✓ sent, ✓✓ delivered, coloured ✓✓ seen.
  tick?: 'sent' | 'delivered' | 'read';
  deleted?: boolean;
  // Their message looked abusive: shown covered until tapped.
  hidden?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onRetry?: () => void;
  // Why it failed, in place of "Not sent" (e.g. a file type the server refused).
  failedText?: string;
  // A photo, PDF or voice note; `text` is then its caption (may be empty).
  media?: React.ReactNode;
};

// Ol-ga's messages sit on the left with her sparkle mark; the member's on the
// right. In a conversation (person), the other member's bubbles have no avatar.
export function ChatBubble({ from, text, person, time, status, tick, deleted, hidden, onPress, onLongPress, onRetry, failedText, media }: Props) {
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
        // A media bubble: the same colours and tail, tighter padding.
        mediaBox: { padding: 5, borderRadius: 20, overflow: 'hidden' },
        caption: { fontSize: 15, lineHeight: 21, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 3 },
        textDeleted: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.line,
          color: colors.muted,
          fontStyle: 'italic',
        },
        meta: { fontSize: 9, color: colors.muted, marginTop: 3 },
        metaMe: { textAlign: 'right' },
        metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 },
        metaInRow: { marginTop: 0 },
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
        {media && !deleted && !hidden ? (
          <View style={[styles.mediaBox, from === 'me' ? styles.me : styles.them]}>
            {media}
            {text ? <Text style={[styles.caption, { color: from === 'me' ? colors.onBubbleMe : colors.text }]}>{text}</Text> : null}
          </View>
        ) : (
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
        )}
      </Pressable>
      {status === 'failed' ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={styles.failed}>
            {failedText ?? 'Not sent'}
            {onRetry ? ' · Tap to retry' : ''}
          </Text>
        </Pressable>
      ) : tick && meta ? (
        <View style={styles.metaRow} accessibilityLabel={`${meta}, ${tick === 'read' ? 'seen' : tick}`}>
          <Text style={[styles.meta, styles.metaInRow]}>{meta}</Text>
          {tick === 'sent' ? (
            <Check size={12} color={colors.muted} />
          ) : (
            <CheckCheck size={12} color={tick === 'read' ? colors.brand : colors.muted} />
          )}
        </View>
      ) : (
        meta && <Text style={[styles.meta, from === 'me' && styles.metaMe]}>{meta}</Text>
      )}
    </View>
  );
}

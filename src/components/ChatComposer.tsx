import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, Mic, Paperclip, SendHorizontal } from 'lucide-react-native';
import { formatDuration } from '../chat/attachments';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  placeholder: string;
  onSubmit: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  // Controlled text (e.g. quick replies fill it); uncontrolled when omitted.
  value?: string;
  onChangeText?: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  // A mic in place of send while the box is empty (voice isn't built yet).
  voice?: boolean;
  // A paperclip on the left (photo, PDF).
  onAttach?: () => void;
  // Hold the mic to record a voice note: start on press, finish on release
  // (cancelled when slid left). recordingMs: shown while recording.
  onRecordStart?: () => void;
  onRecordEnd?: (cancelled: boolean) => void;
  recordingMs?: number | null;
};

// How far left a held mic slides before letting go cancels the note.
const CANCEL_SLIDE = 90;

// Matches the prototype's `.chat-composer` pill input + send button.
export function ChatComposer({
  placeholder,
  onSubmit,
  keyboardType = 'default',
  value: controlledValue,
  onChangeText,
  disabled,
  maxLength,
  voice,
  onAttach,
  onRecordStart,
  onRecordEnd,
  recordingMs = null,
}: Props) {
  const [ownValue, setOwnValue] = useState('');
  const value = controlledValue ?? ownValue;
  const setValue = onChangeText ?? setOwnValue;
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        disabled: { opacity: 0.5 },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: colors.surface,
          fontSize: 15,
          color: colors.text,
        },
        // A soft, deliberate near-black rather than the brand accent — a
        // distinct "send" affordance, not another brand-colored button.
        send: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // The paper plane, nudged right so it looks centred.
        sendIcon: { marginLeft: 2 },
        mic: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        attach: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
        recordMic: { transform: [{ scale: 1.25 }] },
        recording: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: colors.surface,
        },
        dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
        recordTime: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
        slide: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
        slideText: { fontSize: 13, color: colors.muted },
        cancelText: { fontSize: 13, color: colors.danger },
      }),
    [colors]
  );

  // The held mic: where the finger went down, and whether it has slid far
  // enough left to cancel.
  const startX = useRef(0);
  const [cancelling, setCancelling] = useState(false);
  const cancellingRef = useRef(false);
  const canRecord = Boolean(onRecordStart && onRecordEnd) && !disabled;

  function handleSend() {
    if (disabled || !value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  }

  return (
    <View style={[styles.wrap, disabled && styles.disabled]}>
      {onAttach && recordingMs === null && (
        <Pressable style={styles.attach} onPress={onAttach} hitSlop={8} disabled={disabled} accessibilityLabel="Attach a photo or file">
          <Paperclip size={21} color={colors.muted} strokeWidth={1.9} />
        </Pressable>
      )}
      {recordingMs !== null ? (
        <View style={styles.recording}>
          <View style={styles.dot} />
          <Text style={styles.recordTime}>{formatDuration(recordingMs)}</Text>
          <View style={styles.slide}>
            {cancelling ? (
              <Text style={styles.cancelText}>Release to cancel</Text>
            ) : (
              <>
                <ChevronLeft size={14} color={colors.muted} />
                <Text style={styles.slideText}>Slide to cancel</Text>
              </>
            )}
          </View>
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoCorrect={keyboardType !== 'email-address'}
          style={styles.input}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!disabled}
          maxLength={maxLength}
        />
      )}
      {canRecord && (!value.trim() || recordingMs !== null) ? (
        // A plain responder view, not a Pressable: it has to follow the
        // finger sliding left while held.
        <View
          style={[styles.send, recordingMs !== null && styles.recordMic]}
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => {
            startX.current = e.nativeEvent.pageX;
            cancellingRef.current = false;
            setCancelling(false);
            onRecordStart?.();
          }}
          onResponderMove={(e) => {
            const next = startX.current - e.nativeEvent.pageX > CANCEL_SLIDE;
            if (next !== cancellingRef.current) {
              cancellingRef.current = next;
              setCancelling(next);
            }
          }}
          onResponderRelease={() => onRecordEnd?.(cancellingRef.current)}
          onResponderTerminate={() => onRecordEnd?.(true)}
          accessibilityRole="button"
          accessibilityLabel="Hold to record a voice message"
        >
          <Mic size={20} color={colors.onInk} strokeWidth={2.1} />
        </View>
      ) : voice && !value.trim() ? (
        <View style={styles.mic} accessibilityLabel="Voice (coming soon)">
          <Mic size={20} color={colors.muted} strokeWidth={1.8} />
        </View>
      ) : (
        <Pressable style={styles.send} onPress={handleSend} hitSlop={12} disabled={disabled} accessibilityLabel="Send">
          <SendHorizontal size={19} color={colors.onInk} strokeWidth={2.2} style={styles.sendIcon} />
        </Pressable>
      )}
    </View>
  );
}

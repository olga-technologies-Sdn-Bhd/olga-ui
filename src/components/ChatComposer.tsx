import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Mic, SendHorizontal } from 'lucide-react-native';
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
};

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
      }),
    [colors]
  );

  function handleSend() {
    if (disabled || !value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  }

  return (
    <View style={[styles.wrap, disabled && styles.disabled]}>
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
      {voice && !value.trim() ? (
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

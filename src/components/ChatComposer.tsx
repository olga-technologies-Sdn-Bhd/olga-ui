import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SendHorizontal } from 'lucide-react-native';
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
          fontSize: 14,
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
        // WhatsApp's paper plane, nudged right so it looks centred.
        sendIcon: { marginLeft: 2 },
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
      <Pressable style={styles.send} onPress={handleSend} hitSlop={12} disabled={disabled} accessibilityLabel="Send">
        <SendHorizontal size={19} color={colors.onInk} strokeWidth={2.2} style={styles.sendIcon} />
      </Pressable>
    </View>
  );
}

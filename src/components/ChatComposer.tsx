import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  placeholder: string;
  onSubmit: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
};

// Matches the prototype's `.chat-composer` pill input + send button.
export function ChatComposer({ placeholder, onSubmit, keyboardType = 'default' }: Props) {
  const [value, setValue] = useState('');
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: colors.surface2,
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
        sendText: { color: colors.onInk, fontWeight: '800', fontSize: 17 },
      }),
    [colors]
  );

  function handleSend() {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  }

  return (
    <View style={styles.wrap}>
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
      />
      <Pressable style={styles.send} onPress={handleSend} hitSlop={12}>
        <Text style={styles.sendText}>↑</Text>
      </Pressable>
    </View>
  );
}

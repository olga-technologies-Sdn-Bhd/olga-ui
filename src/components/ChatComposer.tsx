import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  placeholder: string;
  onSubmit: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad';
};

// Matches the prototype's `.chat-composer` pill input + send button.
export function ChatComposer({ placeholder, onSubmit, keyboardType = 'default' }: Props) {
  const [value, setValue] = useState('');

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
        keyboardType={keyboardType}
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

const styles = StyleSheet.create({
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
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.white, fontWeight: '800', fontSize: 17 },
});

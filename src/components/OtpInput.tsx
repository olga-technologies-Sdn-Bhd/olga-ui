import { ElementRef, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
};

// Matches the prototype's `.otp` 6-box grid.
export function OtpInput({ value, onChange, length = 6 }: Props) {
  const inputs = useRef<Array<ElementRef<typeof TextInput> | null>>([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  function handleChange(text: string, index: number) {
    const clean = text.replace(/\D/g, '');
    const chars = value.split('');
    if (clean.length > 1) {
      // Handles pasting the full code into one box.
      onChange(clean.slice(0, length));
      inputs.current[Math.min(clean.length, length) - 1]?.focus();
      return;
    }
    chars[index] = clean;
    const next = chars.join('').slice(0, length);
    onChange(next);
    if (clean && index < length - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyPress(e: { nativeEvent: { key: string } }, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(el) => {
            inputs.current[index] = el;
          }}
          value={digit}
          onChangeText={(t) => handleChange(t, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={length}
          style={styles.box}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 18,
    backgroundColor: colors.white,
    color: colors.text,
  },
});

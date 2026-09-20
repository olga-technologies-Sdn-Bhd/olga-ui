import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from './Button';
import { colors } from '../theme/colors';

type Props = {
  placeholder: string;
  onAdd: (value: string) => void;
};

// Matches the prototype's `.tag-input-wrap` — a text field + small "Add" button.
export function TagInput({ placeholder, onAdd }: Props) {
  const [value, setValue] = useState('');

  function handleAdd() {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        maxLength={24}
        style={styles.input}
        onSubmitEditing={handleAdd}
        returnKeyType="done"
      />
      <Button label="Add" small onPress={handleAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.white,
    fontSize: 14,
  },
});

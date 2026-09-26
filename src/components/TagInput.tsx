import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button } from './Button';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  placeholder: string;
  onAdd: (value: string) => void;
};

// Matches the prototype's `.tag-input-wrap` — a text field + small "Add" button.
export function TagInput({ placeholder, onAdd }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
});

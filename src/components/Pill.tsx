import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Tone = 'default' | 'active' | 'green';

type Props = {
  label: string;
  tone?: Tone;
  onPress?: () => void;
};

export function Pill({ label, tone = 'default', onPress }: Props) {
  const content = (
    <View style={[styles.base, tone === 'active' && styles.active, tone === 'green' && styles.green]}>
      <Text style={[styles.label, tone === 'active' && styles.labelActive, tone === 'green' && styles.labelGreen]}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#f3f1f5',
    borderWidth: 1,
    borderColor: '#ece8ee',
    alignSelf: 'flex-start',
  },
  active: { backgroundColor: colors.brandSoft, borderColor: '#dbd0ff' },
  green: { backgroundColor: colors.greenSoft, borderColor: '#c7f2df' },
  label: { fontSize: 12, fontWeight: '700', color: '#4a4550' },
  labelActive: { color: colors.brand },
  labelGreen: { color: colors.green },
});

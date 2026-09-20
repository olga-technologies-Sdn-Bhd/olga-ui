import { StyleSheet, Text, View } from 'react-native';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  initials: string;
  size?: Size;
};

const SIZES: Record<Size, number> = { sm: 34, md: 42, lg: 58 };
const FONT_SIZES: Record<Size, number> = { sm: 12, md: 15, lg: 18 };

export function Avatar({ initials, size = 'md' }: Props) {
  const dimension = SIZES[size];
  return (
    <View style={[styles.base, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}>
      <Text style={[styles.text, { fontSize: FONT_SIZES[size] }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#eee7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    color: '#5a4c87',
  },
});

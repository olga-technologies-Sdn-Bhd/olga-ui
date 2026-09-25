import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Tone = 'default' | 'active' | 'soft' | 'green';

type Props = {
  label: string;
  tone?: Tone;
  onPress?: () => void;
};

export function Pill({ label, tone = 'default', onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 7,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: colors.line,
          alignSelf: 'flex-start',
        },
        active: { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft },
        // Accent-tinted, e.g. an attendee count — same hue as the rest of
        // the app rather than a separate status color.
        soft: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
        green: { backgroundColor: colors.greenSoft, borderColor: colors.greenSoft },
        label: { fontSize: 12, fontWeight: '700', color: colors.muted },
        labelActive: { color: colors.white },
        labelSoft: { color: colors.brand },
        labelGreen: { color: colors.green },
      }),
    [colors]
  );

  const content = (
    <View
      style={[
        styles.base,
        tone === 'active' && styles.active,
        tone === 'soft' && styles.soft,
        tone === 'green' && styles.green,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === 'active' && styles.labelActive,
          tone === 'soft' && styles.labelSoft,
          tone === 'green' && styles.labelGreen,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

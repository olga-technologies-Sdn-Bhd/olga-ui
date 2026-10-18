import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

type Tone = 'default' | 'active' | 'soft' | 'positive' | 'white';

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
        positive: { backgroundColor: colors.positiveSoft, borderColor: colors.positiveSoft },
        // On a tinted ground (a conversation's quick replies).
        white: { backgroundColor: colors.surface, borderColor: colors.line },
        label: { fontFamily: fonts.bodyBold, fontSize: 11, fontWeight: semibold, color: colors.muted },
        labelActive: { color: colors.text },
        labelSoft: { color: colors.brand },
        labelPositive: { color: colors.positive },
      }),
    [colors]
  );

  const content = (
    <View
      style={[
        styles.base,
        tone === 'active' && styles.active,
        tone === 'soft' && styles.soft,
        tone === 'positive' && styles.positive,
        tone === 'white' && styles.white,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === 'active' && styles.labelActive,
          tone === 'soft' && styles.labelSoft,
          tone === 'positive' && styles.labelPositive,
          tone === 'white' && styles.labelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

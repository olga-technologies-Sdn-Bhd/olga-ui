import { BriefcaseBusiness, Building2, Gauge, LucideIcon, Plus, Target } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatchFilters } from '../context/PrefsContext';
import { radius, ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts, semibold } from '../theme/typography';

export const SENIORITY_LABELS: Record<MatchFilters['seniority'], string> = {
  manager: 'Manager and above',
  director: 'Director and above',
  'c-level': 'C-suite',
};

type Props = {
  title: string; // "Who you'll see" / "You're going live for" / "Live for"
  intent: string;
  filters: MatchFilters;
  onChange: () => void;
};

// Boards 05, 06, 08: the filter summary under the Go Live control. A compact
// card: title and Edit, what the member is looking for, then the filters as
// small chips. The whole card opens the filter.
export function FilterSummary({ title, intent, filters, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const wanted = intent.trim();
  const chips: { icon: LucideIcon; label: string }[] = [
    ...(filters.industries.length ? [{ icon: Building2, label: filters.industries.join(', ') }] : []),
    { icon: BriefcaseBusiness, label: SENIORITY_LABELS[filters.seniority] },
    { icon: Gauge, label: `${filters.minMatch}%+ match` },
  ];

  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${wanted || 'nothing added yet'}. Edit`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Target size={15} color={colors.accent} strokeWidth={2.2} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.edit}>Edit</Text>
      </View>

      {wanted ? (
        <Text style={styles.intent}>{wanted}</Text>
      ) : (
        <View style={styles.missing}>
          <Plus size={16} color={colors.accent} strokeWidth={2.4} />
          <Text style={styles.missingText}>Add what you’re looking for</Text>
        </View>
      )}

      <View style={styles.chips}>
        {filters.lookingFor.map((tag) => (
          <View key={tag} style={[styles.chip, styles.chipStrong]}>
            <Text style={[styles.chipText, styles.chipTextStrong]}>{tag}</Text>
          </View>
        ))}
        {chips.map(({ icon: Icon, label }) => (
          <View key={label} style={styles.chip}>
            <Icon size={12} color={colors.muted} strokeWidth={2} />
            <Text style={styles.chipText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    pressed: { opacity: 0.85 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontSize: 13, fontWeight: semibold, color: colors.muted },
    edit: { fontSize: 13, fontWeight: semibold, color: colors.accent },
    intent: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21, fontWeight: semibold, color: colors.text },
    missing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    missingText: { fontSize: 15, fontWeight: semibold, color: colors.accent },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: '100%',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surface2,
    },
    chipStrong: { backgroundColor: colors.accentFill },
    chipText: { fontSize: 12, color: colors.muted, flexShrink: 1 },
    chipTextStrong: { color: colors.accent, fontWeight: semibold },
  });

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MatchFilters } from '../context/PrefsContext';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';
import { Button } from './Button';
import { Card } from './Card';
import { Pill } from './Pill';

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

// Boards 05, 06, 08: the filter summary under the Go Live control, starting
// with the intent sentence.
export function FilterSummary({ title, intent, filters, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const detail = [
    filters.industries.join(', '),
    SENIORITY_LABELS[filters.seniority],
    `${filters.minMatch}%+ match`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.eyebrow}>{title}</Text>
        <Button label="Change" variant="secondary" small onPress={onChange} />
      </View>
      <Text style={[styles.intent, !intent.trim() && styles.missing]}>
        {intent.trim() || 'Add what you’re looking for so we can find your matches.'}
      </Text>
      {filters.lookingFor.length > 0 && (
        <View style={styles.tags}>
          {filters.lookingFor.map((tag) => (
            <Pill key={tag} label={tag} tone="active" />
          ))}
        </View>
      )}
      <Text style={styles.detail}>{detail}</Text>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    eyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
    intent: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.text, marginTop: 10 },
    missing: { fontFamily: fonts.bodyRegular, color: colors.muted, fontWeight: '400' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    detail: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 10 },
  });

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useLive } from '../../context/LiveContext';
import { Seniority } from '../../context/PrefsContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { radius, ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'Filters'>;

const LOOKING_FOR = ['Distribution partners', 'Investors', 'Talent suppliers', 'Customers', 'Co-founders'];
const INDUSTRIES = ['Telecom', 'Government', 'Venture', 'Education'];
const SENIORITIES: { key: Seniority; label: string }[] = [
  { key: 'manager', label: 'Manager' },
  { key: 'director', label: 'Director+' },
  { key: 'c-level', label: 'C-suite' },
];

// Board 07: intent on top, who you'll see below. The same filter governs who
// you see and who can send you a Commit. Saved on the phone (no Core field
// yet). "Add tags for this session" is gone: it competed with the intent.
export function FiltersScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { filters, setFilters, intentText, setIntentText, isLive, canEditIntent, markIntentEdited, runMatching } = useLive();
  const [intent, setIntent] = useState(intentText);
  const [minMatch, setMinMatch] = useState(filters.minMatch);
  const [lookingFor, setLookingFor] = useState<string[]>(filters.lookingFor);
  const [industries, setIndustries] = useState<string[]>(filters.industries);
  const [seniority, setSeniority] = useState<Seniority>(filters.seniority);
  const [allowNearMatches, setAllowNearMatches] = useState(filters.allowNearMatches);
  const [shareIntentChanges, setShareIntentChanges] = useState(filters.shareIntentChanges);

  function toggle(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  function handleDone() {
    setFilters({ minMatch, lookingFor, industries, seniority, allowNearMatches, shareIntentChanges });
    const nextIntent = intent.trim();
    if (nextIntent && nextIntent !== intentText.trim()) {
      setIntentText(nextIntent);
      if (isLive) {
        // "This will find you a new three": once per live session.
        markIntentEdited();
        runMatching().catch(() => {});
      }
    }
    navigation.goBack();
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h2}>Your filter</Text>
        <Button label="Done" variant="secondary" small onPress={handleDone} />
      </View>

      <Text style={styles.sectionTitle}>What you're looking for</Text>
      <TextInput
        value={intent}
        onChangeText={setIntent}
        editable={canEditIntent}
        placeholder="e.g. Find telco or GLC distribution partners for an AI workforce platform."
        placeholderTextColor={colors.muted}
        multiline
        style={[styles.intent, !canEditIntent && styles.intentLocked]}
        accessibilityLabel="What you're looking for"
      />
      <Text style={styles.hint}>
        {canEditIntent
          ? 'You can change this once while live. This will find you a new three.'
          : "You've changed this once in this session. It opens again next time you go live."}
      </Text>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Who you'll see</Text>

      <Text style={styles.label}>Looking for</Text>
      <View style={styles.tagRow}>
        {LOOKING_FOR.map((tag) => (
          <Pill key={tag} label={tag} tone={lookingFor.includes(tag) ? 'active' : 'default'} onPress={() => toggle(lookingFor, setLookingFor, tag)} />
        ))}
      </View>

      <Text style={styles.label}>Industry</Text>
      <View style={styles.tagRow}>
        {INDUSTRIES.map((tag) => (
          <Pill key={tag} label={tag} tone={industries.includes(tag) ? 'active' : 'default'} onPress={() => toggle(industries, setIndustries, tag)} />
        ))}
      </View>

      <Text style={styles.label}>Seniority</Text>
      <View style={styles.tagRow}>
        {SENIORITIES.map((s) => (
          <Pill key={s.key} label={s.label} tone={seniority === s.key ? 'active' : 'default'} onPress={() => setSeniority(s.key)} />
        ))}
      </View>

      <View style={styles.matchRow}>
        <Text style={styles.label}>Minimum match</Text>
        <Text style={styles.matchValue}>{minMatch}%</Text>
      </View>
      <Slider
        minimumValue={30}
        maximumValue={95}
        step={1}
        value={minMatch}
        onValueChange={setMinMatch}
        minimumTrackTintColor={colors.brand}
        maximumTrackTintColor={colors.track}
        thumbTintColor={colors.brand}
        accessibilityLabel="Minimum match"
      />

      <Card style={styles.toggles}>
        <View style={styles.toggleRow}>
          <View style={styles.flex}>
            <Text style={styles.h3}>Allow requests below {minMatch}%</Text>
            <Text style={styles.hint}>Off: only people above your bar can send you a Commit.</Text>
          </View>
          <ToggleSwitch on={allowNearMatches} onToggle={() => setAllowNearMatches((v) => !v)} />
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.toggleRow}>
          <View style={styles.flex}>
            <Text style={styles.h3}>Share intent changes</Text>
            <Text style={styles.hint}>Off: edits stay private to your matching.</Text>
          </View>
          <ToggleSwitch on={shareIntentChanges} onToggle={() => setShareIntentChanges((v) => !v)} />
        </View>
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text },
    h3: { fontFamily: fonts.headingBold, fontSize: 15, fontWeight: '700', color: colors.text },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 6 },
    label: { fontFamily: fonts.bodyBold, fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
    hint: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    intent: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      padding: 14,
      minHeight: 84,
      fontSize: 15,
      lineHeight: 21,
      color: colors.text,
      textAlignVertical: 'top',
    },
    intentLocked: { opacity: 0.6 },
    divider: { height: 1, backgroundColor: colors.line, marginTop: 6 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    matchValue: { fontFamily: fonts.headingExtraBold, fontSize: 16, fontWeight: '800', color: colors.text },
    toggles: { gap: 14, marginTop: 6 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardDivider: { height: 1, backgroundColor: colors.line },
  });

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { BackHeader } from '../../components/BackHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components/Pill';
import { Screen } from '../../components/Screen';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { Seniority, useLive } from '../../context/LiveContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'Filters'>;

const LOOKING_FOR = ['Distribution partners', 'Investors', 'Talent suppliers', 'Clients', 'Co-founders', 'Advisors'];
const INDUSTRIES = ['Telco', 'Government / GLC', 'Education', 'Finance', 'Healthcare'];
const SENIORITIES: { key: Seniority; label: string }[] = [
  { key: 'any', label: 'Any' },
  { key: 'director', label: 'Director+' },
  { key: 'c-level', label: 'C-level only' },
];

export function FiltersScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { filters, setFilters } = useLive();
  const [minMatch, setMinMatch] = useState(filters.minMatch);
  const [lookingFor, setLookingFor] = useState<string[]>(filters.lookingFor);
  const [industries, setIndustries] = useState<string[]>(filters.industries);
  const [seniority, setSeniority] = useState<Seniority>(filters.seniority);
  const [allowNearMatches, setAllowNearMatches] = useState(filters.allowNearMatches);
  const [shareIntentChanges, setShareIntentChanges] = useState(filters.shareIntentChanges);

  function toggle(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  function handleSave() {
    setFilters({ minMatch, lookingFor, industries, seniority, allowNearMatches, shareIntentChanges });
    navigation.goBack();
  }

  return (
    <Screen>
      <BackHeader onBack={() => navigation.goBack()} right={<Button label="Save" small onPress={handleSave} />} />

      <View>
        <Text style={styles.h2}>Who you want to meet</Text>
        <Text style={styles.sub}>Tighten the room around the people most useful to you.</Text>
      </View>

      <Text style={styles.sectionTitle}>What you're looking for</Text>
      <View style={styles.tagRow}>
        {LOOKING_FOR.map((tag) => (
          <Pill
            key={tag}
            label={tag}
            tone={lookingFor.includes(tag) ? 'active' : 'default'}
            onPress={() => toggle(lookingFor, setLookingFor, tag)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Industry</Text>
      <View style={styles.tagRow}>
        {INDUSTRIES.map((tag) => (
          <Pill
            key={tag}
            label={tag}
            tone={industries.includes(tag) ? 'active' : 'default'}
            onPress={() => toggle(industries, setIndustries, tag)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Seniority</Text>
      <View style={styles.tagRow}>
        {SENIORITIES.map((s) => (
          <Pill key={s.key} label={s.label} tone={seniority === s.key ? 'active' : 'default'} onPress={() => setSeniority(s.key)} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Minimum match</Text>
      <Card>
        <View style={styles.matchRow}>
          <Text style={styles.sub}>Fewer, stronger</Text>
          <Text style={styles.matchValue}>{minMatch}%</Text>
        </View>
        <Slider
          minimumValue={30}
          maximumValue={95}
          step={1}
          value={minMatch}
          onValueChange={setMinMatch}
          minimumTrackTintColor={colors.brand}
          style={{ marginTop: 12 }}
        />
        <View style={[styles.matchRow, { marginTop: 16 }]}>
          <Text style={styles.sub}>In this room right now</Text>
          <Text style={styles.matchValue}>11 people</Text>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Privacy</Text>
      <Card style={{ gap: 14 }}>
        <View style={styles.privacyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h3}>Allow near-matches</Text>
            <Text style={styles.sub}>People below {minMatch}% can still request you.</Text>
          </View>
          <ToggleSwitch on={allowNearMatches} onToggle={() => setAllowNearMatches((v) => !v)} />
        </View>
        <View style={styles.divider} />
        <View style={styles.privacyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h3}>Share intent changes</Text>
            <Text style={styles.sub}>Only where relevant to your network.</Text>
          </View>
          <ToggleSwitch on={shareIntentChanges} onToggle={() => setShareIntentChanges((v) => !v)} />
        </View>
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  h2: { fontSize: 22, fontWeight: '800', color: colors.text },
  h3: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: 1, backgroundColor: colors.line },
});

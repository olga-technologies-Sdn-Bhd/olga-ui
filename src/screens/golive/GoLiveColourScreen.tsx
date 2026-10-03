import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Lock } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { GoLiveDisc } from '../../components/GoLiveDisc';
import { Screen } from '../../components/Screen';
import { usePrefs } from '../../context/PrefsContext';
import { GoLiveStackParamList } from '../../navigation/types';
import { ThemeColors } from '../../theme/colors';
import { GO_LIVE_COLORS, goLiveColor } from '../../theme/goLiveColors';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/typography';

type Props = NativeStackScreenProps<GoLiveStackParamList, 'GoLiveColour'>;

// Earned colours are Phase 2; shown locked so members know they exist.
const EARNED = ['Your 1st event', '3 meetings', '5 rooms'];

// Board 15: personal and cosmetic. Only the owner sees it; it never changes
// matching, ranking or what others see.
export function GoLiveColourScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { prefs, setGoLiveColor } = usePrefs();
  const selected = goLiveColor(prefs.goLiveColor);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h2}>Your Go Live colour</Text>
        <Button label="Done" variant="secondary" small onPress={() => navigation.goBack()} />
      </View>
      <Text style={styles.sub}>
        Make the button yours. Only you see this colour; it never changes what others see or how you're matched.
      </Text>

      <GoLiveDisc label="GO LIVE" caption="PRESS & HOLD" fill={selected.fill} textColor={selected.text} />

      <Text style={styles.sectionTitle}>Pick one</Text>
      <View style={styles.row}>
        {GO_LIVE_COLORS.map((c) => {
          const on = c.key === selected.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setGoLiveColor(c.key)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              accessibilityState={{ selected: on }}
              style={[styles.ring, on && styles.ringOn]}
            >
              <View style={[styles.swatch, { backgroundColor: c.fill }, c.key === 'pearl' && styles.pearl]} />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Earn more</Text>
      <View style={styles.row}>
        {EARNED.map((label) => (
          <View key={label} style={styles.earned}>
            <View style={styles.locked}>
              <Lock size={14} color={colors.muted} />
            </View>
            <Text style={styles.earnedLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.sub}>Colours unlock when you attend events and when meetings are confirmed by both of you.</Text>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    h2: { fontFamily: fonts.headingExtraBold, fontSize: 22, fontWeight: '800', color: colors.text, flexShrink: 1 },
    sub: { fontSize: 13, lineHeight: 19, color: colors.muted },
    sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    ring: { padding: 3, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
    ringOn: { borderColor: colors.text },
    swatch: { width: 34, height: 34, borderRadius: 17 },
    pearl: { borderWidth: 1, borderColor: colors.brand2 },
    earned: { alignItems: 'center', gap: 6, width: 84 },
    locked: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    earnedLabel: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  });

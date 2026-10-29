import { Check } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { THEMES, ThemeInfo } from '../theme/themes';
import { fonts, semibold } from '../theme/typography';

// Profile → Appearance: one tile per look, each drawn in its own colours so a
// member sees what they are choosing before they choose it.
export function ThemePicker() {
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {THEMES.map((t) => {
        const selected = t.name === theme;
        return (
          <Pressable
            key={t.name}
            onPress={() => setTheme(t.name)}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={`${t.label}, ${t.blurb}`}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <View style={[styles.frame, selected && styles.frameOn]}>
              <Preview info={t} />
              {selected && (
                <View style={styles.check}>
                  <Check size={11} color={colors.onBrand} strokeWidth={3} />
                </View>
              )}
            </View>
            <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
              {t.label}
            </Text>
            <Text style={styles.blurb} numberOfLines={2}>
              {t.blurb}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A tiny home screen in the look's own colours: a card, a chip and the main button.
function Preview({ info }: { info: ThemeInfo }) {
  const c = info.colors;
  const styles = useMemo(() => makePreviewStyles(c), [c]);
  return (
    <View style={styles.screen} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.greeting} />
      <View style={styles.card}>
        <View style={styles.cardTitle} />
        <View style={styles.cardLine} />
        <View style={styles.chip} />
      </View>
      <View style={styles.button}>
        <View style={styles.buttonLabel} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 10 },
    tile: { flex: 1, gap: 4 },
    pressed: { opacity: 0.8 },
    frame: {
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.line,
      padding: 3,
    },
    frameOn: { borderColor: colors.accent },
    check: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontFamily: fonts.bodyBold, fontSize: 13, fontWeight: semibold, color: colors.text, marginTop: 4 },
    labelOn: { color: colors.accent },
    blurb: { fontSize: 11, lineHeight: 14, color: colors.muted },
  });

const makePreviewStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { height: 96, borderRadius: 12, backgroundColor: c.bg, padding: 8, gap: 6, borderWidth: 1, borderColor: c.line },
    greeting: { width: 30, height: 5, borderRadius: 3, backgroundColor: c.text },
    card: { borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, padding: 6, gap: 4 },
    cardTitle: { width: 38, height: 4, borderRadius: 2, backgroundColor: c.text },
    cardLine: { width: 26, height: 3, borderRadius: 2, backgroundColor: c.muted },
    chip: { width: 20, height: 7, borderRadius: 4, backgroundColor: c.accent },
    button: { height: 16, borderRadius: 8, backgroundColor: c.charcoal, alignItems: 'center', justifyContent: 'center' },
    buttonLabel: { width: 20, height: 3, borderRadius: 2, backgroundColor: c.onCharcoal },
  });

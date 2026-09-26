import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  on: boolean;
  onToggle: () => void;
};

// Matches the prototype's `.switch` / `.switch.on` toggle.
export function ToggleSwitch({ on, onToggle }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={onToggle} style={[styles.track, on && styles.trackOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 99,
    backgroundColor: colors.track,
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.brand },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  knobOn: { transform: [{ translateX: 18 }] },
});

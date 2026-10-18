import { LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';
import { Button } from './Button';

type Props = {
  visible: boolean;
  icon?: LucideIcon;
  // warning: amber icon (e.g. offensive text); info: navy icon (e.g. a permission).
  tone?: 'warning' | 'info';
  title: string;
  message: string;
  // The safe choice: the navy button on top.
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  // Back button or a tap outside: same as the safe choice.
  onDismiss: () => void;
};

// A centred card in the app's own style, instead of the system alert.
export function ConfirmDialog({ visible, icon: Icon, tone = 'warning', title, message, primaryLabel, onPrimary, secondaryLabel, onSecondary, onDismiss }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert">
          {Icon && (
            <View style={[styles.iconWrap, tone === 'info' && styles.iconWrapInfo]}>
              <Icon size={22} color={tone === 'info' ? colors.brand : colors.amberText} strokeWidth={2} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button label={primaryLabel} variant="charcoal" onPress={onPrimary} />
            <Button label={secondaryLabel} variant="ghost" onPress={onSecondary} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(15,12,20,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 16,
      alignItems: 'center',
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.amberSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    iconWrapInfo: { backgroundColor: colors.brandSoft },
    title: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
    message: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 8 },
    actions: { alignSelf: 'stretch', gap: 8, marginTop: 20 },
  });

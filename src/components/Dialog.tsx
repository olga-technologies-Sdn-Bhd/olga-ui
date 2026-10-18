import { LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/typography';
import { Button } from './Button';

// info: blue (a permission, a note); warning: amber (e.g. offensive text);
// danger: red (something that can't be undone).
export type DialogTone = 'info' | 'warning' | 'danger';

// primary: the navy button (listed first); secondary: outlined; destructive:
// outlined with red text (the action that can't be undone).
export type DialogAction = { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'destructive' };

type Props = {
  visible: boolean;
  icon?: LucideIcon;
  tone?: DialogTone;
  title: string;
  message?: string;
  actions: DialogAction[];
  // Back button or a tap outside.
  onDismiss: () => void;
};

// Every popup in the app: a centred card in Ol-ga's style, never the system
// alert. ConfirmDialog, ComingSoonModal and showDialog() all draw this.
//
// Motion (calm, as in iOS alerts): the dim fades in and the card springs up
// from 92%. Choosing an option (or tapping outside) eases the card out to 96%
// as everything fades, and only then runs the action, so the next screen or
// dialog never jumps in underneath it. Native driver throughout.
export function Dialog({ visible, icon: Icon, tone = 'info', title, message, actions, onDismiss }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);

  useEffect(() => {
    if (!visible) return;
    leaving.current = false;
    scale.setValue(0.92);
    opacity.setValue(0);
    dim.setValue(0);
    Animated.parallel([
      Animated.timing(dim, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 17, stiffness: 240, mass: 0.8, useNativeDriver: true }),
    ]).start();
  }, [visible, scale, opacity, dim]);

  // Ease out, then act. A second tap while leaving is ignored.
  const leave = (then: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.parallel([
      Animated.timing(dim, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => then());
  };

  const iconColor = tone === 'warning' ? colors.amberText : tone === 'danger' ? colors.danger : colors.accent;
  const iconFill = tone === 'warning' ? colors.amberSoft : tone === 'danger' ? colors.dangerSoft : colors.accentFill;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => leave(onDismiss)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: dim }]} />
      <Pressable style={styles.backdrop} onPress={() => leave(onDismiss)}>
        <Animated.View style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}>
          <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert">
            {Icon && (
              <View style={[styles.iconWrap, { backgroundColor: iconFill }]}>
                <Icon size={24} color={iconColor} strokeWidth={2} />
              </View>
            )}
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
            <View style={styles.actions}>
              {actions.map((a, i) => {
                const kind = a.kind ?? (i === 0 ? 'primary' : 'secondary');
                return (
                  <Button
                    key={a.label}
                    label={a.label}
                    variant={kind === 'primary' ? 'charcoal' : 'ghost'}
                    labelColor={kind === 'destructive' ? colors.danger : undefined}
                    onPress={() => leave(a.onPress)}
                  />
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dim: { backgroundColor: 'rgba(15,12,20,0.45)' },
    backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    cardWrap: { width: '100%', maxWidth: 360 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 16,
      alignItems: 'center',
    },
    iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    title: { fontFamily: fonts.headingExtraBold, fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
    message: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 8 },
    actions: { alignSelf: 'stretch', gap: 8, marginTop: 20 },
  });

import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/colors';
import { Button } from './Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  icon?: string;
};

export function ComingSoonModal({
  visible,
  onClose,
  title = 'Coming soon!',
  message = "We're building this next — check back shortly.",
  icon = '💬',
}: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.85);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [visible, scale, opacity]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Pressable onPress={() => {}}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{icon}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <Button label="Got it" onPress={onClose} style={styles.button} />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,12,20,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 26,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: { fontSize: 28 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 8 },
  button: { alignSelf: 'stretch', marginTop: 20 },
});

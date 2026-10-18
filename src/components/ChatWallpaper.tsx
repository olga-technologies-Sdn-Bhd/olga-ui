import {
  Award,
  Briefcase,
  CalendarDays,
  Coffee,
  Globe,
  Handshake,
  Lightbulb,
  LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Presentation,
  Rocket,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// WhatsApp-style doodles behind a conversation, from the world of meeting
// people at events: coffee, handshakes, a calendar, a mic. Faint line icons
// in the app's own icon set, scattered the same way every time (seeded), and
// never in the way of a touch.

const DOODLES: LucideIcon[] = [
  Coffee,
  Handshake,
  Briefcase,
  CalendarDays,
  Lightbulb,
  MapPin,
  Target,
  TrendingUp,
  Mail,
  Users,
  Rocket,
  Presentation,
  Mic,
  Globe,
  Award,
  MessageCircle,
];

// One doodle per cell, nudged around inside it. Sized and spaced like the
// WhatsApp default wallpaper: about 20px line icons, clearly visible but soft.
const CELL = 46;
// Room left clear in the middle for the Ol-ga mark.
const CLEAR_W = 230;
const CLEAR_H = 110;

// Small seeded generator, so the pattern doesn't jump between renders.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function ChatWallpaper() {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const doodles = useMemo(() => {
    const random = seeded(7);
    const cols = Math.ceil(size.width / CELL);
    const rows = Math.ceil(size.height / CELL);
    const out: { Icon: LucideIcon; left: number; top: number; size: number; rotate: string; key: string }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const iconSize = 18 + Math.round(random() * 6);
        const Icon = DOODLES[Math.floor(random() * DOODLES.length)];
        const left = c * CELL + random() * (CELL - iconSize);
        const top = r * CELL + random() * (CELL - iconSize);
        const rotate = `${Math.round(random() * 50 - 25)}deg`;
        const clear =
          Math.abs(left + iconSize / 2 - size.width / 2) < CLEAR_W / 2 + iconSize / 2 &&
          Math.abs(top + iconSize / 2 - size.height / 2) < CLEAR_H / 2 + iconSize / 2;
        if (!clear) out.push({ Icon, left, top, size: iconSize, rotate, key: `${r}-${c}` });
      }
    }
    return out;
  }, [size]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
      {doodles.map(({ Icon, left, top, size: iconSize, rotate, key }) => (
        <View key={key} style={[styles.doodle, { left, top, transform: [{ rotate }] }]}>
          <Icon size={iconSize} color={colors.text} strokeWidth={1.3} opacity={0.3} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  doodle: { position: 'absolute' },
});

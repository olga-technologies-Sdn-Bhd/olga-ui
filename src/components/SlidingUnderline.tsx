import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';

type Props = {
  count: number;
  index: number;
  lineWidth: number;
  color: string;
  // Horizontal padding of the tab row, so the line centres under each tab.
  inset?: number;
};

// The active-tab underline for a text tab row. Like the floating tab bar's
// pill, it glides to the chosen tab and stretches in flight, then settles.
// Native driver only (translate + scale), so it stays smooth. Place it as the
// last child of the row (the row needs no extra style).
export function SlidingUnderline({ count, index, lineWidth, color, inset = 0 }: Props) {
  const [width, setWidth] = useState(0);
  const slot = width > 0 ? (width - inset * 2) / count : 0;
  const x = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);
  const last = useRef(index);

  useEffect(() => {
    if (!slot) return;
    const to = inset + index * slot + (slot - lineWidth) / 2;
    if (!placed.current) {
      x.setValue(to);
      placed.current = true;
      last.current = index;
      return;
    }
    const distance = Math.abs(index - last.current);
    last.current = index;
    Animated.parallel([
      Animated.spring(x, { toValue: to, damping: 18, stiffness: 190, mass: 0.9, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1 + Math.min(1.2, 0.55 * distance), duration: 120, useNativeDriver: true }),
        Animated.spring(stretch, { toValue: 1, damping: 11, stiffness: 170, useNativeDriver: true }),
      ]),
    ]).start();
  }, [index, slot, inset, lineWidth, x, stretch]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {slot > 0 && (
        <Animated.View
          style={[styles.line, { width: lineWidth, backgroundColor: color, transform: [{ translateX: x }, { scaleX: stretch }] }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits on the row's bottom divider.
  line: { position: 'absolute', left: 0, bottom: -1, height: 3, borderRadius: 2 },
});

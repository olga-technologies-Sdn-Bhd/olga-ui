import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
};

const GAP = 48; // space between the end of the text and its repeat
const SPEED = 28; // dp per second
const REST_MS = 1400; // pause at the start of each pass

// One line of text. When it fits it is simply centred; when it is too long it
// glides sideways in a loop, with a pause at the start of each pass, so the
// whole of it can be read.
export function Marquee({ text, style }: Props) {
  const [box, setBox] = useState(0);
  const [line, setLine] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const shift = useRef(new Animated.Value(0)).current;
  const overflowing = box > 0 && line > box + 1;
  const sliding = overflowing && !reduceMotion;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    shift.setValue(0);
    if (!sliding) return;
    const distance = line + GAP;
    const pass = Animated.loop(
      Animated.sequence([
        Animated.delay(REST_MS),
        Animated.timing(shift, { toValue: -distance, duration: (distance / SPEED) * 1000, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    pass.start();
    return () => pass.stop();
  }, [sliding, line, shift, text]);

  return (
    <View style={styles.box} onLayout={(e) => setBox(e.nativeEvent.layout.width)} accessible accessibilityLabel={text}>
      {/* A horizontal scroller is only here so the text is laid out at its full width. */}
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        contentContainerStyle={[styles.content, !overflowing && { minWidth: box }]}
      >
        <Animated.View style={[styles.row, { transform: [{ translateX: shift }] }]}>
          <Text style={style} numberOfLines={1} onLayout={(e) => setLine(e.nativeEvent.layout.width)}>
            {text}
          </Text>
          {sliding && (
            <Text style={[style, styles.repeat]} numberOfLines={1}>
              {text}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  content: { justifyContent: 'center' },
  row: { flexDirection: 'row' },
  repeat: { marginLeft: GAP },
});

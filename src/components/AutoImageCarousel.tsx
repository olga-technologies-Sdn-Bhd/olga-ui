import { useEffect, useRef } from 'react';
import { Animated, Easing, ImageSourcePropType, StyleSheet } from 'react-native';

type Props = {
  images: ImageSourcePropType[];
  intervalMs?: number;
  fadeMs?: number;
};

// Full-bleed background carousel. Every image is mounted once, for the
// component's whole lifetime, as its own <Animated.Image> layer with a fixed
// `source` — only opacity is animated. Swapping an Image's `source` prop
// forces Android to redecode it, which shows up as a visible flicker; keeping
// sources constant and crossfading opacity avoids that entirely.
export function AutoImageCarousel({ images, intervalMs = 5000, fadeMs = 900 }: Props) {
  const opacities = useRef(images.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const active = useRef(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      const from = active.current;
      const to = (from + 1) % images.length;
      active.current = to;
      Animated.parallel([
        Animated.timing(opacities[from], {
          toValue: 0,
          duration: fadeMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacities[to], {
          toValue: 1,
          duration: fadeMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [images.length, intervalMs, fadeMs, opacities]);

  return (
    <>
      {images.map((source, i) => (
        <Animated.Image
          key={i}
          source={source}
          style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}
          resizeMode="cover"
        />
      ))}
    </>
  );
}

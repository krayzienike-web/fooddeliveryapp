import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

/** Soft rising steam wisps over hot dishes (B3). Pure transforms, cheap enough for low-end Android. */
function Wisp({ x, delay, size }: { x: number; delay: number; size: number }) {
  const { c } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [delay, t]);
  const a = useAnimatedStyle(() => ({
    opacity: t.value < 0.2 ? t.value * 2 : (1 - t.value) * 0.5,
    transform: [{ translateY: -t.value * 160 }, { translateX: Math.sin(t.value * 6) * 14 }, { scale: 0.6 + t.value * 1.4 }],
  }));
  return <Animated.View style={[{ position: 'absolute', bottom: 40, left: `${x}%`, width: size, height: size * 1.6, borderRadius: size, backgroundColor: c.steam, filter: [{ blur: 14 }] }, a]} />;
}

export function Steam({ intensity = 1 }: { intensity?: number }) {
  if (intensity <= 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[30, 44, 56, 68].map((x, i) => (
        <Wisp key={x} x={x} delay={i * 640} size={36 + (i % 3) * 14} />
      ))}
    </View>
  );
}

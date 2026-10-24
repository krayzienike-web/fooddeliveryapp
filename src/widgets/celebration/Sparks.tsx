import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';

/** Celebration sparks (≤1.2 s, guidebook «праздник» zone only). */
function Spark({ angle, dist, delay, color, size }: { angle: number; dist: number; delay: number; color: string; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [delay, t]);
  const a = useAnimatedStyle(() => ({
    opacity: t.value < 0.1 ? t.value * 10 : 1 - t.value,
    transform: [{ translateX: Math.cos(angle) * dist * t.value }, { translateY: Math.sin(angle) * dist * t.value + 120 * t.value * t.value }, { rotate: `${t.value * 360}deg` }, { scale: 1 - t.value * 0.5 }],
  }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size * 2.4, borderRadius: size / 2, backgroundColor: color }, a]} />;
}

export function Sparks({ count = 36 }: { count?: number }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const colors = [c.accent, c.gold, c.textPrimary, c.accentBright];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {Array.from({ length: count }, (_, i) => (
        <Spark key={i} angle={(i / count) * Math.PI * 2 + (i % 3) * 0.2} dist={width * (0.25 + ((i * 37) % 10) / 22)} delay={(i % 6) * 25} color={colors[i % colors.length]} size={4 + (i % 3) * 2} />
      ))}
    </View>
  );
}

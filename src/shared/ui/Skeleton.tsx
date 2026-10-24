import { useEffect } from 'react';
import { type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { radius as R, useTheme } from '@/shared/theme';

export function Skeleton({ w = '100%', h = 16, r = R.s }: { w?: DimensionValue; h?: DimensionValue; r?: number }) {
  const { c } = useTheme();
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: c.surfaceHigh }, a]} />;
}

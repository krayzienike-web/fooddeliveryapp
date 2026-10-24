import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FoodImage } from '@/shared/ui';
import { useFly } from '../model/fly';

function Flyer({ id, image, x, y, size }: { id: number; image: string; x: number; y: number; size: number }) {
  const { width, height } = useWindowDimensions();
  const land = useFly((s) => s.land);
  const t = useSharedValue(0);
  const tx = width / 2 - size / 2;
  const ty = height - 150;
  useEffect(() => {
    t.value = withTiming(1, { duration: 520, easing: Easing.bezier(0.3, 0, 0.2, 1) }, (done) => {
      if (done) runOnJS(land)(id);
    });
  }, [id, land, t]);
  const a = useAnimatedStyle(() => {
    const p = t.value;
    // quadratic bezier arc: start → control above → cart bar
    const cx = (x + tx) / 2;
    const cy = Math.min(y, ty) - 140;
    const px = (1 - p) * (1 - p) * x + 2 * (1 - p) * p * cx + p * p * tx;
    const py = (1 - p) * (1 - p) * y + 2 * (1 - p) * p * cy + p * p * ty;
    const s = 1 - p * 0.75;
    return { transform: [{ translateX: px }, { translateY: py }, { scale: s }, { rotate: `${p * 25}deg` }], opacity: p > 0.92 ? (1 - p) * 12 : 1 };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }, a]}>
      <FoodImage id={image} small style={{ width: size, height: size }} />
    </Animated.View>
  );
}

export function FlyLayer() {
  const flights = useFly((s) => s.flights);
  if (!flights.length) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flights.map((f) => (
        <Flyer key={f.id} {...f} />
      ))}
    </View>
  );
}

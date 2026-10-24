import { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import type { Dish } from '@/entities/dish/model/types';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { FoodImage, Txt } from '@/shared/ui';

/**
 * «Взрыв ингредиентов» (C2): the dish shrinks into the centre and its ingredients fly out
 * on springs around it, each with its grams. Tap anywhere to collapse.
 */
function Bit({ label, grams, angle, dist, index }: { label: string; grams?: number; angle: number; dist: number; index: number }) {
  const { c } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(80 + index * 45, withSpring(1, { stiffness: 260, damping: 16, mass: 0.8 }));
    const t = setTimeout(() => haptic.tick(), 80 + index * 45);
    return () => clearTimeout(t);
  }, [index, p]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.5),
    transform: [{ translateX: Math.cos(angle) * dist * p.value }, { translateY: Math.sin(angle) * dist * p.value }, { scale: 0.4 + 0.6 * p.value }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', alignItems: 'center' }, a]}>
      <View style={{ paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.full, backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.outline, alignItems: 'center', maxWidth: 150 }}>
        <Txt v="label" numberOfLines={1}>
          {label}
        </Txt>
        {grams ? (
          <Txt v="caption" color="accent" tabular>
            {grams} г
          </Txt>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function IngredientBurst({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const core = useSharedValue(0);
  useEffect(() => {
    haptic.longPress();
    core.value = withTiming(1, { duration: 300 });
  }, [core]);
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1.6 - core.value * 0.6 }, { rotate: `${(1 - core.value) * -20}deg` }] }));
  const items = dish.ingredients.slice(0, 10);
  const r = Math.min(width, height * 0.6) * 0.38;
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, zIndex: 50 }]}>
      <Pressable testID="dish-burst-close" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={onClose} accessibilityLabel="Свернуть состав">
        <Animated.View style={coreStyle}>
          <FoodImage id={dish.image} style={{ width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: c.accent }} />
        </Animated.View>
        {items.map((it, i) => (
          <Bit key={it.id} label={it.title} grams={it.grams} index={i} angle={(i / items.length) * Math.PI * 2 - Math.PI / 2} dist={r + (i % 2) * 26} />
        ))}
        <View style={{ position: 'absolute', bottom: 80, alignItems: 'center', gap: 4 }}>
          <Txt v="headline" style={{ color: c.onPhoto }}>
            Что внутри
          </Txt>
          <Txt v="caption" style={{ color: c.onPhoto, opacity: 0.7 }}>
            {dish.weight} {dish.unit} · {dish.nutrition.kcal} ккал · нажмите, чтобы свернуть
          </Txt>
        </View>
      </Pressable>
    </Animated.View>
  );
}

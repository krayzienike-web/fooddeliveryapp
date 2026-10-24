import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import type { HostInstance } from 'react-native';
import { defaultOptions, useMenu } from '@/entities/dish/model/store';
import type { Dish } from '@/entities/dish/model/types';
import { useCart } from '@/features/cart/model/store';
import { useTaste } from '@/features/recommendations/model/store';
import { haptic } from '@/shared/lib/haptics';
import { toast } from '@/shared/ui';
import { useFly } from './fly';

/** Dishes with required choices that have no sensible default must open the dish screen first. */
export function needsConfiguration(dish: Dish, modifiers: Record<string, { required: boolean; defaultOptionId?: string; kind: string }>): boolean {
  return dish.modifierGroupIds.some((g) => modifiers[g]?.required && !modifiers[g]?.defaultOptionId);
}

export function useAddToCart() {
  const nav = useNavigation();
  const add = useCart((s) => s.add);
  const modifiers = useMenu((s) => s.modifiers);
  const stopList = useMenu((s) => s.stopList);
  const signal = useTaste((s) => s.signal);
  const launch = useFly((s) => s.launch);

  return useCallback(
    (dish: Dish, origin?: HostInstance | null, opts?: { optionIds?: string[]; removed?: string[]; qty?: number; silent?: boolean }) => {
      if (stopList.includes(dish.id)) {
        haptic.reject();
        toast('Это блюдо закончилось до вечера', { icon: 'clock-alert-outline' });
        return;
      }
      if (!opts?.optionIds && needsConfiguration(dish, modifiers)) {
        nav.navigate('Dish', { id: dish.id });
        return;
      }
      add(dish.id, opts?.optionIds ?? defaultOptions(dish, modifiers), opts?.removed ?? [], opts?.qty ?? 1);
      signal(dish, 'addToCart');
      haptic.confirm();
      if (origin && !opts?.silent) {
        origin.measureInWindow((x, y, w, h) => {
          if (Number.isFinite(x)) launch({ image: dish.image, x: x + w / 2 - 28, y: y + h / 2 - 28, size: 56 });
        });
      }
    },
    [add, modifiers, stopList, signal, launch, nav],
  );
}

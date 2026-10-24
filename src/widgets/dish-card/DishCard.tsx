import { useNavigation } from '@react-navigation/native';
import { memo, useRef } from 'react';
import { View, type HostInstance } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useMenu } from '@/entities/dish/model/store';
import type { Dish, DishTag } from '@/entities/dish/model/types';
import { useAddToCart } from '@/features/add-to-cart/model/useAddToCart';
import { useCart, useDishQty } from '@/features/cart/model/store';
import { useTaste } from '@/features/recommendations/model/store';
import { radius, space, useTheme } from '@/shared/theme';
import { FoodImage, Icon, PressableScale, Price, Stepper, Txt } from '@/shared/ui';

const BADGE: Partial<Record<DishTag, { label: string; tone: 'accent' | 'gold' | 'neutral' }>> = {
  new: { label: 'Новинка', tone: 'gold' },
  hit: { label: 'Хит', tone: 'accent' },
  chef: { label: 'От шефа', tone: 'neutral' },
  spicy: { label: 'Острое', tone: 'neutral' },
};

/** Exactly one badge per card (guidebook §1.2): new > hit > chef > spicy. */
export function primaryBadge(d: Dish) {
  for (const t of ['new', 'hit', 'chef', 'spicy'] as DishTag[]) if (d.tags.includes(t)) return BADGE[t];
  return undefined;
}

export function metaLine(d: Dish): string {
  const parts: string[] = [];
  const pcs = d.ingredients.find((i) => /шт/.test(i.title) || i.grams === undefined)?.title.match(/(\d+) шт/)?.[1];
  if (d.categoryId === 'pizza') parts.push('30 см');
  if (pcs && (d.categoryId === 'rolls' || d.categoryId === 'snacks')) parts.push(`${pcs} шт`);
  parts.push(`${d.weight} ${d.unit}`);
  parts.push(`${d.nutrition.kcal} ккал`);
  return parts.join(' · ');
}

function AddControl({ dish, originRef }: { dish: Dish; originRef: React.RefObject<HostInstance | null> }) {
  const { c } = useTheme();
  const qty = useDishQty(dish.id);
  const addToCart = useAddToCart();
  const lines = useCart((s) => s.lines);
  const dec = useCart((s) => s.dec);
  if (qty > 0) {
    const last = [...lines].reverse().find((l) => l.dishId === dish.id);
    return (
      <Animated.View entering={ZoomIn.springify().stiffness(500).damping(27)}>
        <Stepper testID={`dish-qty-${dish.id}`} deleteAtOne size="s" value={qty} onInc={() => addToCart(dish, null)} onDec={() => last && dec(last.key)} />
      </Animated.View>
    );
  }
  return (
    <PressableScale
      testID={`dish-add-${dish.id}`}
      accessibilityLabel={`Добавить ${dish.name}`}
      onPress={() => addToCart(dish, originRef.current)}
      pressedScale={0.88}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentTonal, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={22} color="textPrimary" />
      </View>
    </PressableScale>
  );
}

export interface DishCardProps {
  dish: Dish;
  variant?: 'grid' | 'row' | 'wide';
  why?: string | null;
  width?: number;
}

export const DishCard = memo(function DishCard({ dish, variant = 'grid', why, width }: DishCardProps) {
  const { c } = useTheme();
  const nav = useNavigation();
  const imgRef = useRef<HostInstance>(null);
  const view = useTaste((s) => s.view);
  const stop = useMenu((s) => s.stopList.includes(dish.id));
  const badge = primaryBadge(dish);
  const open = () => {
    view(dish.id);
    nav.navigate('Dish', { id: dish.id });
  };

  if (variant === 'row') {
    return (
      <View style={{ opacity: stop ? 0.45 : 1 }}>
        <PressableScale testID={`dish-card-${dish.id}`} onPress={open} pressedScale={0.98} accessibilityLabel={dish.name}>
          <View style={{ flexDirection: 'row', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.s, alignItems: 'center' }}>
            <View ref={imgRef} collapsable={false}>
              <FoodImage id={dish.image} small style={{ width: 104, height: 104, borderRadius: radius.m }} />
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: 48 }}>
              <Txt v="titleM" numberOfLines={2}>
                {dish.name}
              </Txt>
              <Txt v="caption" color="textSecondary" numberOfLines={2}>
                {stop ? 'Закончилось до вечера' : dish.tagline}
              </Txt>
              <Txt v="caption" color="textTertiary">
                {metaLine(dish)}
              </Txt>
            </View>
          </View>
        </PressableScale>
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 104 + space.l + space.m, right: space.l, bottom: space.s, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Price value={dish.price} old={dish.oldPrice} />
          {!stop ? <AddControl dish={dish} originRef={imgRef} /> : null}
        </View>
      </View>
    );
  }

  const w = width;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ width: w, opacity: stop ? 0.45 : 1 }}>
      <PressableScale testID={`dish-card-${dish.id}`} onPress={open} pressedScale={0.97} accessibilityLabel={dish.name}>
        <View ref={imgRef} collapsable={false}>
          <FoodImage id={dish.image} small={variant === 'grid'} style={{ width: '100%', aspectRatio: variant === 'wide' ? 4 / 3 : 1, borderRadius: radius.m }} />
          {badge ? (
            <View style={{ position: 'absolute', top: space.s, left: space.s, paddingHorizontal: space.s, height: 24, borderRadius: radius.xs, justifyContent: 'center', backgroundColor: badge.tone === 'gold' ? c.gold : badge.tone === 'accent' ? c.accent : c.scrim }}>
              <Txt v="caption" style={{ color: badge.tone === 'neutral' ? c.onPhoto : c.onAccent, fontSize: 11, lineHeight: 14 }}>
                {badge.label}
              </Txt>
            </View>
          ) : null}
        </View>
      </PressableScale>
      <View style={{ paddingTop: space.s, gap: 2 }}>
        <Txt v="titleM" numberOfLines={2} style={{ minHeight: 44 }}>
          {dish.name}
        </Txt>
        {why ? (
          <View testID={`dish-why-${dish.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="creation" size={12} color="accent" />
            <Txt v="caption" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
              {why}
            </Txt>
          </View>
        ) : (
          <Txt v="caption" color="textTertiary" numberOfLines={1}>
            {metaLine(dish)}
          </Txt>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, minHeight: 48 }}>
          <Price value={dish.price} old={dish.oldPrice} />
          {!stop ? <AddControl dish={dish} originRef={imgRef} /> : null}
        </View>
      </View>
    </Animated.View>
  );
});

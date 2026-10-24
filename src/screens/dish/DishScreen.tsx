import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/app/navigation/types';
import { unitPrice } from '@/entities/cart/model/pricing';
import { defaultOptions, useMenu } from '@/entities/dish/model/store';
import type { ModifierGroup } from '@/entities/dish/model/types';
import type { Review } from '@/entities/promo/model/types';
import { useAddToCart } from '@/features/add-to-cart/model/useAddToCart';
import { useTaste } from '@/features/recommendations/model/store';
import { useApi } from '@/services';
import { rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { motion, radius, space, useTheme } from '@/shared/theme';
import { Button, Chip, FoodImage, Icon, IconButton, PressableScale, Segmented, Stepper, Txt } from '@/shared/ui';
import { metaLine } from '@/widgets/dish-card/DishCard';
import { IngredientBurst } from './IngredientBurst';
import { Steam } from './Steam';

const ALLERGEN: Record<string, string> = { gluten: 'глютен', lactose: 'лактоза', nuts: 'орехи', fish: 'рыба', shellfish: 'моллюски', egg: 'яйцо', soy: 'соя', sesame: 'кунжут', celery: 'сельдерей', mustard: 'горчица' };
const HOT = new Set(['pizza', 'soups', 'wok', 'hot', 'pasta', 'burgers', 'breakfast']);

export function DishScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Dish'>>();
  const api = useApi();
  const dish = useMenu((s) => s.byId[params.id]);
  const modifiers = useMenu((s) => s.modifiers);
  const byId = useMenu((s) => s.byId);
  const addToCart = useAddToCart();
  const likes = useTaste((s) => s.likes);
  const toggleLike = useTaste((s) => s.toggleLike);
  const signal = useTaste((s) => s.signal);

  const [options, setOptions] = useState<string[]>(() => (dish ? defaultOptions(dish, modifiers) : []));
  const [removed, setRemoved] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [more, setMore] = useState(false);
  const [kbju, setKbju] = useState(false);
  const [burst, setBurst] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  const appear = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);

  useEffect(() => {
    appear.value = withSpring(1, motion.springStandard);
    if (dish) {
      signal(dish, 'longView');
      api.catalog.getReviews(dish.id).then(setReviews).catch(() => undefined);
    }
  }, [dish?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gyroscope parallax on the hero photo (native only).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    DeviceMotion.setUpdateInterval(50);
    const sub = DeviceMotion.addListener((m) => {
      const r = m.rotation;
      if (!r) return;
      tiltX.value = withTiming(Math.max(-1, Math.min(1, r.gamma)) * 12, { duration: 80 });
      tiltY.value = withTiming(Math.max(-1, Math.min(1, r.beta - 0.8)) * 10, { duration: 80 });
    });
    return () => sub.remove();
  }, [tiltX, tiltY]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const photoH = width * 0.82;
  const sheetStyle = useAnimatedStyle(() => ({ opacity: appear.value, transform: [{ translateY: (1 - appear.value) * 60 }] }));
  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-200, 0, photoH], [-100, 0, photoH * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-200, 0], [1.35, 1.08], Extrapolation.CLAMP) * (0.92 + appear.value * 0.08) },
      { translateX: tiltX.value },
      { translateY: tiltY.value },
    ],
  }));
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [photoH - 140, photoH - 60], [0, 1], Extrapolation.CLAMP) }));

  const groups = useMemo(() => (dish ? dish.modifierGroupIds.map((g) => modifiers[g]).filter(Boolean) : []) as ModifierGroup[], [dish, modifiers]);
  if (!dish) return null;
  const price = unitPrice({ dishId: dish.id, optionIds: options }, byId, modifiers);
  const liked = likes.includes(dish.id);
  const pairs = (dish.pairsWith.length ? dish.pairsWith : []).map((id) => byId[id]).filter(Boolean).slice(0, 4);
  const size = groups.find((g) => g.id === 'pizza-size');
  const sizeOpt = size?.options.find((o) => options.includes(o.id));
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : dish.rating;

  const pick = (g: ModifierGroup, id: string) => {
    haptic.tick();
    if (g.kind === 'single') setOptions([...options.filter((o) => !g.options.some((x) => x.id === o)), id]);
    else setOptions(options.includes(id) ? options.filter((o) => o !== id) : [...options, id]);
  };

  return (
    <View testID="dish-screen" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: photoH, overflow: 'hidden', backgroundColor: c.surface }}>
          <Animated.View style={[{ width, height: photoH }, photoStyle]}>
            <FoodImage id={dish.image} style={{ width, height: photoH }} transition={0} />
            {HOT.has(dish.categoryId) ? <Steam /> : null}
          </Animated.View>
        </View>

        <Animated.View style={[{ marginTop: -radius.l, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, backgroundColor: c.bg, paddingHorizontal: space.l, paddingTop: space.xl, gap: space.m }, sheetStyle]}>
          <Txt testID="dish-title" v="displayM">
            {dish.name}
          </Txt>
          <PressableScale testID="dish-kbju" onPress={() => setKbju((v) => !v)} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 32 }}>
            <Txt v="bodyM" color="textSecondary">
              {sizeOpt?.sizeCm ? `${sizeOpt.sizeCm} см · ` : ''}
              {metaLine(dish).replace('30 см · ', '')}
            </Txt>
            <Icon name={kbju ? 'chevron-up' : 'chevron-down'} size={18} color="textTertiary" />
          </PressableScale>
          {kbju ? (
            <Animated.View entering={FadeIn} style={{ flexDirection: 'row', gap: space.s }}>
              {[
                ['Ккал', dish.nutrition.kcal],
                ['Белки', dish.nutrition.protein],
                ['Жиры', dish.nutrition.fat],
                ['Углеводы', dish.nutrition.carbs],
              ].map(([k, v]) => (
                <View key={k} style={{ flex: 1, padding: space.m, borderRadius: radius.s, backgroundColor: c.surface, alignItems: 'center' }}>
                  <Txt v="titleM" tabular>
                    {v}
                  </Txt>
                  <Txt v="caption" color="textTertiary">
                    {k}
                  </Txt>
                </View>
              ))}
            </Animated.View>
          ) : null}

          <Txt v="bodyL" color="textSecondary" numberOfLines={more ? undefined : 3}>
            {dish.description}
          </Txt>
          {more ? (
            <Animated.View entering={FadeIn} style={{ gap: space.s }}>
              <Txt v="label" color="textTertiary" upper>
                Состав
              </Txt>
              <Txt v="bodyM" color="textSecondary">
                {dish.ingredients.map((i) => (i.grams ? `${i.title} ${i.grams} г` : i.title)).join(', ')}
              </Txt>
              {dish.allergens.length ? (
                <Txt v="bodyM" color="warning">
                  Аллергены: {dish.allergens.map((a) => ALLERGEN[a]).join(', ')}
                </Txt>
              ) : null}
            </Animated.View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
            <Chip testID="dish-more" small icon={more ? 'chevron-up' : 'information-outline'} label={more ? 'Свернуть' : 'Состав и аллергены'} onPress={() => setMore((v) => !v)} />
            <Chip testID="dish-burst" small icon="creation" label="Что внутри" onPress={() => setBurst(true)} />
            {dish.arModel ? <Chip testID="dish-ar" small icon="cube-scan" label="На вашем столе" selected onPress={() => nav.navigate('AR', { dishId: dish.id })} /> : null}
          </View>

          {/* Modifiers */}
          {groups.map((g) => (
            <View key={g.id} style={{ gap: space.s, marginTop: space.s }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s }}>
                <Txt v="titleL">{g.title}</Txt>
                {g.required ? (
                  <Txt v="caption" color="textTertiary">
                    Обязательно
                  </Txt>
                ) : null}
              </View>
              {g.kind === 'single' && g.options.length <= 4 && g.options.every((o) => o.priceDelta === 0 || g.id === 'pizza-size') ? (
                <Segmented testID={`dish-group-${g.id}`} value={options.find((o) => g.options.some((x) => x.id === o)) ?? ''} onChange={(id) => pick(g, id)} items={g.options.map((o) => ({ id: o.id, label: o.title }))} />
              ) : (
                g.options.map((o) => {
                  const on = options.includes(o.id);
                  return (
                    <PressableScale key={o.id} testID={`dish-option-${o.id}`} onPress={() => pick(g, o.id)} accessibilityState={{ selected: on }} pressedScale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 48 }}>
                      <Icon name={g.kind === 'single' ? (on ? 'radiobox-marked' : 'radiobox-blank') : on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} color={on ? 'accent' : 'textTertiary'} />
                      <Txt v="bodyL" style={{ flex: 1 }}>
                        {o.title}
                      </Txt>
                      {o.priceDelta ? (
                        <Txt v="bodyM" color="textSecondary" tabular>
                          {o.priceDelta > 0 ? '+ ' : '− '}
                          {rub(Math.abs(o.priceDelta))}
                        </Txt>
                      ) : null}
                    </PressableScale>
                  );
                })
              )}
            </View>
          ))}

          {dish.ingredients.some((i) => i.removable) ? (
            <View style={{ gap: space.s, marginTop: space.s }}>
              <Txt v="titleL">Убрать</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                {dish.ingredients
                  .filter((i) => i.removable)
                  .map((i) => (
                    <Chip key={i.id} testID={`dish-remove-${i.id}`} small icon={removed.includes(i.id) ? 'close' : undefined} label={`Без: ${i.title.toLowerCase()}`} selected={removed.includes(i.id)} onPress={() => setRemoved(removed.includes(i.id) ? removed.filter((x) => x !== i.id) : [...removed, i.id])} />
                  ))}
              </View>
            </View>
          ) : null}

          {/* One upsell module only */}
          {pairs.length ? (
            <View style={{ gap: space.m, marginTop: space.l }}>
              <Txt v="titleL">С этим берут</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.m }}>
                {pairs.map((p) => (
                  <PressableScale key={p.id} testID={`dish-pair-${p.id}`} onPress={() => addToCart(p, null)} style={{ width: 120, gap: space.xs }}>
                    <FoodImage id={p.image} small style={{ width: 120, height: 120, borderRadius: radius.m }} />
                    <Txt v="label" numberOfLines={2}>
                      {p.name}
                    </Txt>
                    <Txt v="label" color="accent">
                      + {rub(p.price)}
                    </Txt>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Reviews */}
          <View style={{ gap: space.m, marginTop: space.l }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Txt v="titleL" style={{ flex: 1 }}>
                Отзывы
              </Txt>
              <Icon name="star" size={18} color="gold" />
              <Txt v="titleM" tabular>
                {avg.toFixed(1)}
              </Txt>
              <Txt v="caption" color="textTertiary">
                · {dish.reviewsCount}
              </Txt>
            </View>
            {reviews.slice(0, 2).map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surface }}>
                {r.photo ? <FoodImage id={r.photo} small style={{ width: 56, height: 56, borderRadius: radius.s }} /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
                    <Txt v="label">{r.author}</Txt>
                    <Txt v="caption" color="gold">
                      {'★'.repeat(r.stars)}
                    </Txt>
                  </View>
                  <Txt v="bodyM" color="textSecondary">
                    {r.text}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Top bar: solid with title on scroll */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 64, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.outline }, barStyle]}>
        <Txt v="titleM" numberOfLines={1} style={{ position: 'absolute', bottom: 20, left: 72, right: 120 }}>
          {dish.name}
        </Txt>
      </Animated.View>
      <View style={{ position: 'absolute', top: insets.top + space.s, left: space.s, right: space.s, flexDirection: 'row' }}>
        <IconButton testID="dish-close" icon="close" label="Закрыть" tone="glass" size={40} onPress={() => nav.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton
          testID="dish-like"
          icon={liked ? 'heart' : 'heart-outline'}
          label={liked ? 'Убрать из избранного' : 'В избранное'}
          tone="glass"
          size={40}
          onPress={() => {
            haptic.tick();
            toggleLike(dish);
          }}
        />
      </View>

      {/* Sticky bottom bar: stepper + one primary CTA with live price */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline, flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
        <Stepper testID="dish-qty" value={qty} min={1} onInc={() => setQty(qty + 1)} onDec={() => setQty(Math.max(1, qty - 1))} />
        <Button
          testID="dish-primary-cta"
          style={{ flex: 1 }}
          title="В корзину"
          trailing={rub(price * qty)}
          onPress={() => {
            addToCart(dish, null, { optionIds: options, removed, qty, silent: true });
            nav.goBack();
          }}
        />
      </View>

      {burst ? <IngredientBurst dish={dish} onClose={() => setBurst(false)} /> : null}
    </View>
  );
}

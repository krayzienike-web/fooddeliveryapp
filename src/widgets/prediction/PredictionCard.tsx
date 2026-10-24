import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useMenu } from '@/entities/dish/model/store';
import { useOrders } from '@/entities/order/model/store';
import { useCart } from '@/features/cart/model/store';
import { useAppContext, useDirector } from '@/features/director/model/store';
import { predict, type Prediction } from '@/features/predictions/model/predict';
import { useTaste } from '@/features/recommendations/model/store';
import { useSession } from '@/features/auth/model/store';
import { RESTAURANTS } from '@/mocks/seed/restaurants';
import { rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, FoodImage, Icon, PressableScale, Txt, toast } from '@/shared/ui';

/**
 * «Для вас сейчас» (D2): exactly one suggestion, with a «Почему?» explanation and «Не предлагать такое».
 */
export function usePrediction(): Prediction | null {
  const ctx = useAppContext();
  const orders = useOrders((s) => s.orders);
  const lines = useCart((s) => s.lines);
  const cartUpdatedAt = useCart((s) => s.updatedAt);
  const viewCounts = useTaste((s) => s.viewCounts);
  const muted = useTaste((s) => s.profile.mutedSuggestionKinds);
  const near = useDirector((s) => s.nearRestaurant);
  const user = useSession((s) => s.user);
  const personalization = user?.personalization ?? true;
  return useMemo(() => {
    if (!personalization) return null;
    const birthdayInDays = (() => {
      if (!user?.birthday) return undefined;
      const [, m, d] = user.birthday.split('-').map(Number);
      const now = new Date(ctx.now);
      const bd = new Date(now.getFullYear(), m - 1, d);
      const diff = Math.ceil((bd.getTime() - now.getTime()) / 86400000);
      return diff >= 0 ? diff : undefined;
    })();
    const delivered = orders.filter((o) => o.status === 'delivered' || o.status === 'picked_up');
    const list = predict({
      orders: delivered,
      now: ctx.now,
      ctx,
      cartDishIds: lines.map((l) => l.dishId),
      cartUpdatedAt,
      viewCounts,
      orderedDishIds: [...new Set(delivered.flatMap((o) => o.lines.map((l) => l.dishId)))],
      nearRestaurantName: near ? RESTAURANTS[0].name : undefined,
      birthdayInDays: user ? birthdayInDays : undefined,
      muted,
    });
    return list[0] ?? null;
  }, [ctx.now, ctx.weather, orders, lines, cartUpdatedAt, viewCounts, muted, near, user, personalization]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function PredictionCard({ prediction }: { prediction: Prediction }) {
  const { c } = useTheme();
  const nav = useNavigation();
  const [showWhy, setShowWhy] = useState(false);
  const byId = useMenu((s) => s.byId);
  const modifiers = useMenu((s) => s.modifiers);
  const orders = useOrders((s) => s.orders);
  const replaceAll = useCart((s) => s.replaceAll);
  const setMode = useCart((s) => s.setMode);
  const mute = useTaste((s) => s.mute);
  const dishes = prediction.dishIds.map((id) => byId[id]).filter(Boolean);
  const order = prediction.orderId ? orders.find((o) => o.id === prediction.orderId) : undefined;
  const sum = order
    ? order.lines.reduce((s, l) => {
        const d = byId[l.dishId];
        if (!d) return s;
        const extra = d.modifierGroupIds.flatMap((g) => modifiers[g]?.options ?? []).filter((o) => l.optionIds.includes(o.id)).reduce((a, o) => a + o.priceDelta, 0);
        return s + (d.price + extra) * l.qty;
      }, 0)
    : 0;

  const act = () => {
    haptic.confirm();
    switch (prediction.kind) {
      case 'ritual':
      case 'reorder_cycle':
        if (order) {
          replaceAll(order.lines.map((l) => ({ ...l })));
          toast('Собрали тот же заказ', { icon: 'check-circle', tone: 'success' });
          nav.navigate('Cart');
        }
        break;
      case 'abandoned_cart':
        nav.navigate('Cart');
        break;
      case 'viewed_not_ordered':
        nav.navigate('Dish', { id: prediction.dishIds[0] });
        break;
      case 'weather':
        nav.navigate('Tabs', { screen: 'Menu', params: { categoryId: 'soups' } });
        break;
      case 'company_weekend':
        nav.navigate('Tabs', { screen: 'Menu', params: { categoryId: 'sets' } });
        break;
      case 'near_restaurant':
        setMode('pickup');
        toast('Переключили на самовывоз — минус 10%', { icon: 'walk', tone: 'success' });
        break;
      case 'birthday':
        nav.navigate('Tabs', { screen: 'Restaurants' });
        break;
    }
  };

  const heroImg = dishes[0]?.image ?? (prediction.kind === 'weather' ? 'snd-borsch' : prediction.kind === 'birthday' ? 'banquet-1' : prediction.kind === 'near_restaurant' ? 'rest-1' : 'set-big-philly');

  return (
    <Animated.View testID="prediction-card" entering={FadeIn.duration(260)} layout={LinearTransition.springify().stiffness(380).damping(33)} style={{ marginHorizontal: space.l, borderRadius: radius.l, backgroundColor: c.surface, overflow: 'hidden', borderWidth: 1, borderColor: c.outline }}>
      <View style={{ flexDirection: 'row', padding: space.l, gap: space.m }}>
        <View style={{ width: 84, height: 84 }}>
          {dishes.length > 1 ? (
            dishes.slice(0, 3).map((d, i) => (
              <FoodImage key={d.id} id={d.image} small style={{ position: 'absolute', width: 60, height: 60, borderRadius: 30, left: i * 12, top: i * 12, borderWidth: 2, borderColor: c.surface }} />
            ))
          ) : (
            <FoodImage id={heroImg} small style={{ width: 84, height: 84, borderRadius: radius.m }} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="creation" size={14} color="accent" />
            <Txt v="caption" color="accent" upper>
              Для вас сейчас
            </Txt>
          </View>
          <Txt v="titleL">{prediction.title}</Txt>
          <Txt v="caption" color="textSecondary" numberOfLines={2}>
            {dishes.length > 1 ? dishes.map((d) => d.name).join(' + ') : prediction.subtitle}
          </Txt>
        </View>
      </View>
      {showWhy ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={{ marginHorizontal: space.l, marginBottom: space.m, padding: space.m, borderRadius: radius.s, backgroundColor: c.surfaceRaised, gap: space.s }}>
          <Txt v="bodyM" color="textSecondary">
            {prediction.why}
          </Txt>
          <PressableScale
            testID="prediction-mute"
            onPress={() => {
              mute(prediction.kind);
              toast('Больше не будем такое предлагать', { icon: 'eye-off-outline' });
            }}
            style={{ minHeight: 40, justifyContent: 'center' }}
          >
            <Txt v="label" color="textTertiary">
              Не предлагать такое
            </Txt>
          </PressableScale>
        </Animated.View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, paddingBottom: space.l, gap: space.m }}>
        <PressableScale testID="prediction-why" onPress={() => setShowWhy((v) => !v)} style={{ minHeight: 48, justifyContent: 'center', paddingRight: space.s }}>
          <Txt v="label" color="textSecondary">
            {showWhy ? 'Скрыть' : 'Почему?'}
          </Txt>
        </PressableScale>
        <View style={{ flex: 1 }} />
        <Button testID="prediction-cta" kind="tonal" size="m" title={sum ? `${prediction.cta} · ${rub(sum)}` : prediction.cta} onPress={act} />
      </View>
    </Animated.View>
  );
}

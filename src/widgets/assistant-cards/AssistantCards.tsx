import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { defaultOptions, useMenu } from '@/entities/dish/model/store';
import { useActiveOrder } from '@/entities/order/model/store';
import type { Restaurant } from '@/entities/restaurant/model/types';
import type { AssistantCard, BanquetCard, BookingCard, DishSetCard } from '@/features/ai-assistant/model/protocol';
import { setTotal } from '@/features/ai-assistant/model/protocol';
import { useCart } from '@/features/cart/model/store';
import { useTaste } from '@/features/recommendations/model/store';
import { useApi } from '@/services';
import { dayMonth, plural, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { motion, radius, space, useTheme } from '@/shared/theme';
import { Button, FoodImage, Icon, PressableScale, Txt, toast } from '@/shared/ui';
import { ActiveOrderCard } from '@/widgets/order-capsule/ActiveOrderCard';

function Shell({ children, testID }: { children: React.ReactNode; testID: string }) {
  const { c } = useTheme();
  return (
    <Animated.View entering={FadeInDown.springify().stiffness(motion.springStandard.stiffness).damping(motion.springStandard.damping)} testID={testID} style={{ backgroundColor: c.surface, borderRadius: radius.l, borderWidth: 1, borderColor: c.outline, overflow: 'hidden' }}>
      {children}
    </Animated.View>
  );
}

function DishSet({ card }: { card: DishSetCard }) {
  const { c } = useTheme();
  const nav = useNavigation();
  const byId = useMenu((s) => s.byId);
  const modifiers = useMenu((s) => s.modifiers);
  const stopList = useMenu((s) => s.stopList);
  const add = useCart((s) => s.add);
  const signal = useTaste((s) => s.signal);
  const [added, setAdded] = useState(false);
  const items = card.items.filter((it) => byId[it.dishId]);
  const total = setTotal(items, byId);
  const count = items.reduce((s, it) => s + it.qty, 0);

  const addAll = () => {
    let n = 0;
    for (const it of items) {
      const d = byId[it.dishId];
      if (stopList.includes(d.id)) continue;
      add(d.id, defaultOptions(d, modifiers), [], it.qty);
      signal(d, 'addToCart');
      n += it.qty;
    }
    haptic.confirm();
    setAdded(true);
    toast(`Добавили ${n} ${plural(n, 'позицию', 'позиции', 'позиций')} в корзину`, { icon: 'basket-check-outline' });
  };

  return (
    <Shell testID="assistant-card-dishes">
      <View style={{ padding: space.l, paddingBottom: space.s, gap: 2 }}>
        <Txt v="titleL">{card.title}</Txt>
        {card.note ? (
          <Txt v="caption" color="textSecondary">
            {card.note}
          </Txt>
        ) : null}
      </View>
      {items.map((it) => {
        const d = byId[it.dishId];
        const out = stopList.includes(d.id);
        return (
          <PressableScale key={it.dishId} testID={`assistant-dish-${d.id}`} onPress={() => nav.navigate('Dish', { id: d.id })} pressedScale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.s, opacity: out ? 0.4 : 1 }}>
            <FoodImage id={d.image} small style={{ width: 48, height: 48, borderRadius: radius.s }} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyM" numberOfLines={1}>
                {d.name}
              </Txt>
              <Txt v="caption" color="textTertiary">
                {out ? 'Закончилось' : `${d.weight} ${d.unit}`}
              </Txt>
            </View>
            <Txt v="label" color="textSecondary" tabular>
              {it.qty > 1 ? `${it.qty} × ` : ''}
              {rub(d.price)}
            </Txt>
          </PressableScale>
        );
      })}
      <View style={{ padding: space.l, paddingTop: space.s }}>
        {added ? (
          <Button testID="assistant-dishes-checkout" kind="tonal" full icon="basket-outline" title="В корзине · перейти" onPress={() => nav.navigate('Cart')} />
        ) : (
          <Button testID="assistant-dishes-add-all" full title={`Добавить всё · ${rub(total)}`} onPress={addAll} />
        )}
        <Txt v="caption" color="textTertiary" align="center" style={{ marginTop: space.xs }}>
          {count} {plural(count, 'позиция', 'позиции', 'позиций')}
          {added ? '' : ' · состав можно поменять в корзине'}
        </Txt>
      </View>
    </Shell>
  );
}

function useRestaurant(id?: string): Restaurant | undefined {
  const api = useApi();
  const [r, setR] = useState<Restaurant>();
  useEffect(() => {
    let alive = true;
    api.booking.restaurants().then((list) => alive && setR(list.find((x) => x.id === id) ?? (id ? undefined : list.find((x) => x.hasBanquetHall))));
    return () => {
      alive = false;
    };
  }, [api, id]);
  return r;
}

function Fact({ icon, text }: { icon: React.ComponentProps<typeof Icon>['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <Icon name={icon} size={16} color="textSecondary" />
      <Txt v="label" color="textSecondary">
        {text}
      </Txt>
    </View>
  );
}

function dateLabel(date?: string): string {
  if (!date) return 'Сегодня';
  const d = new Date(`${date}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  return diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : dayMonth(d.getTime());
}

function Booking({ card }: { card: BookingCard }) {
  const { c } = useTheme();
  const nav = useNavigation();
  const r = useRestaurant(card.restaurantId);
  if (!r) return null;
  return (
    <Shell testID="assistant-card-booking">
      <FoodImage id={r.image} style={{ width: '100%', height: 120 }} />
      <View style={{ padding: space.l, gap: space.s }}>
        <View>
          <Txt v="titleL">{r.name}</Txt>
          <Txt v="caption" color="textSecondary">
            {r.address} · м. {r.metro}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.l }}>
          <Fact icon="calendar-blank-outline" text={dateLabel(card.date)} />
          {card.time ? <Fact icon="clock-outline" text={card.time} /> : null}
          <Fact icon="account-multiple-outline" text={`${card.guests} ${plural(card.guests, 'гость', 'гостя', 'гостей')}`} />
        </View>
        {r.load > 0.75 ? (
          <Txt v="caption" style={{ color: c.warning }}>
            Сейчас почти полная посадка — лучше выбрать стол заранее
          </Txt>
        ) : null}
        <Button testID="assistant-booking-open" full title="Выбрать стол на схеме" onPress={() => nav.navigate('Booking', { restaurantId: r.id, date: card.date, time: card.time, guests: card.guests })} />
      </View>
    </Shell>
  );
}

function Banquet({ card }: { card: BanquetCard }) {
  const nav = useNavigation();
  const r = useRestaurant(card.restaurantId);
  return (
    <Shell testID="assistant-card-banquet">
      <FoodImage id="banquet-1" style={{ width: '100%', height: 120 }} />
      <View style={{ padding: space.l, gap: space.s }}>
        <Txt v="titleL">Банкет на {card.guests} {plural(card.guests, 'гостя', 'гостей', 'гостей')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.l }}>
          {r ? <Fact icon="map-marker-outline" text={r.name} /> : null}
          {card.budgetPerGuest ? <Fact icon="cash" text={`${rub(card.budgetPerGuest)} на гостя`} /> : null}
        </View>
        <Button testID="assistant-banquet-open" full title="Собрать меню банкета" onPress={() => nav.navigate('Banquet', { restaurantId: r?.id, guests: card.guests, budgetPerGuest: card.budgetPerGuest })} />
      </View>
    </Shell>
  );
}

function OrderStatus() {
  const order = useActiveOrder();
  if (!order) return null;
  return (
    <Animated.View entering={FadeInDown.springify()} testID="assistant-card-order">
      <ActiveOrderCard order={order} />
    </Animated.View>
  );
}

function Support({ topic }: { topic?: string }) {
  const nav = useNavigation();
  const order = useActiveOrder();
  return (
    <Shell testID="assistant-card-support">
      <View style={{ padding: space.l, gap: space.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Icon name="lifebuoy" size={22} color="accent" />
          <Txt v="titleL">Решим за минуту</Txt>
        </View>
        <Txt v="bodyM" color="textSecondary">
          Компенсация баллами начисляется сразу, оператор — если понадобится.
        </Txt>
        <Button testID="assistant-support-open" full kind="tonal" title="Перейти к решению" onPress={() => nav.navigate('Support', { orderId: order?.id, topic })} />
      </View>
    </Shell>
  );
}

export function AssistantCardView({ card }: { card: AssistantCard }) {
  switch (card.type) {
    case 'dishes':
      return <DishSet card={card} />;
    case 'booking':
      return <Booking card={card} />;
    case 'banquet':
      return <Banquet card={card} />;
    case 'order':
      return <OrderStatus />;
    case 'support':
      return <Support topic={card.topic} />;
  }
}

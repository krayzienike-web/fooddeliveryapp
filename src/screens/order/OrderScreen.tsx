import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { RootStackParamList } from '@/app/navigation/types';
import { useMenu } from '@/entities/dish/model/store';
import { remainingMinutes, STATUS_TITLE } from '@/entities/order/model/lifecycle';
import { useOrder, useOrders } from '@/entities/order/model/store';
import type { OrderStatus } from '@/entities/order/model/types';
import { useSession } from '@/features/auth/model/store';
import { useRestaurants } from '@/entities/restaurant/model/store';
import { useApi } from '@/services';
import { hhmm, minutes, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, FoodImage, Header, Icon, IconButton, PressableScale, Screen, Txt, toast } from '@/shared/ui';
import { Sparks } from '@/widgets/celebration/Sparks';
import { CourierMap } from '@/widgets/courier-map/CourierMap';
import { IncidentCard } from '@/widgets/incident/IncidentCard';
import { LiveKitchen } from '@/widgets/live-kitchen/LiveKitchen';

const DELIVERY_STEPS: Array<{ title: string; statuses: OrderStatus[] }> = [
  { title: 'Принят', statuses: ['created', 'accepted'] },
  { title: 'Готовим', statuses: ['cooking', 'packing'] },
  { title: 'В пути', statuses: ['courier_assigned', 'on_the_way'] },
  { title: 'У двери', statuses: ['arriving', 'delivered'] },
];
const PICKUP_STEPS: Array<{ title: string; statuses: OrderStatus[] }> = [
  { title: 'Принят', statuses: ['created', 'accepted'] },
  { title: 'Готовим', statuses: ['cooking', 'packing'] },
  { title: 'Готов', statuses: ['ready_for_pickup'] },
  { title: 'Получен', statuses: ['picked_up'] },
];

function Steps({ steps, status }: { steps: typeof DELIVERY_STEPS; status: OrderStatus }) {
  const { c } = useTheme();
  const cur = Math.max(0, steps.findIndex((s) => s.statuses.includes(status)));
  const done = status === 'delivered' || status === 'picked_up';
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.25, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <View testID="order-progress" style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {steps.map((s, i) => {
        const active = i === cur && !done;
        const passed = i < cur || done;
        return (
          <View key={s.title} style={{ flex: 1, alignItems: 'center', gap: space.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 3, backgroundColor: i === 0 ? 'transparent' : passed || active ? c.accent : c.surfaceHigh }} />
              <Animated.View style={[{ width: 16, height: 16, borderRadius: 8, backgroundColor: passed || active ? c.accent : c.surfaceHigh, borderWidth: active ? 3 : 0, borderColor: c.accentTonal }, active ? pulseStyle : null]} />
              <View style={{ flex: 1, height: 3, backgroundColor: i === steps.length - 1 ? 'transparent' : passed ? c.accent : c.surfaceHigh }} />
            </View>
            <Txt v="caption" color={active ? 'textPrimary' : passed ? 'textSecondary' : 'textTertiary'}>
              {s.title}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

export function OrderScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Order'>>();
  const api = useApi();
  const order = useOrder(params.id);
  const track = useOrders((s) => s.track);
  const upsert = useOrders((s) => s.upsert);
  const byId = useMenu((s) => s.byId);
  const refreshUser = useSession((s) => s.refreshUser);
  const [celebrate, setCelebrate] = useState(!!params.celebrate);
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    if (order) track(order);
    else api.orders.get(params.id).then(track).catch(() => undefined);
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!celebrate) return;
    haptic.confirm();
    const t = setTimeout(() => setCelebrate(false), 1600);
    return () => clearTimeout(t);
  }, [celebrate]);

  const restaurants = useRestaurants((s) => s.list);

  useEffect(() => {
    if (order?.status === 'delivered' || order?.status === 'picked_up') refreshUser();
  }, [order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const restaurant = restaurants.find((r) => r.id === order?.restaurantId) ?? restaurants[0];
  if (!order || !restaurant) return <Screen testID="order-screen" />;
  const pickup = order.mode === 'pickup';
  const final = order.status === 'delivered' || order.status === 'picked_up' || order.status === 'cancelled';
  const onRoad = order.status === 'courier_assigned' || order.status === 'on_the_way' || order.status === 'arriving';
  const left = order.route && onRoad ? remainingMinutes(order.route, order.courierProgress, 18) : null;
  const incidents = [...order.incidents].sort((a, b) => b.createdAt - a.createdAt);

  const arriving = async () => {
    const o = await api.orders.arriving(order.id);
    upsert(o);
    haptic.confirm();
    toast('Кухня знает, что вы рядом — заказ будет ждать на полке', { icon: 'walk', tone: 'success' });
  };

  return (
    <Screen testID="order-screen">
      <Header title={`Заказ №${order.number}`} onBack={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs', { screen: 'Home' }))} testID="order-header" right={<IconButton testID="order-help" icon="lifebuoy" label="Помощь" tone="none" onPress={() => nav.navigate('Support', { orderId: order.id })} />} />
      <ScrollView contentContainerStyle={{ padding: space.l, gap: space.xl, paddingBottom: 60 }}>
        {/* ETA: big time, not a ticking countdown */}
        <View style={{ gap: space.xs }}>
          <Txt testID="order-status-title" v="titleL" color="textSecondary">
            {STATUS_TITLE[order.status]}
          </Txt>
          {order.status === 'cancelled' ? null : final ? (
            <Txt v="displayL">{pickup ? 'Приятного аппетита!' : 'Доставлено'}</Txt>
          ) : pickup && order.status === 'ready_for_pickup' ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.m }}>
              <Txt v="bodyL" color="textSecondary">
                Полка
              </Txt>
              <Txt testID="order-pickup-shelf" v="displayL" style={{ fontSize: 56, lineHeight: 64 }} color="accent">
                {order.pickupShelf}
              </Txt>
            </View>
          ) : (
            <View testID="order-eta-live" style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.m }}>
              <Txt v="displayL" style={{ fontSize: 48, lineHeight: 56 }} tabular>
                {hhmm(order.etaTo - 4 * 60000)}
              </Txt>
              <Txt v="bodyL" color="textSecondary">
                ± 5 мин{left ? ` · ещё ${minutes(left)}` : ''}
              </Txt>
            </View>
          )}
          {pickup && !final ? (
            <Txt v="bodyM" color="textSecondary">
              {restaurant.name}, {restaurant.address}
            </Txt>
          ) : null}
        </View>

        {order.status !== 'cancelled' ? <Steps steps={pickup ? PICKUP_STEPS : DELIVERY_STEPS} status={order.status} /> : null}

        {incidents.map((i) => (
          <IncidentCard key={i.id} order={order} incident={i} />
        ))}

        {/* Map appears only on the road (guidebook §3.8); before that — the live kitchen */}
        {!pickup && onRoad && order.route && order.address ? (
          <Animated.View entering={FadeIn.duration(400)} style={{ gap: space.m }}>
            <CourierMap route={order.route} progress={order.courierProgress} home={order.address.point} restaurant={restaurant.point} width={width - space.l * 2} height={300} />
            {order.courier ? (
              <View testID="order-courier" style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surface }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.surfaceHigh, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt v="titleM">{order.courier.avatar}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="titleM">
                    {order.courier.name} · {order.courier.rating}★
                  </Txt>
                  <Txt v="caption" color="textSecondary">
                    {order.courier.vehicle === 'bike' ? 'На велосипеде' : order.courier.vehicle === 'scooter' ? 'На самокате' : order.courier.vehicle === 'car' ? 'На машине' : 'Пешком'}
                  </Txt>
                </View>
                <IconButton testID="order-courier-chat" icon="message-outline" label="Написать курьеру" onPress={() => toast('Чат с курьером откроется в приложении', { icon: 'message-outline' })} />
                <IconButton testID="order-courier-call" icon="phone-outline" label="Позвонить курьеру" onPress={() => toast(`Звонок через подменный номер ${order.courier!.maskedPhone}`, { icon: 'phone' })} />
              </View>
            ) : null}
          </Animated.View>
        ) : !final ? (
          <LiveKitchen order={order} />
        ) : null}

        {pickup && !final && order.status !== 'ready_for_pickup' ? (
          <Button testID="order-pickup-arriving" kind="tonal" icon="walk" title="Я подхожу" onPress={arriving} />
        ) : null}
        {pickup && order.status === 'ready_for_pickup' ? (
          <Button testID="order-pickup-arriving" kind="tonal" icon="hand-wave" title="Я на месте — выдайте заказ" onPress={arriving} />
        ) : null}

        {final && order.status !== 'cancelled' ? (
          <Animated.View entering={ZoomIn.springify()} style={{ gap: space.m, padding: space.l, borderRadius: radius.l, backgroundColor: c.surface }}>
            <Txt v="titleL">Как вам заказ?</Txt>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <PressableScale key={n} testID={`order-rate-star-${n}`} onPress={() => nav.navigate('Rate', { id: order.id, stars: n })} pressedScale={0.85} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={order.rated && order.rated.stars >= n ? 'star' : 'star-outline'} size={36} color="gold" />
                </PressableScale>
              ))}
            </View>
            <Button testID="order-primary-cta" kind="gold" icon="ferris-wheel" title="Крутить колесо призов" onPress={() => nav.navigate('Wheel', { orderId: order.id })} />
          </Animated.View>
        ) : null}

        <View style={{ borderRadius: radius.m, backgroundColor: c.surface }}>
          <PressableScale testID="order-items-toggle" onPress={() => setShowItems((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.l, gap: space.m }}>
            <View style={{ flexDirection: 'row' }}>
              {order.lines.slice(0, 4).map((l, i) => (byId[l.dishId] ? <FoodImage key={l.key} id={byId[l.dishId].image} small style={{ width: 32, height: 32, borderRadius: 16, marginLeft: i ? -10 : 0, borderWidth: 2, borderColor: c.surface }} /> : null))}
            </View>
            <Txt v="bodyM" style={{ flex: 1 }}>
              Состав · {rub(order.total)}
            </Txt>
            <Icon name={showItems ? 'chevron-up' : 'chevron-down'} color="textTertiary" />
          </PressableScale>
          {showItems ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={{ paddingHorizontal: space.l, paddingBottom: space.l, gap: space.s }}>
              {order.lines.map((l) => (
                <View key={l.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt v="bodyM" color="textSecondary">
                    {byId[l.dishId]?.name} × {l.qty}
                  </Txt>
                </View>
              ))}
            </Animated.View>
          ) : null}
        </View>

        <Button testID="order-support" kind="outline" icon="lifebuoy" title="Помощь с заказом" onPress={() => nav.navigate('Support', { orderId: order.id })} />
        {order.status === 'created' || order.status === 'accepted' ? (
          <Button
            testID="order-cancel"
            kind="ghost"
            title="Отменить заказ"
            onPress={async () => {
              try {
                const o = await api.orders.cancel(order.id);
                upsert(o);
                haptic.tick();
                toast(o.pointsSpent ? `Заказ отменён, ${o.pointsSpent} Б вернули` : 'Заказ отменён, деньги вернутся на карту', { icon: 'check-circle-outline' });
              } catch (e) {
                toast((e as { message?: string }).message ?? 'Отменить не получилось', { icon: 'alert-circle-outline', tone: 'error' });
              }
            }}
          />
        ) : null}
      </ScrollView>

      {celebrate ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(400)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: space.m }}>
          <Sparks />
          <Animated.View entering={ZoomIn.springify().stiffness(500).damping(14)} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-bold" size={52} raw={c.onAccent} />
          </Animated.View>
          <Txt v="displayL">Заказ принят!</Txt>
          <Txt v="bodyL" color="textSecondary">
            Шеф {order.chef.name} уже разжигает огонь
          </Txt>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

import { useNavigation } from '@react-navigation/native';
import { FlatList, View } from 'react-native';
import { useMenu } from '@/entities/dish/model/store';
import { STATUS_TITLE } from '@/entities/order/model/lifecycle';
import { useOrders } from '@/entities/order/model/store';
import { useCart } from '@/features/cart/model/store';
import { dayMonth, hhmm, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, FoodImage, Header, Screen, Txt, toast } from '@/shared/ui';

export function OrdersScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const orders = useOrders((s) => s.orders);
  const byId = useMenu((s) => s.byId);
  const replaceAll = useCart((s) => s.replaceAll);
  return (
    <Screen testID="orders-screen">
      <Header title="Мои заказы" onBack={() => nav.goBack()} />
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: space.l, gap: space.m }}
        renderItem={({ item: o }) => (
          <View testID={`orders-item-${o.id}`} style={{ padding: space.l, borderRadius: radius.m, backgroundColor: c.surface, gap: space.m }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt v="titleM">
                {dayMonth(o.createdAt)}, {hhmm(o.createdAt)}
              </Txt>
              <Txt v="priceM">{rub(o.total)}</Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <View style={{ flexDirection: 'row' }}>
                {o.lines.slice(0, 4).map((l, i) =>
                  byId[l.dishId] ? <FoodImage key={l.key} id={byId[l.dishId].image} small style={{ width: 40, height: 40, borderRadius: 20, marginLeft: i ? -12 : 0, borderWidth: 2, borderColor: c.surface }} /> : null,
                )}
              </View>
              <Txt v="caption" color="textSecondary" style={{ flex: 1 }} numberOfLines={2}>
                {o.lines.map((l) => byId[l.dishId]?.name).join(', ')}
              </Txt>
            </View>
            <Txt v="caption" color={o.status === 'cancelled' ? 'error' : 'textTertiary'}>
              {STATUS_TITLE[o.status]}
              {o.rated ? ` · ${'★'.repeat(o.rated.stars)}` : ''}
            </Txt>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <Button
                testID={`orders-repeat-${o.id}`}
                kind="tonal"
                size="m"
                title="Повторить"
                style={{ flex: 1 }}
                onPress={() => {
                  replaceAll(o.lines.map((l) => ({ ...l })));
                  haptic.confirm();
                  toast('Собрали корзину', { icon: 'history', tone: 'success' });
                  nav.navigate('Cart');
                }}
              />
              {o.status === 'delivered' && !o.rated ? <Button kind="outline" size="m" title="Оценить" style={{ flex: 1 }} onPress={() => nav.navigate('Rate', { id: o.id })} /> : null}
              {!['delivered', 'picked_up', 'cancelled'].includes(o.status) ? <Button kind="outline" size="m" title="Где заказ?" style={{ flex: 1 }} onPress={() => nav.navigate('Order', { id: o.id })} /> : null}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

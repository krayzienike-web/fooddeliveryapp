import { useNavigation } from '@react-navigation/native';
import { ScrollView, View } from 'react-native';
import { useMenu } from '@/entities/dish/model/store';
import { useOrders } from '@/entities/order/model/store';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { dayMonth, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { FoodImage, PressableScale, SectionTitle, Txt, toast } from '@/shared/ui';

/** «Повторить» (J2): up to 3 recent unique orders, one tap rebuilds the cart. */
export function RepeatStrip() {
  const { c } = useTheme();
  const nav = useNavigation();
  const user = useSession((s) => s.user);
  const orders = useOrders((s) => s.orders);
  const byId = useMenu((s) => s.byId);
  const replaceAll = useCart((s) => s.replaceAll);
  if (!user) return null;
  const seen = new Set<string>();
  const recent = orders
    .filter((o) => o.status === 'delivered')
    .filter((o) => {
      const sig = o.lines.map((l) => l.dishId).sort().join();
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    })
    .slice(0, 3);
  if (!recent.length) return null;
  return (
    <View>
      <SectionTitle title="Повторить" action="Все заказы" onAction={() => nav.navigate('Orders')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.m }}>
        {recent.map((o) => {
          const ds = o.lines.map((l) => byId[l.dishId]).filter(Boolean);
          return (
            <PressableScale
              key={o.id}
              testID={`home-repeat-${o.id}`}
              onPress={() => {
                haptic.confirm();
                replaceAll(o.lines.map((l) => ({ ...l })));
                toast('Корзина собрана как в прошлый раз', { icon: 'history', tone: 'success', action: { label: 'Открыть', onPress: () => nav.navigate('Cart') } });
              }}
              pressedScale={0.97}
            >
              <View style={{ width: 232, padding: space.m, borderRadius: radius.l, backgroundColor: c.surface, gap: space.s }}>
                <View style={{ flexDirection: 'row' }}>
                  {ds.slice(0, 4).map((d, i) => (
                    <FoodImage key={d.id + i} id={d.image} small style={{ width: 52, height: 52, borderRadius: 26, marginLeft: i ? -14 : 0, borderWidth: 2, borderColor: c.surface }} />
                  ))}
                </View>
                <Txt v="label" numberOfLines={1}>
                  {ds.map((d) => d.name).join(', ')}
                </Txt>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt v="caption" color="textTertiary">
                    {dayMonth(o.createdAt)}
                  </Txt>
                  <Txt v="label" color="accent">
                    Повторить · {rub(o.total)}
                  </Txt>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { linePrice } from '@/entities/cart/model/pricing';
import { useMenu } from '@/entities/dish/model/store';
import { useSession } from '@/features/auth/model/store';
import { useCart, type GroupMember } from '@/features/cart/model/store';
import { useCartTotals } from '@/features/cart/model/useTotals';
import { rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, FoodImage, Header, Icon, PressableScale, Screen, Segmented, Txt, toast } from '@/shared/ui';

/** Demo participants; avatar colours are data, not theme tokens. */
const FRIENDS: Array<GroupMember & { picks: string[]; joined: string }> = [
  { id: 'masha', name: 'Маша', color: '#E86FB0', picks: ['rl-philadelphia', 'drk-lemonade-mango'], joined: 'Маша присоединилась к заказу' },
  { id: 'dima', name: 'Дима', color: '#5CC2F2', picks: ['bg-double-bacon', 'snk-fries'], joined: 'Дима присоединился к заказу' },
];

/**
 * Group cart (C7): share a link, friends add their own dishes (simulated for the demo),
 * see who owes what and split the payment.
 */
export function GroupCartScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const user = useSession((s) => s.user);
  const lines = useCart((s) => s.lines);
  const group = useCart((s) => s.group);
  const startGroup = useCart((s) => s.startGroup);
  const endGroup = useCart((s) => s.endGroup);
  const markPaid = useCart((s) => s.markPaid);
  const add = useCart((s) => s.add);
  const byId = useMenu((s) => s.byId);
  const mods = useMenu((s) => s.modifiers);
  const totals = useCartTotals();
  const [split, setSplit] = useState<'own' | 'equal'>('own');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const me: GroupMember = { id: 'me', name: user?.name ?? 'Я', color: c.accent };
  const link = 'zhar.app/g/7KX2-PIZZA';

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = async () => {
    try {
      await Clipboard.setStringAsync(`https://${link}`);
    } catch {
      /* clipboard may be blocked */
    }
    haptic.confirm();
    toast('Ссылка скопирована — отправьте её друзьям', { icon: 'link-variant', tone: 'success' });
    startGroup([me]);
    // Demo: friends join and add their dishes a few seconds later.
    FRIENDS.forEach((f, i) => {
      timers.current.push(
        setTimeout(() => {
          const g = useCart.getState().group;
          useCart.getState().startGroup([...g, { id: f.id, name: f.name, color: f.color }]);
          toast(f.joined, { icon: 'account-plus' });
        }, 1800 + i * 2600),
      );
      f.picks.forEach((dishId, j) =>
        timers.current.push(
          setTimeout(() => {
            add(dishId, [], [], 1, f.id);
            haptic.tick();
          }, 2600 + i * 2600 + j * 900),
        ),
      );
    });
  };

  const members = group.length ? group : [];
  const perPerson = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of lines) {
      const who = l.addedBy ?? 'me';
      map[who] = (map[who] ?? 0) + linePrice(l, byId, mods);
    }
    return map;
  }, [lines, byId, mods]);
  const delivery = totals.deliveryFee;
  const share = (id: string) => (split === 'equal' ? Math.ceil(totals.total / Math.max(1, members.length)) : (perPerson[id] ?? 0) + Math.ceil(delivery / Math.max(1, members.length)));

  return (
    <Screen testID="group-cart-screen">
      <Header title="Общая корзина" onBack={() => nav.goBack()} testID="group-cart-header" />
      <ScrollView contentContainerStyle={{ padding: space.l, gap: space.l, paddingBottom: 140 }}>
        {!group.length ? (
          <View style={{ gap: space.m }}>
            <Txt v="headline">Заказ на компанию — без переводов и скриншотов</Txt>
            <Txt v="bodyL" color="textSecondary">
              Отправьте ссылку: каждый добавит своё, а в конце каждый заплатит за себя или все поровну.
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderRadius: radius.m, backgroundColor: c.surface }}>
              <Icon name="link-variant" color="accent" />
              <Txt v="titleM" style={{ flex: 1 }}>
                {link}
              </Txt>
            </View>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: space.m }}>
              {members.map((m) => (
                <Animated.View key={m.id} entering={FadeInDown.springify()} style={{ alignItems: 'center', gap: space.xs }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt v="titleM" style={{ color: c.onAccent }}>
                      {m.name[0]}
                    </Txt>
                    {m.paid ? (
                      <View style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={14} raw={c.onAccent} />
                      </View>
                    ) : null}
                  </View>
                  <Txt v="caption">{m.name}</Txt>
                </Animated.View>
              ))}
              <View style={{ alignItems: 'center', gap: space.xs }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderStyle: 'dashed', borderColor: c.outline, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" color="textTertiary" />
                </View>
                <Txt v="caption" color="textTertiary">
                  Ещё
                </Txt>
              </View>
            </View>

            {members.map((m) => {
              const mine = lines.filter((l) => (l.addedBy ?? 'me') === m.id);
              return (
                <Animated.View key={m.id} layout={LinearTransition} style={{ padding: space.l, borderRadius: radius.m, backgroundColor: c.surface, gap: space.s, borderLeftWidth: 4, borderLeftColor: m.color }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt v="titleM">{m.name}</Txt>
                    <Txt v="priceM">{rub(perPerson[m.id] ?? 0)}</Txt>
                  </View>
                  {mine.length ? (
                    mine.map((l) => (
                      <Animated.View key={l.key} entering={FadeInDown} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                        <FoodImage id={byId[l.dishId]?.image ?? ''} small style={{ width: 36, height: 36, borderRadius: 18 }} />
                        <Txt v="bodyM" color="textSecondary" style={{ flex: 1 }}>
                          {byId[l.dishId]?.name} × {l.qty}
                        </Txt>
                      </Animated.View>
                    ))
                  ) : (
                    <Txt v="caption" color="textTertiary">
                      Выбирает…
                    </Txt>
                  )}
                </Animated.View>
              );
            })}

            <View style={{ gap: space.m }}>
              <Txt v="titleL">Как платим</Txt>
              <Segmented testID="group-split" value={split} onChange={setSplit} items={[{ id: 'own', label: 'Каждый за своё' }, { id: 'equal', label: 'Поровну' }]} />
              {members.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 48 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
                  <Txt v="bodyL" style={{ flex: 1 }}>
                    {m.name}
                  </Txt>
                  <Txt v="priceM">{rub(share(m.id))}</Txt>
                  {m.id !== 'me' ? (
                    <PressableScale
                      onPress={() => {
                        markPaid(m.id);
                        haptic.confirm();
                      }}
                      style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: space.s }}
                    >
                      <Txt v="label" color={m.paid ? 'success' : 'accent'}>
                        {m.paid ? 'Оплатил(а)' : 'Запросить'}
                      </Txt>
                    </PressableScale>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline, gap: space.s }}>
        {group.length ? (
          <>
            <Button testID="group-cart-primary-cta" title="Перейти к оплате своей части" trailing={rub(share('me'))} onPress={() => nav.navigate('Cart')} />
            <Button kind="ghost" size="m" title="Завершить общий заказ" onPress={endGroup} />
          </>
        ) : (
          <Button testID="group-cart-primary-cta" icon="share-variant" title="Скопировать ссылку и начать" onPress={start} />
        )}
      </View>
    </Screen>
  );
}

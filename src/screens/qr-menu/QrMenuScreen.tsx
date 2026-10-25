import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMenu } from '@/entities/dish/model/store';
import { useRestaurant, useRestaurants } from '@/entities/restaurant/model/store';
import type { SplitMode, TableSession } from '@/entities/table/model/types';
import { useSession } from '@/features/auth/model/store';
import { TIP_OPTIONS, splitBill } from '@/features/table/model/bill';
import { useApi } from '@/services';
import { plural, points, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, Chip, FoodImage, Header, Icon, IconButton, PressableScale, Screen, Segmented, Stepper, Txt, toast } from '@/shared/ui';

const DEMO_QR = 'zhar://table/r-rubinshteyna/7';
const ADD_CATS = ['drinks', 'desserts', 'snacks'];

function Scanner({ onScanned }: { onScanned: () => void }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.min(260, width - space.x5 * 2);
  const line = useSharedValue(0);
  useEffect(() => {
    line.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [line]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: line.value * (size - 4) }] }));
  const corner = (pos: object) => <View style={[{ position: 'absolute', width: 36, height: 36, borderColor: c.accent }, pos]} />;
  return (
    <Animated.View entering={FadeIn} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl, padding: space.l }}>
      <View testID="qr-viewfinder" style={{ width: size, height: size, borderRadius: radius.l, backgroundColor: c.island, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', opacity: 0.18 }}>
          <Icon name="qrcode" size={size * 0.6} raw={c.onPhoto} />
        </View>
        {corner({ top: 12, left: 12, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 })}
        {corner({ top: 12, right: 12, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 })}
        {corner({ bottom: 12, left: 12, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 })}
        {corner({ bottom: 12, right: 12, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 })}
        <Animated.View style={[{ position: 'absolute', left: 16, right: 16, height: 2, backgroundColor: c.accent, opacity: 0.8 }, lineStyle]} />
      </View>
      <View style={{ gap: space.xs, alignItems: 'center' }}>
        <Txt v="headline" align="center">
          Наведите камеру на QR на столе
        </Txt>
        <Txt v="bodyM" color="textSecondary" align="center">
          Меню откроется сразу с заказом к вашему столу. Счёт можно разделить.
        </Txt>
      </View>
      <Button testID="qr-demo-scan" kind="tonal" icon="qrcode-scan" title="Демо: стол 7 на Рубинштейна" onPress={onScanned} />
    </Animated.View>
  );
}

function Paid({ amount, earned, onRate, onClose }: { amount: number; earned: number; onRate: () => void; onClose: () => void }) {
  const { c } = useTheme();
  return (
    <Animated.View entering={FadeIn} testID="qr-paid" style={{ flex: 1, padding: space.l, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: space.m, marginTop: space.x5 }}>
        <Animated.View entering={ZoomIn.springify().stiffness(500).damping(14)} style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.accentTonal, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check-bold" size={44} color="accent" />
        </Animated.View>
        <Txt v="displayM" align="center">
          Оплачено {rub(amount)}
        </Txt>
        <Txt v="bodyL" color="textSecondary" align="center">
          Чек в профиле. Начислили {points(earned)} — спасибо, что были у нас!
        </Txt>
      </View>
      <View style={{ gap: space.s }}>
        <Button testID="qr-rate" kind="tonal" full icon="star-outline" title="Оценить визит" onPress={onRate} />
        <Button testID="qr-finish" full title="Готово" onPress={onClose} />
      </View>
    </Animated.View>
  );
}

/** «За столом» (C17): scan the table QR → order more to the table, call the waiter, split and pay the bill. */
export function QrMenuScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const loadRestaurants = useRestaurants((s) => s.load);
  const dishes = useMenu((s) => s.dishes);
  const stopList = useMenu((s) => s.stopList);
  const user = useSession((s) => s.user);
  const [session, setSession] = useState<TableSession>();
  const [joining, setJoining] = useState(false);
  const r = useRestaurant(session?.restaurantId);
  const [mode, setMode] = useState<SplitMode>('all');
  const [people, setPeople] = useState(2);
  const [mine, setMine] = useState<string[]>([]);
  const [tips, setTips] = useState(10);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<{ amount: number; earned: number }>();
  const [adding, setAdding] = useState<string>();

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  const join = async () => {
    setJoining(true);
    try {
      const s = await api.table.join(DEMO_QR);
      haptic.confirm();
      setSession(s);
      setMine(s.items.slice(0, 1).map((i) => i.id));
    } finally {
      setJoining(false);
    }
  };

  const extras = useMemo(() => dishes.filter((d) => ADD_CATS.includes(d.categoryId) && !stopList.includes(d.id)).sort((a, b) => b.popularity - a.popularity).slice(0, 6), [dishes, stopList]);
  const split = session ? splitBill(session.items, { mode, people, mine, tipsPercent: tips }) : null;

  if (paid) {
    return (
      <Screen testID="qr-menu-screen" edges={['top', 'bottom']}>
        <Paid amount={paid.amount} earned={paid.earned} onClose={() => nav.goBack()} onRate={() => toast('Спасибо! Передадим команде', { icon: 'heart-outline', tone: 'success' })} />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen testID="qr-menu-screen" edges={['top', 'bottom']}>
        <Header title="За столом" onBack={() => nav.goBack()} testID="qr-header" />
        {joining ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="bodyL" color="textSecondary">
              Открываем ваш стол…
            </Txt>
          </View>
        ) : (
          <Scanner onScanned={join} />
        )}
      </Screen>
    );
  }

  const callWaiter = async () => {
    const res = await api.table.callWaiter(session.id);
    haptic.confirm();
    toast(`${session.waiter} подойдёт через ${res.etaMinutes} мин`, { icon: 'bell-ring-outline' });
  };

  const addExtra = async (dishId: string) => {
    setAdding(dishId);
    try {
      const s = await api.table.addItems(session.id, [{ dishId, qty: 1 }]);
      setSession(s);
      haptic.confirm();
      toast('Передали на кухню — принесут к столу', { icon: 'chef-hat' });
    } finally {
      setAdding(undefined);
    }
  };

  const pay = async () => {
    if (!split || split.total <= 0) return;
    if (!user) {
      nav.navigate('Auth');
      return;
    }
    setPaying(true);
    try {
      const res = await api.table.pay(session.id, split.subtotal, mode === 'items' ? mine : undefined);
      haptic.confirm();
      setPaid({ amount: split.total, earned: res.pointsEarned });
    } catch (e) {
      haptic.reject();
      toast((e as { message?: string }).message ?? 'Оплата не прошла', { icon: 'alert-circle-outline', tone: 'error' });
    } finally {
      setPaying(false);
    }
  };

  return (
    <Screen testID="qr-menu-screen">
      <Header title={`Стол ${session.tableLabel}`} subtitle={r?.name} onBack={() => nav.goBack()} testID="qr-header" right={<IconButton testID="qr-call-waiter" icon="bell-ring-outline" label="Позвать официанта" tone="none" onPress={callWaiter} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 150, gap: space.xl }}>
        <Animated.View entering={FadeInDown} style={{ marginHorizontal: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surfaceRaised }}>
          <Icon name="account-tie-outline" size={22} color="accent" />
          <Txt v="bodyM" style={{ flex: 1 }}>
            Вас обслуживает {session.waiter}. Заказ из приложения сразу уходит на кухню.
          </Txt>
        </Animated.View>

        <View style={{ gap: space.m }}>
          <Txt v="titleL" style={{ paddingHorizontal: space.l }}>
            Дозаказать к столу
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }}>
            {extras.map((d) => (
              <PressableScale key={d.id} testID={`qr-add-${d.id}`} disabled={!!adding} onPress={() => addExtra(d.id)} style={{ width: 132, borderRadius: radius.m, backgroundColor: c.surface, overflow: 'hidden', borderWidth: 1, borderColor: c.outline }}>
                <FoodImage id={d.image} small style={{ width: '100%', height: 88 }} />
                <View style={{ padding: space.s, gap: 2 }}>
                  <Txt v="label" numberOfLines={1}>
                    {d.name}
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Txt v="caption" color="textSecondary" style={{ flex: 1 }}>
                      {rub(d.price)}
                    </Txt>
                    <Icon name={adding === d.id ? 'progress-clock' : 'plus-circle'} size={20} color="accent" />
                  </View>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: space.m, paddingHorizontal: space.l }}>
          <Txt v="titleL">Счёт</Txt>
          <Segmented
            testID="qr-split-mode"
            items={[
              { id: 'all', label: 'Весь' },
              { id: 'equal', label: 'Поровну' },
              { id: 'items', label: 'Моё' },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'equal' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Txt v="bodyM" style={{ flex: 1 }}>
                Делим на {people} {plural(people, 'человека', 'человек', 'человек')}
              </Txt>
              <Stepper testID="qr-people" value={people} min={2} onInc={() => setPeople(Math.min(12, people + 1))} onDec={() => setPeople(Math.max(2, people - 1))} />
            </View>
          ) : mode === 'items' ? (
            <Txt v="caption" color="textSecondary">
              Отметьте, что ели вы — остальное оплатят друзья
            </Txt>
          ) : null}
          <View testID="qr-bill" style={{ borderRadius: radius.m, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline }}>
            {session.items.map((i, idx) => {
              const selected = mine.includes(i.id);
              const selectable = mode === 'items';
              return (
                <PressableScale
                  key={i.id}
                  testID={`qr-bill-item-${idx}`}
                  disabled={!selectable}
                  pressedScale={0.99}
                  onPress={() => setMine((m) => (m.includes(i.id) ? m.filter((x) => x !== i.id) : [...m, i.id]))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.m, paddingVertical: space.m, borderTopWidth: idx ? 1 : 0, borderTopColor: c.outline, backgroundColor: selectable && selected ? c.accentTonal : 'transparent' }}
                >
                  {selectable ? <Icon name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={22} color={selected ? 'accent' : 'textTertiary'} /> : null}
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyM" numberOfLines={1}>
                      {i.name}
                      {i.qty > 1 ? ` × ${i.qty}` : ''}
                    </Txt>
                    <Txt v="caption" color={i.status === 'cooking' ? 'warning' : 'textTertiary'}>
                      {i.status === 'cooking' ? 'Готовится' : 'Подано'}
                    </Txt>
                  </View>
                  <Txt v="label" tabular color="textSecondary">
                    {rub(i.price * i.qty)}
                  </Txt>
                </PressableScale>
              );
            })}
          </View>
          <View style={{ gap: space.s }}>
            <Txt v="label" color="textSecondary">
              Чаевые {session.waiter === 'Мария' ? 'Марии' : session.waiter}
            </Txt>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              {TIP_OPTIONS.map((t) => (
                <Chip key={t} testID={`qr-tips-${t}`} label={t ? `${t}%` : 'Без'} selected={tips === t} onPress={() => setTips(t)} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {split ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline, gap: space.s }}>
          <View style={{ flexDirection: 'row' }}>
            <Txt v="caption" color="textSecondary" style={{ flex: 1 }}>
              {mode === 'all' ? 'Весь стол' : mode === 'equal' ? `Ваша доля из ${rub(split.tableTotal)}` : `Ваши позиции из ${rub(split.tableTotal)}`}
            </Txt>
            {split.tips ? (
              <Txt v="caption" color="textSecondary">
                чаевые {rub(split.tips)}
              </Txt>
            ) : null}
          </View>
          <Button testID="qr-pay" full loading={paying} disabled={split.total <= 0} title={split.total > 0 ? `Оплатить ${rub(split.total)}` : 'Отметьте свои позиции'} onPress={pay} />
        </View>
      ) : null}
    </Screen>
  );
}

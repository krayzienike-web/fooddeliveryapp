import { CommonActions, useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { maxSpendablePoints } from '@/entities/cart/model/pricing';
import { useOrders } from '@/entities/order/model/store';
import type { PaymentMethod } from '@/entities/order/model/types';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { useCartTotals } from '@/features/cart/model/useTotals';
import { SlideToPay } from '@/features/checkout/ui/SlideToPay';
import { useDirector } from '@/features/director/model/store';
import { useRestaurants } from '@/entities/restaurant/model/store';
import { useApi } from '@/services';
import { hhmm, points as fmtPoints, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Button, Chip, Header, Icon, type IconName, PressableScale, Screen, Sheet, Txt, toast } from '@/shared/ui';

const METHODS: Array<{ id: PaymentMethod; title: string; icon: IconName; sub?: string }> = [
  { id: 'sbp', title: 'СБП', icon: 'bank-transfer', sub: 'Оплата из приложения банка' },
  { id: 'card', title: 'Карта Мир ·· 4417', icon: 'credit-card-outline' },
  { id: 'gpay', title: 'Mir Pay / Google Pay', icon: 'cellphone-nfc' },
  { id: 'card_courier', title: 'Картой курьеру', icon: 'credit-card-wireless-outline' },
  { id: 'cash', title: 'Наличными', icon: 'cash' },
];

type SheetId = 'address' | 'time' | 'payment' | 'comment' | null;

export function CheckoutScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const user = useSession((s) => s.user);
  const cart = useCart();
  const totals = useCartTotals();
  const track = useOrders((s) => s.track);
  const weather = useDirector((s) => s.weather);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [payment, setPayment] = useState<PaymentMethod>('sbp');
  const [asap, setAsap] = useState(true);
  const [slot, setSlot] = useState<number | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [paying, setPaying] = useState(false);
  const [weatherAck, setWeatherAck] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = user?.addresses.find((a) => a.id === cart.addressId) ?? user?.addresses[0];
  const restaurants = useRestaurants((s) => s.list);
  const restaurant = restaurants.find((r) => r.id === (cart.pickupRestaurantId ?? 'r-rubinshteyna')) ?? restaurants[0];
  const spendable = maxSpendablePoints(totals.itemsTotal - totals.discount, user?.points ?? 0);
  const slots = useMemo(() => {
    const now = Date.now();
    const start = Math.ceil((now + 60 * 60000) / (30 * 60000)) * 30 * 60000;
    return Array.from({ length: 8 }, (_, i) => start + i * 30 * 60000);
  }, []);
  const bad = weather === 'rain' || weather === 'storm';

  const pay = async () => {
    if (cart.mode === 'delivery' && bad && !weatherAck) {
      setWeatherAck(true);
      haptic.tick();
      return;
    }
    setPaying(true);
    setError(null);
    try {
      cart.setPoints(usePoints ? spendable : 0);
      const order = await api.orders.place({
        lines: cart.lines,
        mode: cart.mode,
        address: cart.mode === 'delivery' ? address : undefined,
        restaurantId: cart.mode === 'pickup' ? restaurant.id : 'r-rubinshteyna',
        payment,
        promoCode: cart.promo?.code,
        pointsToSpend: usePoints ? spendable : 0,
        tips: cart.tips,
        comment: cart.comment,
        cutlery: cart.cutlery,
        scheduledFor: asap ? undefined : slot ?? undefined,
      });
      haptic.confirm();
      track(order);
      cart.clear();
      nav.dispatch(CommonActions.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'Order', params: { id: order.id, celebrate: true } }] }));
    } catch (e) {
      haptic.reject();
      setError((e as { message: string }).message);
    } finally {
      setPaying(false);
    }
  };

  const Section = ({ testID, icon, title, value, onPress, warn }: { testID: string; icon: IconName; title: string; value: string; onPress?: () => void; warn?: boolean }) => (
    <PressableScale testID={testID} onPress={onPress} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, paddingHorizontal: space.l }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={warn ? 'warning' : 'textSecondary'} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="caption" color="textTertiary">
          {title}
        </Txt>
        <Txt v="bodyL" numberOfLines={2}>
          {value}
        </Txt>
      </View>
      {onPress ? <Icon name="chevron-right" color="textTertiary" /> : null}
    </PressableScale>
  );

  if (!restaurant) return <Screen testID="checkout-screen" />;

  return (
    <Screen testID="checkout-screen">
      <Header title="Оформление" onBack={() => nav.goBack()} testID="checkout-header" />
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        {cart.mode === 'delivery' ? (
          <Section testID="checkout-address" icon="map-marker-outline" title="Адрес доставки" value={address ? `${address.street}, ${address.house}${address.apartment ? `, кв. ${address.apartment}` : ''}${address.entrance ? ` · подъезд ${address.entrance}` : ''}${address.intercom ? ` · домофон ${address.intercom}` : ''}` : 'Добавьте адрес'} onPress={() => setSheet('address')} />
        ) : (
          <Section testID={`checkout-restaurant-${restaurant.id}`} icon="storefront-outline" title="Самовывоз" value={`${restaurant.name}, ${restaurant.address} · готов за ${restaurant.pickupMinutes} мин`} onPress={() => nav.navigate('Tabs', { screen: 'Restaurants' })} />
        )}
        <Section testID="checkout-time" icon="clock-outline" title="Время" value={asap ? (cart.mode === 'pickup' ? `Как можно скорее · ${restaurant.pickupMinutes} мин` : 'Как можно скорее · 35–45 мин') : `Ко времени · ${slot ? hhmm(slot) : ''}`} onPress={() => setSheet('time')} />
        <Section testID="checkout-payment" icon={METHODS.find((m) => m.id === payment)!.icon} title="Оплата" value={METHODS.find((m) => m.id === payment)!.title} onPress={() => setSheet('payment')} />
        <PressableScale
          testID="checkout-points"
          onPress={() => {
            haptic.tick();
            setUsePoints(!usePoints);
          }}
          accessibilityState={{ checked: usePoints }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, paddingHorizontal: space.l }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.goldTonal, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="star-four-points" size={20} color="gold" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="caption" color="textTertiary">
              Баллы · на счёте {fmtPoints(user?.points ?? 0)}
            </Txt>
            <Txt v="bodyL">Списать {fmtPoints(spendable)}</Txt>
          </View>
          <View style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: usePoints ? c.gold : c.surfaceHigh, padding: 3, alignItems: usePoints ? 'flex-end' : 'flex-start' }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.textPrimary }} />
          </View>
        </PressableScale>
        <Section testID="checkout-comment" icon="message-text-outline" title="Комментарий" value={cart.comment || (cart.mode === 'delivery' ? 'Как пройти, код двери, двор-колодец' : 'Пожелания кухне')} onPress={() => setSheet('comment')} />

        <View style={{ paddingHorizontal: space.l, marginTop: space.l, gap: space.s }}>
          <Txt v="label" color="textTertiary" upper>
            Чаевые курьеру
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
            {[0, 50, 100, 150].map((t) => (
              <Chip key={t} testID={`checkout-tips-${t}`} label={t ? rub(t) : 'Без чаевых'} selected={cart.tips === t} onPress={() => cart.setTips(t)} />
            ))}
          </View>
        </View>

        <View style={{ margin: space.l, padding: space.l, borderRadius: radius.m, backgroundColor: c.surface, gap: space.s }}>
          <Line label="Товары" value={rub(totals.itemsTotal)} />
          {totals.discount ? <Line label="Скидка" value={`− ${rub(totals.discount)}`} /> : null}
          {usePoints && spendable ? <Line label="Баллы" value={`− ${rub(spendable)}`} /> : null}
          <Line label="Доставка" value={cart.mode === 'pickup' ? '0 ₽' : totals.deliveryFee ? rub(totals.deliveryFee) : 'Бесплатно'} />
          {cart.tips ? <Line label="Чаевые" value={rub(cart.tips)} /> : null}
          <View style={{ height: 1, backgroundColor: c.outline }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt v="titleL">К оплате</Txt>
            <Txt testID="checkout-total" v="priceL">
              {rub(totals.total - (usePoints ? spendable : 0))}
            </Txt>
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline, gap: space.s }}>
        {weatherAck ? (
          <View testID="checkout-weather-notice" style={{ flexDirection: 'row', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surface, alignItems: 'center' }}>
            <Icon name="weather-pouring" color="warning" />
            <Txt v="bodyM" style={{ flex: 1 }}>
              Сейчас ливень — курьеры едут 60–70 минут. Самовывоз будет готов за 20 минут и на 10% дешевле.
            </Txt>
          </View>
        ) : null}
        {weatherAck ? (
          <Button
            testID="checkout-switch-pickup"
            kind="tonal"
            size="m"
            title="Заберу сам"
            onPress={() => {
              cart.setMode('pickup');
              setWeatherAck(false);
              toast('Переключили на самовывоз', { icon: 'walk', tone: 'success' });
            }}
          />
        ) : null}
        {error ? (
          <Txt v="caption" color="error">
            {error}
          </Txt>
        ) : null}
        <SlideToPay testID="checkout-primary-cta" label={payment === 'cash' || payment === 'card_courier' ? `Заказать · ${rub(totals.total)}` : weatherAck ? `Всё равно доставить · ${rub(totals.total)}` : `Оплатить ${rub(totals.total - (usePoints ? spendable : 0))}`} onConfirm={pay} loading={paying} />
      </View>

      <Sheet open={sheet === 'payment'} onClose={() => setSheet(null)} title="Способ оплаты">
        <View style={{ paddingBottom: space.m }}>
          {METHODS.map((m) => (
            <PressableScale
              key={m.id}
              testID={`checkout-payment-${m.id}`}
              onPress={() => {
                setPayment(m.id);
                setSheet(null);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 60, paddingHorizontal: space.xl }}
            >
              <Icon name={m.icon} color="textSecondary" />
              <View style={{ flex: 1 }}>
                <Txt v="bodyL">{m.title}</Txt>
                {m.sub ? (
                  <Txt v="caption" color="textTertiary">
                    {m.sub}
                  </Txt>
                ) : null}
              </View>
              <Icon name={payment === m.id ? 'radiobox-marked' : 'radiobox-blank'} color={payment === m.id ? 'accent' : 'textTertiary'} />
            </PressableScale>
          ))}
        </View>
      </Sheet>

      <Sheet open={sheet === 'time'} onClose={() => setSheet(null)} title="Когда доставить">
        <View style={{ paddingHorizontal: space.xl, gap: space.m, paddingBottom: space.m }}>
          <Chip
            testID="checkout-time-asap"
            label="Как можно скорее"
            selected={asap}
            onPress={() => {
              setAsap(true);
              setSheet(null);
            }}
          />
          <Txt v="label" color="textTertiary" upper>
            Ко времени
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {slots.map((t) => (
              <Chip
                key={t}
                label={hhmm(t)}
                selected={!asap && slot === t}
                onPress={() => {
                  setAsap(false);
                  setSlot(t);
                  setSheet(null);
                }}
              />
            ))}
          </View>
        </View>
      </Sheet>

      <Sheet open={sheet === 'address'} onClose={() => setSheet(null)} title="Адрес">
        <View style={{ paddingBottom: space.m }}>
          {user?.addresses.map((a) => (
            <PressableScale
              key={a.id}
              testID={`checkout-address-${a.id}`}
              onPress={() => {
                cart.setAddress(a.id);
                setSheet(null);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 60, paddingHorizontal: space.xl }}
            >
              <Icon name={a.label === 'Работа' ? 'briefcase-outline' : 'home-outline'} color="textSecondary" />
              <View style={{ flex: 1 }}>
                <Txt v="bodyL">{a.label}</Txt>
                <Txt v="caption" color="textTertiary">
                  {a.street}, {a.house}
                </Txt>
              </View>
              <Icon name={address?.id === a.id ? 'radiobox-marked' : 'radiobox-blank'} color={address?.id === a.id ? 'accent' : 'textTertiary'} />
            </PressableScale>
          ))}
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.m }}>
            <Button
              kind="tonal"
              icon="plus"
              title="Новый адрес"
              onPress={() => {
                setSheet(null);
                nav.navigate('Address');
              }}
            />
          </View>
        </View>
      </Sheet>

      <Sheet open={sheet === 'comment'} onClose={() => setSheet(null)} title="Комментарий">
        <View style={{ paddingHorizontal: space.xl, gap: space.m, paddingBottom: space.m }}>
          <TextInput
            testID="checkout-comment-input"
            value={cart.comment}
            onChangeText={cart.setComment}
            multiline
            placeholder="Например: вход со двора, арка справа, код 1234"
            placeholderTextColor={c.textTertiary}
            style={[typeScale.bodyL, { minHeight: 96, borderRadius: radius.s, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surfaceRaised, padding: space.m, color: c.textPrimary, textAlignVertical: 'top' }]}
          />
          <Button title="Готово" kind="tonal" onPress={() => setSheet(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Txt v="bodyM" color="textSecondary">
        {label}
      </Txt>
      <Txt v="bodyM" tabular>
        {value}
      </Txt>
    </View>
  );
}

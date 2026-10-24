import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeOut, LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { linePrice, PRICING } from '@/entities/cart/model/pricing';
import type { CartLine } from '@/entities/cart/model/types';
import { useMenu } from '@/entities/dish/model/store';
import { useAddToCart } from '@/features/add-to-cart/model/useAddToCart';
import { useIsLoggedIn } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { useCartTotals } from '@/features/cart/model/useTotals';
import { useApi } from '@/services';
import { plural, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { motion, radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Button, FoodImage, Icon, IconButton, PressableScale, Screen, Sheet, Stepper, Txt, toast } from '@/shared/ui';

function optionsLabel(line: CartLine, mods: ReturnType<typeof useMenu.getState>['modifiers'], dishIng: Array<{ id: string; title: string }>): string {
  const opts = Object.values(mods)
    .flatMap((g) => g.options)
    .filter((o) => line.optionIds.includes(o.id) && (o.priceDelta !== 0 || !!o.sizeCm))
    .map((o) => o.title);
  const rem = dishIng.filter((i) => line.removedIngredientIds.includes(i.id)).map((i) => `без ${i.title.toLowerCase()}`);
  return [...opts, ...rem].join(', ');
}

function SwipeLine({ line }: { line: CartLine }) {
  const { c } = useTheme();
  const byId = useMenu((s) => s.byId);
  const mods = useMenu((s) => s.modifiers);
  const inc = useCart((s) => s.inc);
  const dec = useCart((s) => s.dec);
  const remove = useCart((s) => s.remove);
  const add = useCart((s) => s.add);
  const x = useSharedValue(0);
  const dish = byId[line.dishId];
  const doRemove = () => {
    remove(line.key);
    haptic.threshold();
    toast(`«${dish.name}» удалено`, { icon: 'delete-outline', action: { label: 'Вернуть', onPress: () => add(line.dishId, line.optionIds, line.removedIngredientIds, line.qty, line.addedBy) } });
  };
  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      x.value = Math.min(0, e.translationX);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX < -110) {
        x.value = withTiming(-500, { duration: 180 }, () => runOnJS(doRemove)());
      } else x.value = withSpring(0, motion.springStandard);
    },
  });
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  if (!dish) return null;
  const label = optionsLabel(line, mods, dish.ingredients);
  return (
    <Animated.View exiting={FadeOut.duration(160)} layout={LinearTransition.springify().stiffness(380).damping(33)} style={{ overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 140, backgroundColor: c.error, alignItems: 'flex-end', justifyContent: 'center', paddingRight: space.xl }}>
        <Icon name="delete-outline" raw={c.onPhoto} />
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View testID={`cart-line-${line.dishId}`} style={[{ flexDirection: 'row', gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m, backgroundColor: c.bg, alignItems: 'center' }, a]}>
          <FoodImage id={dish.image} small style={{ width: 64, height: 64, borderRadius: radius.s }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt v="titleM" numberOfLines={2}>
              {dish.name}
            </Txt>
            {label ? (
              <Txt v="caption" color="textTertiary" numberOfLines={2}>
                {label}
              </Txt>
            ) : null}
            <Txt v="priceM">{rub(linePrice(line, byId, mods))}</Txt>
          </View>
          <Stepper size="s" deleteAtOne testID={`cart-qty-${line.dishId}`} value={line.qty} onInc={() => inc(line.key)} onDec={() => (line.qty === 1 ? doRemove() : dec(line.key))} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export function CartScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const lines = useCart((s) => s.lines);
  const group = useCart((s) => s.group);
  const cutlery = useCart((s) => s.cutlery);
  const setCutlery = useCart((s) => s.setCutlery);
  const promo = useCart((s) => s.promo);
  const setPromo = useCart((s) => s.setPromo);
  const clear = useCart((s) => s.clear);
  const mode = useCart((s) => s.mode);
  const byId = useMenu((s) => s.byId);
  const totals = useCartTotals();
  const loggedIn = useIsLoggedIn();
  const addToCart = useAddToCart();
  const [promoSheet, setPromoSheet] = useState(false);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const reachedOnce = useRef(totals.toFreeDelivery === 0);

  useEffect(() => {
    if (totals.toFreeDelivery === 0 && !reachedOnce.current && lines.length) {
      reachedOnce.current = true;
      haptic.confirm();
    }
  }, [totals.toFreeDelivery, lines.length]);

  // One upsell carousel, ranked by what's in the cart (guidebook §3.6).
  const upsell = useMemo(() => {
    const cats = new Set(lines.map((l) => byId[l.dishId]?.categoryId));
    const inCart = new Set(lines.map((l) => l.dishId));
    const want: string[] = [];
    if (!cats.has('drinks')) want.push('drk-lemonade-mango', 'drk-cola', 'drk-mors');
    if (cats.has('rolls') || cats.has('sets')) want.push('snd-miso', 'snk-edamame');
    if (cats.has('pizza') || cats.has('burgers')) want.push('snk-wings', 'snk-fries');
    if (!cats.has('desserts')) want.push('des-cheesecake', 'des-churros');
    return [...new Set(want)].filter((id) => !inCart.has(id) && byId[id]).slice(0, 6).map((id) => byId[id]);
  }, [lines, byId]);

  const progress = mode === 'delivery' ? Math.min(1, 1 - totals.toFreeDelivery / PRICING.freeDeliveryFrom) : 1;

  const applyCode = async () => {
    setCodeErr(null);
    try {
      const p = await api.catalog.validatePromo(code, totals.itemsTotal);
      setPromo(p);
      haptic.confirm();
      setPromoSheet(false);
      toast(`Промокод «${p.code}» применён`, { icon: 'ticket-percent', tone: 'success' });
    } catch (e) {
      haptic.reject();
      setCodeErr((e as { message?: string }).message ?? 'Не получилось применить');
    }
  };

  if (!lines.length) {
    return (
      <Screen testID="cart-screen">
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.s }}>
          <IconButton testID="cart-close" icon="close" label="Закрыть" tone="none" onPress={() => nav.goBack()} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.m }}>
          <Icon name="basket-outline" size={48} color="textTertiary" />
          <Txt v="headline" align="center">
            В корзине пусто
          </Txt>
          <Txt v="bodyM" color="textSecondary" align="center">
            Загляните в меню или спросите Шефа ИИ — он соберёт ужин под ваш бюджет.
          </Txt>
          <Button testID="cart-primary-cta" title="Открыть меню" onPress={() => nav.navigate('Tabs', { screen: 'Menu' })} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="cart-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.s }}>
        <IconButton testID="cart-close" icon="close" label="Закрыть" tone="none" onPress={() => nav.goBack()} />
        <Txt v="headline" style={{ flex: 1 }}>
          Корзина
        </Txt>
        <PressableScale testID="cart-clear" onPress={() => setConfirmClear(true)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: space.m }}>
          <Txt v="label" color="textSecondary">
            Очистить
          </Txt>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {mode === 'delivery' ? (
          <View testID="cart-to-free-delivery" style={{ marginHorizontal: space.l, marginBottom: space.s, gap: space.s }}>
            <Txt v="bodyM" color={totals.toFreeDelivery === 0 ? 'success' : 'textSecondary'}>
              {totals.toFreeDelivery === 0 ? 'Доставка бесплатно' : `Ещё ${rub(totals.toFreeDelivery)} до бесплатной доставки`}
            </Txt>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surfaceHigh }}>
              <View style={{ width: `${progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: totals.toFreeDelivery === 0 ? c.success : c.accent }} />
            </View>
          </View>
        ) : null}

        {group.length ? (
          <PressableScale testID="cart-group-banner" onPress={() => nav.navigate('GroupCart')} style={{ marginHorizontal: space.l, marginVertical: space.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surface }}>
              <Icon name="account-group" color="accent" />
              <Txt v="bodyM" style={{ flex: 1 }}>
                Общая корзина · {group.length} {plural(group.length, 'участник', 'участника', 'участников')}
              </Txt>
              <Icon name="chevron-right" color="textTertiary" />
            </View>
          </PressableScale>
        ) : null}

        {lines.map((l) => (
          <SwipeLine key={l.key} line={l} />
        ))}

        {upsell.length ? (
          <View style={{ marginTop: space.xl, gap: space.m }}>
            <Txt v="titleL" style={{ paddingHorizontal: space.l }}>
              Добавить к заказу
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.m }}>
              {upsell.map((d) => (
                <PressableScale key={d.id} testID={`cart-upsell-${d.id}`} onPress={() => addToCart(d, null)} style={{ width: 112, gap: space.xs }}>
                  <View>
                    <FoodImage id={d.image} small style={{ width: 112, height: 112, borderRadius: radius.m }} />
                    <View style={{ position: 'absolute', right: 6, bottom: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="plus" size={18} />
                    </View>
                  </View>
                  <Txt v="label" numberOfLines={2}>
                    {d.name}
                  </Txt>
                  <Txt v="label" color="textSecondary">
                    {rub(d.price)}
                  </Txt>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ marginHorizontal: space.l, marginTop: space.xl, gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
            <Icon name="silverware-variant" color="textSecondary" />
            <Txt v="bodyL" style={{ flex: 1, marginLeft: space.m }}>
              Приборы
            </Txt>
            <ViewStepper value={cutlery} onChange={setCutlery} />
          </View>
          <PressableScale testID="cart-promo-row" onPress={() => setPromoSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
            <Icon name="ticket-percent-outline" color="textSecondary" />
            <Txt v="bodyL" style={{ flex: 1, marginLeft: space.m }} color={promo ? 'success' : 'textPrimary'}>
              {promo ? `Промокод «${promo.code}»` : 'Промокод или сертификат'}
            </Txt>
            {promo ? (
              <IconButton testID="cart-promo-remove" icon="close" label="Убрать промокод" tone="none" size={36} onPress={() => setPromo(undefined)} />
            ) : (
              <Icon name="chevron-right" color="textTertiary" />
            )}
          </PressableScale>
          <PressableScale testID="cart-group-invite" onPress={() => nav.navigate('GroupCart')} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
            <Icon name="account-multiple-plus-outline" color="textSecondary" />
            <Txt v="bodyL" style={{ flex: 1, marginLeft: space.m }}>
              Собрать заказ с друзьями
            </Txt>
            <Icon name="chevron-right" color="textTertiary" />
          </PressableScale>
        </View>

        <View style={{ marginHorizontal: space.l, marginTop: space.l, padding: space.l, borderRadius: radius.m, backgroundColor: c.surface, gap: space.s }}>
          <Row label={`Товары · ${totals.itemsCount}`} value={rub(totals.itemsTotal)} />
          {totals.discount ? <Row label={mode === 'pickup' && !promo ? 'Скидка за самовывоз' : 'Скидка'} value={`− ${rub(totals.discount)}`} tone="success" /> : null}
          <Row label="Доставка" value={mode === 'pickup' ? 'Самовывоз' : totals.deliveryFee ? rub(totals.deliveryFee) : 'Бесплатно'} />
          <Row label="Сервисный сбор" value="0 ₽" />
          <View style={{ height: 1, backgroundColor: c.outline, marginVertical: space.xs }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt v="titleL">Итого</Txt>
            <Txt testID="cart-total" v="priceL">
              {rub(totals.total)}
            </Txt>
          </View>
          <Txt v="caption" color="gold">
            + {totals.pointsEarned} баллов за этот заказ
          </Txt>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline }}>
        <Button testID="cart-primary-cta" title="К оформлению" trailing={rub(totals.total)} onPress={() => (loggedIn ? nav.navigate('Checkout') : nav.navigate('Auth', { then: 'Checkout' }))} />
      </View>

      <Sheet open={promoSheet} onClose={() => setPromoSheet(false)} title="Промокод" testID="cart-promo-sheet">
        <View style={{ paddingHorizontal: space.xl, gap: space.m, paddingBottom: space.m }}>
          <TextInput
            testID="cart-promo-input"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            placeholder="Например, ЖАР300"
            placeholderTextColor={c.textTertiary}
            style={[typeScale.titleM, { height: 56, borderRadius: radius.s, borderWidth: 1, borderColor: codeErr ? c.error : c.outline, paddingHorizontal: space.l, color: c.textPrimary, backgroundColor: c.surfaceRaised }]}
          />
          {codeErr ? (
            <Txt v="caption" color="error">
              {codeErr}
            </Txt>
          ) : (
            <Txt v="caption" color="textTertiary">
              Для демо: ЖАР300, РОЛЛЫ3, ПЯТНИЦА, ДОСТАВКА0
            </Txt>
          )}
          <Button testID="cart-promo-apply" title="Применить" disabled={code.length < 3} onPress={applyCode} />
        </View>
      </Sheet>

      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Очистить корзину?">
        <View style={{ paddingHorizontal: space.xl, gap: space.m, paddingBottom: space.m }}>
          <Txt v="bodyM" color="textSecondary">
            Все позиции будут удалены.
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.m }}>
            <Button kind="outline" title="Оставить" style={{ flex: 1 }} onPress={() => setConfirmClear(false)} />
            <Button
              testID="cart-clear-confirm"
              kind="tonal"
              title="Очистить"
              style={{ flex: 1 }}
              onPress={() => {
                clear();
                setConfirmClear(false);
              }}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

function ViewStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <Stepper testID="cart-cutlery" size="s" value={value} min={0} onInc={() => onChange(value + 1)} onDec={() => onChange(value - 1)} />;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Txt v="bodyM" color="textSecondary">
        {label}
      </Txt>
      <Txt v="bodyM" color={tone ?? 'textPrimary'} tabular>
        {value}
      </Txt>
    </View>
  );
}

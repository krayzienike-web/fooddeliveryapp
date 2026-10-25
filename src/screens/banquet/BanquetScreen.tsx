import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/app/navigation/types';
import { useMenu } from '@/entities/dish/model/store';
import { useRestaurants } from '@/entities/restaurant/model/store';
import type { BanquetFormat, BanquetRequest } from '@/entities/restaurant/model/types';
import { useSession } from '@/features/auth/model/store';
import { BANQUET_LIMITS, composeBanquetMenu, gramsNorm, minBudgetPerGuest } from '@/features/booking/model/banquet';
import { dateOptions } from '@/features/booking/model/booking';
import { directorNow, useDirector } from '@/features/director/model/store';
import { useApi } from '@/services';
import { maskPhone, plural, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, Chip, FoodImage, Header, Icon, PressableScale, Screen, Segmented, Slider, Txt, toast } from '@/shared/ui';

const OCCASIONS = ['День рождения', 'Корпоратив', 'Свадьба', 'Юбилей', 'Выпускной'];
const FORMATS: Array<{ id: BanquetFormat; label: string }> = [
  { id: 'banquet', label: 'Банкет' },
  { id: 'buffet', label: 'Фуршет' },
  { id: 'catering', label: 'Выездной' },
];

function Block({ title, value, children }: { title: string; value?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.s }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: space.l }}>
        <Txt v="titleL" style={{ flex: 1 }}>
          {title}
        </Txt>
        {value ? (
          <Txt v="titleL" color="accent" tabular>
            {value}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Banquet constructor (J6, A17 + C9): two sliders → a live menu → one primary «Отправить менеджеру». */
export function BanquetScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Banquet'>>();
  const { list: restaurants, load } = useRestaurants();
  const dishes = useMenu((s) => s.dishes);
  const byId = useMenu((s) => s.byId);
  const stopList = useMenu((s) => s.stopList);
  const user = useSession((s) => s.user);
  const director = useDirector();
  const now = useMemo(() => new Date(directorNow(director)), [director.weekday, director.hour]); // eslint-disable-line react-hooks/exhaustive-deps
  // Banquets need a couple of days for purchasing and staff.
  const dates = useMemo(() => dateOptions(now, 32).slice(2), [now]);

  const halls = restaurants.filter((r) => r.hasBanquetHall);
  const [format, setFormat] = useState<BanquetFormat>('banquet');
  const [guests, setGuests] = useState(Math.min(BANQUET_LIMITS.maxGuests, Math.max(BANQUET_LIMITS.minGuests, params?.guests ?? 24)));
  const [budget, setBudget] = useState(params?.budgetPerGuest ?? 3000);
  const [date, setDate] = useState(dates[5]?.date ?? dates[0].date);
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [restaurantId, setRestaurantId] = useState(params?.restaurantId);
  const [variant, setVariant] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<BanquetRequest>();

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!restaurantId && halls[0]) setRestaurantId(halls[0].id);
  }, [halls, restaurantId]);

  const minBudget = useMemo(() => (dishes.length ? minBudgetPerGuest(dishes, guests, format, stopList) : BANQUET_LIMITS.minBudget), [dishes, guests, format, stopList]);
  useEffect(() => {
    if (budget < minBudget) setBudget(minBudget);
  }, [minBudget]); // eslint-disable-line react-hooks/exhaustive-deps

  const menu = useMemo(() => (dishes.length ? composeBanquetMenu(dishes, { guests, budgetPerGuest: budget, format, variant, stopList }) : null), [dishes, guests, budget, format, variant, stopList]);
  const [normLo, normHi] = gramsNorm(format);
  const hall = halls.find((r) => r.id === restaurantId);

  const send = async () => {
    if (!menu) return;
    if (!user) {
      nav.navigate('Auth', { then: 'Booking' });
      return;
    }
    setSending(true);
    try {
      const req = await api.booking.sendBanquet({
        restaurantId: format === 'catering' ? halls[0]?.id ?? '' : restaurantId ?? '',
        date,
        guests,
        budgetPerGuest: budget,
        format,
        occasion,
        menu: menu.sections.flatMap((s) => s.items),
        total: menu.total,
        gramsPerGuest: menu.gramsPerGuest,
      });
      haptic.confirm();
      setSent(req);
    } catch {
      haptic.reject();
      toast('Не получилось отправить — попробуйте ещё раз', { icon: 'alert-circle-outline', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Screen testID="banquet-screen" edges={['top', 'bottom']}>
        <Animated.View entering={FadeIn} testID="banquet-sent" style={{ flex: 1, padding: space.l, justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', gap: space.m, marginTop: space.x5 }}>
            <Animated.View entering={ZoomIn.springify().stiffness(500).damping(14)} style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.accentTonal, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="party-popper" size={42} color="accent" />
            </Animated.View>
            <Txt v="displayM" align="center">
              Заявка у менеджера
            </Txt>
            <Txt v="bodyL" color="textSecondary" align="center">
              Анна перезвонит в течение 15 минут{user ? ` на ${maskPhone(user.phone.replace(/\D/g, '').slice(-10))}` : ''}: уточнит детали, рассадку и подачу.
            </Txt>
          </View>
          <View style={{ padding: space.l, gap: space.xs, borderRadius: radius.l, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline }}>
            <Txt v="titleM">
              {occasion} · {guests} {plural(guests, 'гость', 'гостя', 'гостей')}
            </Txt>
            <Txt v="bodyM" color="textSecondary">
              {dates.find((d) => d.date === sent.date)?.label} · {format === 'catering' ? 'выездное обслуживание' : hall?.name}
            </Txt>
            <Txt v="bodyM" color="textSecondary">
              Меню на {rub(sent.total)} · {rub(Math.round(sent.total / guests))} на гостя
            </Txt>
            <Txt v="caption" color="textTertiary">
              Оплата после согласования — сейчас ничего не списали.
            </Txt>
          </View>
          <Button testID="banquet-finish" full title="Готово" onPress={() => nav.goBack()} />
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen testID="banquet-screen">
      <Header title="Банкет" subtitle="Меню под гостей и бюджет" onBack={() => nav.goBack()} testID="banquet-header" />
      <ScrollView contentContainerStyle={{ paddingTop: space.s, paddingBottom: insets.bottom + 120, gap: space.xl }}>
        <View style={{ paddingHorizontal: space.l }}>
          <Segmented testID="banquet-format" items={FORMATS} value={format} onChange={setFormat} />
        </View>

        <Block title="Гостей" value={String(guests)}>
          <View style={{ paddingHorizontal: space.l }}>
            <Slider testID="banquet-guests" label="Количество гостей" value={guests} min={BANQUET_LIMITS.minGuests} max={BANQUET_LIMITS.maxGuests} step={1} onChange={setGuests} />
          </View>
        </Block>

        <Block title="На гостя" value={rub(budget)}>
          <View style={{ paddingHorizontal: space.l, gap: space.xs }}>
            <Slider testID="banquet-budget" label="Бюджет на гостя" value={budget} min={minBudget} max={BANQUET_LIMITS.maxBudget} step={BANQUET_LIMITS.budgetStep} onChange={setBudget} />
            <Txt v="caption" color="textTertiary">
              Всего до {rub(budget * guests)} · от {rub(minBudget)} на гостя для такого формата
            </Txt>
          </View>
        </Block>

        <Block title="Когда">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }}>
            {dates.map((d, i) => (
              <Chip key={d.date} testID={`banquet-date-${i}`} label={d.label} selected={d.date === date} onPress={() => setDate(d.date)} />
            ))}
          </ScrollView>
        </Block>

        <Block title="Повод">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }}>
            {OCCASIONS.map((o, i) => (
              <Chip key={o} testID={`banquet-occasion-${i}`} label={o} selected={o === occasion} onPress={() => setOccasion(o)} />
            ))}
          </ScrollView>
        </Block>

        {format === 'catering' ? (
          <Block title="Где">
            <View style={{ marginHorizontal: space.l, flexDirection: 'row', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.surfaceRaised, alignItems: 'center' }}>
              <Icon name="truck-fast-outline" size={22} color="accent" />
              <Txt v="bodyM" style={{ flex: 1 }}>
                Привезём, накроем и уберём на вашей площадке. Адрес уточнит менеджер.
              </Txt>
            </View>
          </Block>
        ) : (
          <Block title="Зал">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }}>
              {halls.map((r) => {
                const active = r.id === restaurantId;
                return (
                  <PressableScale key={r.id} testID={`banquet-hall-${r.id}`} onPress={() => setRestaurantId(r.id)} style={{ width: 200, borderRadius: radius.m, overflow: 'hidden', backgroundColor: c.surface, borderWidth: active ? 2 : 1, borderColor: active ? c.accent : c.outline }}>
                    <FoodImage id={r.gallery.find((g) => g.startsWith('banquet')) ?? r.image} style={{ width: '100%', height: 96 }} />
                    <View style={{ padding: space.s }}>
                      <Txt v="titleM" numberOfLines={1}>
                        {r.name.replace(/^ЖАР\s*/, '')}
                      </Txt>
                      <Txt v="caption" color="textTertiary" numberOfLines={1}>
                        {r.features.find((f) => /банкет|зал/i.test(f)) ?? r.address}
                      </Txt>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Block>
        )}

        {menu ? (
          <Animated.View layout={LinearTransition} testID="banquet-menu" style={{ marginHorizontal: space.l, borderRadius: radius.l, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline, overflow: 'hidden' }}>
            <View style={{ padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Icon name="creation" size={20} color="accent" />
              <View style={{ flex: 1 }}>
                <Txt v="titleL">Меню от Шефа ИИ</Txt>
                <Txt v="caption" color="textSecondary">
                  Пересчитывается под гостей и бюджет
                </Txt>
              </View>
              <Button testID="banquet-reshuffle" kind="ghost" size="s" icon="refresh" title="Другое" onPress={() => setVariant((v) => v + 1)} />
            </View>
            {menu.sections.map((s) => (
              <Animated.View key={`${s.title}-${variant}`} entering={FadeInDown.duration(220)} style={{ paddingHorizontal: space.l, paddingBottom: space.m, gap: space.s }}>
                <Txt v="label" color="textTertiary" upper>
                  {s.title}
                </Txt>
                {s.items.map((it) => {
                  const d = byId[it.dishId];
                  return (
                    <View key={it.dishId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                      <FoodImage id={d.image} small style={{ width: 40, height: 40, borderRadius: radius.s }} />
                      <Txt v="bodyM" style={{ flex: 1 }} numberOfLines={1}>
                        {d.name}
                      </Txt>
                      <Txt v="label" color="textSecondary" tabular>
                        × {it.qty}
                      </Txt>
                    </View>
                  );
                })}
              </Animated.View>
            ))}
            <View style={{ padding: space.l, gap: space.xs, borderTopWidth: 1, borderTopColor: c.outline, backgroundColor: c.surfaceRaised }}>
              <View style={{ flexDirection: 'row' }}>
                <Txt v="titleM" style={{ flex: 1 }}>
                  Итого
                </Txt>
                <Txt v="titleM" tabular testID="banquet-total">
                  {rub(menu.total)}
                </Txt>
              </View>
              <Txt v="caption" color="textSecondary">
                {rub(menu.perGuest)} на гостя · ~{menu.gramsPerGuest} г еды на гостя (норма {normLo}–{normHi} г)
              </Txt>
              {!menu.fitsBudget ? (
                <Txt v="caption" color="warning">
                  В этот бюджет полноценно не уложиться — поднимите сумму на гостя.
                </Txt>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline, gap: space.xs }}>
        <Button testID="banquet-send" full loading={sending} disabled={!menu || (format !== 'catering' && !restaurantId)} title="Отправить менеджеру" onPress={send} />
        <Txt v="caption" color="textTertiary" align="center">
          Без предоплаты — менеджер перезвонит за 15 минут
        </Txt>
      </View>
    </Screen>
  );
}

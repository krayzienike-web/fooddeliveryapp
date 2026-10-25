import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/app/navigation/types';
import { useMenu } from '@/entities/dish/model/store';
import { useRestaurant, useRestaurants } from '@/entities/restaurant/model/store';
import type { Booking, FloorPlan, FloorTable } from '@/entities/restaurant/model/types';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { BOOKING, bookableSlots, bookingIcs, dateOptions, normTime, parseYmd, pickTable, ZONE_TITLE } from '@/features/booking/model/booking';
import { directorNow, useDirector } from '@/features/director/model/store';
import { useApi } from '@/services';
import { dayMonth, plural, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, Chip, FoodImage, Header, Icon, Screen, Skeleton, Stepper, Txt, toast } from '@/shared/ui';
import { FloorPlanView } from '@/widgets/floor-plan/FloorPlanView';

const OCCASIONS = ['Свидание', 'День рождения', 'Деловая встреча', 'С детьми'];
const PREORDER_CATS = ['salads', 'hot', 'pizza', 'rolls', 'snacks', 'desserts'];

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l }}>
        <Txt v="titleL" style={{ flex: 1 }}>
          {title}
        </Txt>
        {right}
      </View>
      {children}
    </View>
  );
}

function Done({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { c } = useTheme();
  const r = useRestaurant(booking.restaurantId)!;
  const byId = useMenu((s) => s.byId);
  const insets = useSafeAreaInsets();
  const pre = booking.preorder.filter((p) => byId[p.dishId]);

  const addToCalendar = async () => {
    const ics = bookingIcs(booking, r);
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
        a.download = 'zhar-booking.ics';
        a.click();
      } else {
        await Linking.openURL(`data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`);
      }
    } catch {
      /* the reminder below still holds */
    }
    toast('Напомним за 2 часа до визита', { icon: 'bell-ring-outline', tone: 'success' });
  };

  return (
    <Animated.View entering={FadeIn} testID="booking-done" style={{ flex: 1, padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: space.m, marginTop: space.x4 }}>
        <Animated.View entering={ZoomIn.springify().stiffness(500).damping(14)} style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.accentTonal, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check-bold" size={44} color="accent" />
        </Animated.View>
        <Txt v="displayM" align="center">
          Стол ваш
        </Txt>
        <Txt v="bodyL" color="textSecondary" align="center">
          {r.name}, {dayMonth(parseYmd(booking.date).getTime())} в {normTime(booking.time)}
        </Txt>
      </View>
      <View style={{ gap: space.m, padding: space.l, borderRadius: radius.l, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline }}>
        <Txt v="bodyM">
          {booking.guests} {plural(booking.guests, 'гость', 'гостя', 'гостей')} · стол {booking.tableId.replace(/^\D+/, '')}
          {booking.occasion ? ` · ${booking.occasion.toLowerCase()}` : ''}
        </Txt>
        <Txt v="bodyM" color="textSecondary">
          {r.address} · м. {r.metro}
        </Txt>
        {pre.length ? (
          <View style={{ gap: space.xs }}>
            <Txt v="label" color="accent">
              Предзаказ к приходу
            </Txt>
            {pre.map((p) => (
              <Txt key={p.dishId} v="bodyM" color="textSecondary">
                {byId[p.dishId].name} × {p.qty}
              </Txt>
            ))}
          </View>
        ) : (
          <Txt v="caption" color="textTertiary">
            Блюда можно предзаказать позже — кухня начнёт готовить к вашему приходу.
          </Txt>
        )}
      </View>
      <View style={{ gap: space.s }}>
        <Button testID="booking-calendar" kind="tonal" full icon="calendar-plus" title="Добавить в календарь" onPress={addToCalendar} />
        <Button testID="booking-finish" full title="Готово" onPress={onClose} />
      </View>
    </Animated.View>
  );
}

/** Table booking (J5, A16 + C8 pre-order): date → guests → time → table (optional) → pre-order. */
export function BookingScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Booking'>>();
  const loadRestaurants = useRestaurants((s) => s.load);
  const addBooking = useRestaurants((s) => s.addBooking);
  const r = useRestaurant(params.restaurantId);
  const user = useSession((s) => s.user);
  const dishes = useMenu((s) => s.dishes);
  const byId = useMenu((s) => s.byId);
  const stopList = useMenu((s) => s.stopList);
  const cartLines = useCart((s) => s.lines);
  const director = useDirector();
  const now = useMemo(() => new Date(directorNow(director)), [director.weekday, director.hour]); // eslint-disable-line react-hooks/exhaustive-deps

  const dates = useMemo(() => dateOptions(now), [now]);
  const [date, setDate] = useState(params.date && dates.some((d) => d.date === params.date) ? params.date : dates[0].date);
  const [guests, setGuests] = useState(Math.min(BOOKING.maxGuests, Math.max(1, params.guests ?? 2)));
  const [time, setTime] = useState<string | undefined>(params.time ? normTime(params.time) : undefined);
  const [plan, setPlan] = useState<FloorPlan>();
  const [busyBySlot, setBusyBySlot] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [tableId, setTableId] = useState<string>();
  const [manual, setManual] = useState(false);
  const [occasion, setOccasion] = useState<string>();
  const [preorderOn, setPreorderOn] = useState(false);
  const [preorder, setPreorder] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Booking>();
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);
  useEffect(() => {
    if (r) api.booking.floorPlan(r.floorPlanId).then(setPlan);
  }, [api, r]);

  // Availability for every bookable slot of the day, for this party size.
  const slots = useMemo(() => {
    const all: string[] = [];
    for (let h = 12; h <= 22; h++) for (const m of ['00', '30']) all.push(`${h}:${m}`);
    return r ? bookableSlots(all, date, now, r) : [];
  }, [r, date, now]);
  useEffect(() => {
    if (!r || !plan) return;
    let alive = true;
    setLoadingSlots(true);
    Promise.all(slots.map((s) => api.booking.availability(r.id, date, s, guests).then((a) => [s, a.busyTableIds] as const))).then((rows) => {
      if (!alive) return;
      setBusyBySlot(Object.fromEntries(rows));
      setLoadingSlots(false);
    });
    return () => {
      alive = false;
    };
  }, [api, r, plan, date, guests, slots]);

  const free = (s: string) => !!plan && !!pickTable(plan.tables, busyBySlot[s] ?? [], guests);
  const available = slots.filter((s) => busyBySlot[s] && free(s));
  const busy = time ? busyBySlot[time] ?? [] : [];

  // Keep the chosen time valid; auto-pick «any free table» unless the guest chose one on the plan.
  useEffect(() => {
    if (loadingSlots) return;
    if (time && !available.includes(time)) setTime(undefined);
  }, [loadingSlots, available.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!plan || !time) return setTableId(undefined);
    const current = plan.tables.find((t) => t.id === tableId);
    if (manual && current && current.seats >= guests && !busy.includes(current.id)) return;
    setManual(false);
    setTableId(pickTable(plan.tables, busy, guests)?.id);
  }, [plan, time, guests, busy.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const table = plan?.tables.find((t) => t.id === tableId);
  const suggestions = useMemo(
    () => dishes.filter((d) => PREORDER_CATS.includes(d.categoryId) && !stopList.includes(d.id)).sort((a, b) => b.popularity - a.popularity).slice(0, 6),
    [dishes, stopList],
  );
  const preorderItems = Object.entries(preorder).filter(([, q]) => q > 0).map(([dishId, qty]) => ({ dishId, qty }));
  const preorderTotal = preorderItems.reduce((s, p) => s + (byId[p.dishId]?.price ?? 0) * p.qty, 0);

  if (!r) return <Screen testID="booking-screen" />;

  if (done) {
    return (
      <Screen testID="booking-screen" edges={['top']}>
        <Done booking={done} onClose={() => nav.goBack()} />
      </Screen>
    );
  }

  const submit = async () => {
    if (!time || !tableId) return;
    if (!user) {
      nav.navigate('Auth', { then: 'Booking' });
      return;
    }
    setSubmitting(true);
    try {
      const b = await api.booking.book({ restaurantId: r.id, tableId, date, time, guests, occasion, preorder: preorderOn ? preorderItems : [] });
      addBooking(b);
      haptic.confirm();
      setDone(b);
    } catch (e) {
      haptic.reject();
      toast((e as { message?: string }).message ?? 'Не получилось забронировать', { icon: 'alert-circle-outline', tone: 'error' });
      // Someone took the table: refresh this slot and pick another one.
      const a = await api.booking.availability(r.id, date, time, guests);
      setBusyBySlot((m) => ({ ...m, [time]: a.busyTableIds }));
      setManual(false);
    } finally {
      setSubmitting(false);
    }
  };

  const selectTable = (t: FloorTable) => {
    setManual(true);
    setTableId(t.id);
  };

  return (
    <Screen testID="booking-screen">
      <Header title="Бронь стола" subtitle={r.name} onBack={() => nav.goBack()} testID="booking-header" />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: space.s, paddingBottom: insets.bottom + 120, gap: space.xl }}>
        <Section title="Когда">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }}>
            {dates.map((d, i) => (
              <Chip key={d.date} testID={`booking-date-${i}`} label={d.label} selected={d.date === date} onPress={() => setDate(d.date)} />
            ))}
          </ScrollView>
        </Section>

        <Section
          title="Сколько гостей"
          right={
            <Stepper
              testID="booking-guests"
              value={guests}
              min={1}
              onInc={() => (guests < BOOKING.maxGuests ? setGuests(guests + 1) : nav.navigate('Banquet', { restaurantId: r.id, guests: 13 }))}
              onDec={() => setGuests(Math.max(1, guests - 1))}
            />
          }
        >
          {guests >= BOOKING.maxGuests ? (
            <Txt v="caption" color="textSecondary" style={{ paddingHorizontal: space.l }}>
              Больше {BOOKING.maxGuests} гостей — это уже банкет: нажмите «+», соберём меню и зал.
            </Txt>
          ) : null}
        </Section>

        <Section title="Время">
          {loadingSlots ? (
            <View style={{ flexDirection: 'row', gap: space.s, paddingHorizontal: space.l }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} w={72} h={40} r={radius.full} />
              ))}
            </View>
          ) : available.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="booking-slots" contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }}>
              {available.map((s) => (
                <Chip key={s} testID={`booking-slot-${s.replace(':', '')}`} label={s} selected={s === time} onPress={() => setTime(s)} />
              ))}
            </ScrollView>
          ) : (
            <Txt v="bodyM" color="textSecondary" style={{ paddingHorizontal: space.l }}>
              На этот день свободных столов на {guests} {plural(guests, 'гостя', 'гостей', 'гостей')} нет — попробуйте другой день или другой ресторан.
            </Txt>
          )}
        </Section>

        {time && plan ? (
          <Animated.View entering={FadeInDown.springify()}>
            <Section title="Стол">
              <View style={{ paddingHorizontal: space.l, gap: space.m }}>
                {table ? (
                  <View testID="booking-table-summary" style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.m, backgroundColor: c.accentTonal }}>
                    <Icon name="table-chair" size={22} color="accent" />
                    <View style={{ flex: 1 }}>
                      <Txt v="titleM">
                        {manual ? 'Стол' : 'Подобрали стол'} {table.label} · {ZONE_TITLE[table.zone].toLowerCase()}
                      </Txt>
                      <Txt v="caption" color="textSecondary">
                        {table.seats} {plural(table.seats, 'место', 'места', 'мест')}
                        {table.view ? ` · ${table.view}` : ''}
                      </Txt>
                    </View>
                  </View>
                ) : null}
                <Txt v="caption" color="textTertiary">
                  Можно выбрать другой свободный стол на схеме
                </Txt>
                <FloorPlanView plan={plan} width={width - space.l * 2} busy={busy} guests={guests} selectedId={tableId} onSelect={selectTable} />
                <View style={{ flexDirection: 'row', gap: space.l, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Свободен', style: { borderWidth: 1.5, borderColor: c.textPrimary } },
                    { label: 'Ваш', style: { backgroundColor: c.accentTonal, borderWidth: 2, borderColor: c.accent } },
                    { label: 'Занят', style: { backgroundColor: c.surfaceHigh, opacity: 0.45 } },
                  ].map((l) => (
                    <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                      <View style={[{ width: 14, height: 14, borderRadius: 4 }, l.style]} />
                      <Txt v="caption" color="textSecondary">
                        {l.label}
                      </Txt>
                    </View>
                  ))}
                </View>
              </View>
            </Section>
          </Animated.View>
        ) : null}

        {time ? (
          <>
            <Section title="Повод">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }}>
                {OCCASIONS.map((o, i) => (
                  <Chip key={o} testID={`booking-occasion-${i}`} label={o} selected={occasion === o} onPress={() => setOccasion(occasion === o ? undefined : o)} />
                ))}
              </ScrollView>
            </Section>

            <Section
              title="Предзаказ к приходу"
              right={
                <Chip
                  testID="booking-preorder-toggle"
                  small
                  icon={preorderOn ? 'check' : 'plus'}
                  label={preorderOn ? 'Добавлен' : 'Добавить'}
                  selected={preorderOn}
                  onPress={() => {
                    setPreorderOn(!preorderOn);
                    if (!preorderOn) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 200);
                  }}
                />
              }
            >
              {!preorderOn ? (
                <Txt v="bodyM" color="textSecondary" style={{ paddingHorizontal: space.l }}>
                  Кухня начнёт готовить к вашему приходу — горячее подадут через 5 минут после посадки.
                </Txt>
              ) : (
                <Animated.View entering={FadeInDown} style={{ paddingHorizontal: space.l, gap: space.s }}>
                  {cartLines.length ? (
                    <Chip
                      testID="booking-preorder-from-cart"
                      icon="basket-outline"
                      label={`Взять из корзины · ${cartLines.reduce((s, l) => s + l.qty, 0)} поз.`}
                      onPress={() => setPreorder((p) => cartLines.reduce((acc, l) => ({ ...acc, [l.dishId]: (acc[l.dishId] ?? 0) + l.qty }), { ...p }))}
                    />
                  ) : null}
                  {suggestions.map((d) => (
                    <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                      <FoodImage id={d.image} small style={{ width: 48, height: 48, borderRadius: radius.s }} />
                      <View style={{ flex: 1 }}>
                        <Txt v="bodyM" numberOfLines={1}>
                          {d.name}
                        </Txt>
                        <Txt v="caption" color="textTertiary">
                          {rub(d.price)}
                        </Txt>
                      </View>
                      <Stepper
                        testID={`booking-preorder-${d.id}`}
                        size="s"
                        value={preorder[d.id] ?? 0}
                        onInc={() => setPreorder((p) => ({ ...p, [d.id]: (p[d.id] ?? 0) + 1 }))}
                        onDec={() => setPreorder((p) => ({ ...p, [d.id]: Math.max(0, (p[d.id] ?? 0) - 1) }))}
                      />
                    </View>
                  ))}
                  {preorderItems.length ? (
                    <Txt v="label" color="textSecondary">
                      Предзаказ: {rub(preorderTotal)} · оплатите в ресторане
                    </Txt>
                  ) : null}
                </Animated.View>
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline }}>
        <Button
          testID="booking-submit"
          full
          loading={submitting}
          disabled={!time || !tableId}
          title={time ? `Забронировать на ${time}` : 'Выберите время'}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

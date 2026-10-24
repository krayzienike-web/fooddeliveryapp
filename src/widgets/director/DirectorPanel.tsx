import { ScrollView, View } from 'react-native';
import { navigationRef } from '@/app/navigation/ref';
import { useMenu } from '@/entities/dish/model/store';
import { useActiveOrder, useOrders } from '@/entities/order/model/store';
import type { IncidentKind } from '@/entities/order/model/types';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { useDirector } from '@/features/director/model/store';
import { useTaste } from '@/features/recommendations/model/store';
import { api } from '@/services';
import { haptic } from '@/shared/lib/haptics';
import { space, useThemeStore } from '@/shared/theme';
import { Button, Chip, Sheet, Txt, toast } from '@/shared/ui';

const INCIDENTS: Array<{ kind: IncidentKind; label: string }> = [
  { kind: 'stop_list', label: 'Блюдо закончилось' },
  { kind: 'kitchen_delay', label: 'Кухня задерживается' },
  { kind: 'courier_delay', label: 'Пробка у курьера' },
  { kind: 'payment_failed', label: 'Оплата не прошла' },
  { kind: 'cold_risk', label: 'Может остыть' },
  { kind: 'not_confirmed', label: '«Всё получили?»' },
];
const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/**
 * «Панель режиссёра» (D0): hidden presenter controls — open with a triple tap on the logo.
 * Lets the demo show incidents, time-of-day/weather context and predictions on cue.
 */
export function DirectorPanel() {
  const d = useDirector();
  const active = useActiveOrder();
  const upsert = useOrders((s) => s.upsert);
  const loadOrders = useOrders((s) => s.load);
  const setMode = useThemeStore((s) => s.setMode);
  const themeMode = useThemeStore((s) => s.mode);
  const resetTaste = useTaste((s) => s.reset);
  const clearCart = useCart((s) => s.clear);
  const setOnboarded = useSession((s) => s.setOnboarded);
  const logout = useSession((s) => s.logout);
  const stopList = useMenu((s) => s.stopList);

  const fire = async (kind: IncidentKind) => {
    if (!active) {
      toast('Сначала оформите заказ — инциденты привязываются к активному заказу', { icon: 'information-outline' });
      return;
    }
    const inc = await api.director.triggerIncident(active.id, kind);
    if (!inc) {
      toast('Лимит: не больше 2 проактивных сообщений на заказ', { icon: 'shield-check-outline' });
      return;
    }
    const o = await api.orders.get(active.id);
    upsert(o);
    haptic.tick();
    d.setOpen(false);
  };

  return (
    <Sheet open={d.open} onClose={() => d.setOpen(false)} title="Панель режиссёра" testID="director-panel">
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.l, paddingBottom: space.l }}>
        <View style={{ gap: space.s }}>
          <Txt v="label" color="textTertiary" upper>
            Инциденты (превентивная поддержка)
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {INCIDENTS.map((i) => (
              <Chip key={i.kind} testID={`director-incident-${i.kind}`} label={i.label} onPress={() => fire(i.kind)} />
            ))}
          </View>
          <Txt v="caption" color="textTertiary">
            {active ? `Активный заказ №${active.number}` : 'Нет активного заказа'}
          </Txt>
        </View>

        <View style={{ gap: space.s }}>
          <Txt v="label" color="textTertiary" upper>
            Контекст: день и время
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            <Chip small label="Сейчас" selected={d.weekday === undefined} onPress={() => d.setTime(undefined, undefined)} />
            {DAYS.map((name, i) => (
              <Chip key={name} small testID={`director-day-${i}`} label={name} selected={d.weekday === i} onPress={() => d.setTime(i, d.hour ?? 19)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {[9, 13, 19, 23].map((h) => (
              <Chip key={h} small testID={`director-hour-${h}`} label={`${h}:00`} selected={d.hour === h} onPress={() => d.setTime(d.weekday ?? new Date().getDay(), h)} />
            ))}
          </View>
          <Button kind="tonal" size="m" icon="calendar-star" title="Пятница, 19:00 — «как обычно»" testID="director-friday" onPress={() => d.setTime(5, 19)} />
        </View>

        <View style={{ gap: space.s }}>
          <Txt v="label" color="textTertiary" upper>
            Погода и место
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {(['clear', 'rain', 'snow', 'storm'] as const).map((w) => (
              <Chip key={w} small testID={`director-weather-${w}`} label={{ clear: 'Ясно', rain: 'Дождь', snow: 'Снег', storm: 'Ливень' }[w]} selected={d.weather === w} onPress={() => d.setWeather(w)} />
            ))}
            <Chip small testID="director-near" icon="map-marker-radius" label="Рядом с рестораном" selected={d.nearRestaurant} onPress={() => d.setNearRestaurant(!d.nearRestaurant)} />
          </View>
        </View>

        <View style={{ gap: space.s }}>
          <Txt v="label" color="textTertiary" upper>
            Скорость заказа
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            {[1, 2, 4, 8].map((x) => (
              <Chip
                key={x}
                small
                testID={`director-speed-${x}`}
                label={`×${x}`}
                selected={d.speed === x}
                onPress={() => {
                  d.setSpeed(x);
                  api.director.setSpeed(x);
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: space.s }}>
          <Txt v="label" color="textTertiary" upper>
            Тема
          </Txt>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            {(['dark', 'light', 'system'] as const).map((m) => (
              <Chip key={m} small label={{ dark: 'Тёмная', light: 'Светлая', system: 'Системная' }[m]} selected={themeMode === m} onPress={() => setMode(m)} />
            ))}
          </View>
        </View>

        <Button
          testID="director-reset"
          kind="outline"
          icon="restart"
          title="Сбросить демо"
          onPress={async () => {
            await api.director.reset();
            await loadOrders();
            resetTaste();
            clearCart();
            logout();
            setOnboarded(false);
            d.reset();
            d.setOpen(false);
            if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
            toast('Демо сброшено — начните с онбординга', { icon: 'restart' });
          }}
        />
        <Txt v="caption" color="textTertiary">
          Стоп-лист: {stopList.length ? stopList.join(', ') : 'пуст'}
        </Txt>
      </ScrollView>
    </Sheet>
  );
}

import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useMenu } from '@/entities/dish/model/store';
import { useOrders } from '@/entities/order/model/store';
import type { Incident, Order } from '@/entities/order/model/types';
import { useSession } from '@/features/auth/model/store';
import { useApi } from '@/services';
import { points } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, FoodImage, Icon, PressableScale, Txt, toast } from '@/shared/ui';

/**
 * Preventive support (D1): we tell the guest first, offer choices, and the compensation
 * is already credited — no need to ask.
 */
export function IncidentCard({ order, incident }: { order: Order; incident: Incident }) {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const upsert = useOrders((s) => s.upsert);
  const refresh = useSession((s) => s.refreshUser);
  const byId = useMenu((s) => s.byId);
  const [busy, setBusy] = useState<string | null>(null);
  const [replacement, setReplacement] = useState(incident.replacementDishIds?.[0]);
  const resolved = !!incident.resolvedWith;

  const choose = async (id: string, kind: string) => {
    if (kind === 'support') {
      nav.navigate('Support', { orderId: order.id });
      return;
    }
    setBusy(id);
    try {
      const o = await api.orders.resolveIncident(order.id, incident.id, id);
      upsert(o);
      refresh();
      haptic.confirm();
      if (kind === 'cancel') toast('Заказ отменён, деньги вернутся на карту', { icon: 'check-circle', tone: 'success' });
      else if (kind === 'replace') toast('Заменили — за наш счёт', { icon: 'swap-horizontal', tone: 'success' });
      else if (kind === 'refund_item') toast('Вернули деньги за позицию', { icon: 'cash-refund', tone: 'success' });
      else if (kind === 'switch_pickup') toast('Готовим к самовывозу', { icon: 'walk', tone: 'success' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Animated.View testID="order-incident-card" entering={FadeInDown.springify().stiffness(380).damping(33)} layout={LinearTransition} style={{ borderRadius: radius.l, backgroundColor: c.surface, borderWidth: 1, borderColor: resolved ? c.outline : c.warning, padding: space.l, gap: space.m }}>
      <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={resolved ? 'check' : incident.kind === 'payment_failed' ? 'credit-card-off-outline' : incident.kind === 'stop_list' ? 'food-off-outline' : incident.kind === 'weather_load' ? 'weather-pouring' : 'clock-alert-outline'} color={resolved ? 'success' : 'warning'} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="titleM">{incident.title}</Txt>
          <Txt v="bodyM" color="textSecondary">
            {incident.message}
          </Txt>
        </View>
      </View>
      {incident.compensationPoints ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, alignSelf: 'flex-start', paddingHorizontal: space.m, height: 32, borderRadius: radius.full, backgroundColor: c.goldTonal }}>
          <Icon name="star-four-points" size={16} color="gold" />
          <Txt v="label" color="gold">
            +{points(incident.compensationPoints)} уже на счёте
          </Txt>
        </View>
      ) : null}
      {incident.kind === 'stop_list' && incident.replacementDishIds?.length && !resolved ? (
        <View style={{ flexDirection: 'row', gap: space.s }}>
          {incident.replacementDishIds.map((id) => {
            const d = byId[id];
            if (!d) return null;
            const on = replacement === id;
            return (
              <PressableScale key={id} onPress={() => setReplacement(id)} accessibilityState={{ selected: on }} style={{ flex: 1, gap: space.xs }}>
                <FoodImage id={d.image} small style={{ width: '100%', aspectRatio: 1, borderRadius: radius.s, borderWidth: 2, borderColor: on ? c.accent : 'transparent' }} />
                <Txt v="caption" numberOfLines={2}>
                  {d.name}
                </Txt>
              </PressableScale>
            );
          })}
        </View>
      ) : null}
      {resolved ? (
        <Txt v="caption" color="success">
          Решено · {incident.resolutions.find((r) => r.id === incident.resolvedWith)?.title}
        </Txt>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
          {incident.resolutions.map((r, i) => (
            <Button key={r.id} testID={`order-incident-resolution-${r.id}`} size="m" kind={i === 0 ? 'tonal' : 'outline'} title={r.title} loading={busy === r.id} onPress={() => choose(r.id, r.kind)} style={{ flexGrow: 1 }} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

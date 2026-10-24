import { useNavigation } from '@react-navigation/native';
import { View } from 'react-native';
import { statusProgress, STATUS_TITLE } from '@/entities/order/model/lifecycle';
import type { Order } from '@/entities/order/model/types';
import { etaWindow } from '@/shared/lib/format';
import { radius, space, useTheme } from '@/shared/theme';
import { Icon, PressableScale, Txt } from '@/shared/ui';
import { statusIcon } from './statusIcon';

/** Compact tracking card on the home screen (guidebook §3.2 item 2). */
export function ActiveOrderCard({ order }: { order: Order }) {
  const { c } = useTheme();
  const nav = useNavigation();
  const p = statusProgress(order.mode, order.status);
  const incident = order.incidents.find((i) => !i.resolvedWith);
  return (
    <PressableScale testID="home-active-order" onPress={() => nav.navigate('Order', { id: order.id })} pressedScale={0.98} style={{ marginHorizontal: space.l }}>
      <View style={{ borderRadius: radius.l, backgroundColor: c.surface, padding: space.l, gap: space.m, borderWidth: 1, borderColor: incident ? c.warning : c.outline }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accentTonal, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={statusIcon(order.status)} size={22} color="accent" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="titleM">{STATUS_TITLE[order.status]}</Txt>
            <Txt v="caption" color="textSecondary">
              {incident ? incident.title : order.mode === 'pickup' ? `Будет готов к ${etaWindow(order.etaFrom, order.etaTo).split('–')[1]}` : `Привезём ${etaWindow(order.etaFrom, order.etaTo)}`}
            </Txt>
          </View>
          <Icon name="chevron-right" color="textTertiary" />
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surfaceHigh, overflow: 'hidden' }}>
          <View style={{ width: `${Math.max(6, p * 100)}%`, height: 4, backgroundColor: c.accent }} />
        </View>
      </View>
    </PressableScale>
  );
}

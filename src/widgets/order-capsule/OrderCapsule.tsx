import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '@/app/navigation/ref';
import { STATUS_SHORT, STATUS_TITLE } from '@/entities/order/model/lifecycle';
import { useActiveOrder } from '@/entities/order/model/store';
import { haptic } from '@/shared/lib/haptics';
import { hhmm } from '@/shared/lib/format';
import { elevation, space, useTheme } from '@/shared/theme';
import { Icon, PressableScale, Txt } from '@/shared/ui';
import { statusIcon } from './statusIcon';

/** Screens where the capsule would compete with the task at hand (guidebook §3.8). */
const HIDDEN_ON = new Set(['Order', 'Checkout', 'Reels', 'Onboarding', 'AR', 'Auth', 'Dish', 'Wheel']);

/** Current leaf route name, tracked from the container (the capsule lives outside any navigator). */
function useCurrentRouteName(): string | undefined {
  const [name, setName] = useState<string | undefined>(() => (navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined));
  useEffect(() => {
    const update = () => setName(navigationRef.getCurrentRoute()?.name);
    update();
    return navigationRef.addListener('state', update);
  }, []);
  return name;
}

/**
 * Dynamic-Island-style status capsule (C5): visible from any screen while an order is live.
 * Only animates on a status change (one spring), then stays still.
 */
export function OrderCapsule() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const order = useActiveOrder();
  const routeName = useCurrentRouteName();
  const [expanded, setExpanded] = useState(false);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!order) return;
    haptic.tick();
    pulse.value = withSequence(withTiming(1.06, { duration: 140 }), withTiming(1, { duration: 200 }));
    setExpanded(true);
    const t = setTimeout(() => setExpanded(false), 3200);
    return () => clearTimeout(t);
  }, [order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const dot = useSharedValue(1);
  useEffect(() => {
    dot.value = withRepeat(withSequence(withTiming(0.3, { duration: 900 }), withTiming(1, { duration: 900 })), -1);
  }, [dot]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  if (!order || (routeName && HIDDEN_ON.has(routeName))) return null;
  const incident = order.incidents.find((i) => !i.resolvedWith);
  const eta = order.status === 'delivered' || order.status === 'picked_up' ? 'Готово' : order.mode === 'pickup' && order.status === 'ready_for_pickup' ? `Полка ${order.pickupShelf}` : `~${hhmm(order.etaTo)}`;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 0, right: 0, alignItems: 'center', zIndex: 500 }}>
      <Animated.View entering={FadeInUp.springify().stiffness(380).damping(33)} exiting={FadeOutUp} layout={LinearTransition.springify().stiffness(380).damping(33)} style={a}>
        <PressableScale testID="order-capsule" onPress={() => navigationRef.isReady() && navigationRef.navigate('Order', { id: order.id })} pressedScale={0.96} accessibilityLabel={`Заказ: ${STATUS_TITLE[order.status]}`}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: c.island, borderRadius: 999, paddingLeft: 6, paddingRight: space.l, height: expanded ? 52 : 40, minWidth: expanded ? 280 : 168 }, elevation.float]}>
            <View style={{ width: expanded ? 40 : 28, height: expanded ? 40 : 28, borderRadius: 20, backgroundColor: incident ? c.warning : c.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={statusIcon(order.status)} size={expanded ? 22 : 16} raw={c.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt testID="order-capsule-status" v={expanded ? 'label' : 'caption'} style={{ color: c.onPhoto }} numberOfLines={1}>
                {incident ? incident.title : expanded ? STATUS_TITLE[order.status] : STATUS_SHORT[order.status]}
              </Txt>
              {expanded ? (
                <Txt v="caption" style={{ color: c.onPhoto, opacity: 0.7 }} numberOfLines={1}>
                  Заказ №{order.number}
                </Txt>
              ) : null}
            </View>
            <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success }, dotStyle]} />
            <Txt v="label" style={{ color: c.onPhoto }} tabular>
              {eta}
            </Txt>
          </View>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

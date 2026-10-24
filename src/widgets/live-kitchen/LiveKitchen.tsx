import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useMenu } from '@/entities/dish/model/store';
import type { Order } from '@/entities/order/model/types';
import { radius, space, useTheme } from '@/shared/theme';
import { FoodImage, Icon, type IconName, Txt } from '@/shared/ui';

const STAGES: Array<{ title: string; icon: IconName; img: string }> = [
  { title: 'Нарезка и заготовки', icon: 'knife', img: 'kitchen-3' },
  { title: 'Огонь и гриль', icon: 'fire', img: 'kitchen-1' },
  { title: 'Сборка и подача', icon: 'chef-hat', img: 'kitchen-2' },
];

/**
 * «Живая кухня» (C4): who cooks your order and what's happening right now.
 * At packing we show the "photo of your order" with a QC stamp.
 */
export function LiveKitchen({ order }: { order: Order }) {
  const { c } = useTheme();
  const byId = useMenu((s) => s.byId);
  const [stage, setStage] = useState(0);
  const cooking = order.status === 'cooking' || order.status === 'accepted' || order.status === 'created';
  useEffect(() => {
    if (!cooking) return;
    const t = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 4200);
    return () => clearInterval(t);
  }, [cooking]);
  const glow = useSharedValue(0.6);
  useEffect(() => {
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0.6, { duration: 1000 })), -1);
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const main = byId[order.lines[0]?.dishId];
  const packing = order.status === 'packing' || order.status === 'courier_assigned' || order.status === 'ready_for_pickup';
  const s = STAGES[stage];
  return (
    <View testID="order-kitchen-live" style={{ borderRadius: radius.l, overflow: 'hidden', backgroundColor: c.surface }}>
      <View style={{ height: 190 }}>
        {packing && main ? (
          <Animated.View key="qc" entering={FadeIn.duration(400)} style={{ flex: 1 }}>
            <FoodImage id={main.image} style={{ width: '100%', height: 190 }} />
            <View style={{ position: 'absolute', right: space.l, bottom: space.l, transform: [{ rotate: '-8deg' }], borderWidth: 2, borderColor: c.success, borderRadius: radius.s, paddingHorizontal: space.m, paddingVertical: space.xs, backgroundColor: c.scrim }}>
              <Txt v="label" color="success" upper>
                Проверено шефом
              </Txt>
            </View>
          </Animated.View>
        ) : (
          <Animated.View key={s.img} entering={FadeIn.duration(500)} exiting={FadeOut.duration(300)} style={{ flex: 1 }}>
            <FoodImage id={s.img} style={{ width: '100%', height: 190 }} />
          </Animated.View>
        )}
        <View style={{ position: 'absolute', left: space.m, top: space.m, flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, height: 32, borderRadius: radius.full, backgroundColor: c.scrim }}>
          <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.error }, glowStyle]} />
          <Txt v="caption" style={{ color: c.onPhoto }}>
            {packing ? 'Фото вашего заказа' : 'Кухня сейчас'}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.accentTonal, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="titleM" color="accent">
            {order.chef.avatar}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt testID="order-chef" v="titleM">
            Готовит шеф {order.chef.name} · {order.chef.rating.toFixed(1)}★
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Icon name={packing ? 'package-variant-closed' : s.icon} size={16} color="textSecondary" />
            <Txt v="caption" color="textSecondary">
              {packing ? 'Упаковываем, чтобы доехало горячим' : s.title}
            </Txt>
          </View>
        </View>
      </View>
    </View>
  );
}

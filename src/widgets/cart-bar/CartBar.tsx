import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useCart, useCartCount } from '@/features/cart/model/store';
import { useCartTotals } from '@/features/cart/model/useTotals';
import { rub } from '@/shared/lib/format';
import { elevation, motion, radius, space, useTheme } from '@/shared/theme';
import { Icon, PressableScale, Txt } from '@/shared/ui';

/**
 * Floating cart bar (guidebook §3.6): count, ETA hint and total. The counter bumps on every add;
 * the bar itself is the fly-to-cart target.
 */
export function CartBar({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const { c } = useTheme();
  const nav = useNavigation();
  const count = useCartCount();
  const totals = useCartTotals();
  const lastAdded = useCart((s) => s.lastAdded);
  const mode = useCart((s) => s.mode);
  const bump = useSharedValue(1);

  useEffect(() => {
    if (!lastAdded) return;
    bump.value = withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, motion.springExpressive));
  }, [lastAdded, bump]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  if (count === 0) return null;
  const hint = mode === 'pickup' ? 'Самовывоз · −10%' : totals.toFreeDelivery > 0 ? `До бесплатной доставки ${rub(totals.toFreeDelivery)}` : 'Доставка бесплатно';
  return (
    <Animated.View entering={FadeInDown.springify().stiffness(380).damping(33)} exiting={FadeOutDown.duration(160)} style={{ paddingHorizontal: space.l, marginBottom: space.s + bottomOffset }}>
      <Animated.View style={a}>
        <PressableScale testID="cart-bar-open" onPress={() => nav.navigate('Cart')} accessibilityLabel={`Корзина, ${count} позиций, ${rub(totals.total)}`} pressedScale={0.98}>
          <View testID="cart-bar" style={[{ flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: radius.full, backgroundColor: c.accent, paddingHorizontal: space.s, gap: space.m }, elevation.float]}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.onAccent, alignItems: 'center', justifyContent: 'center' }}>
              <Txt v="titleM" style={{ color: c.accent }} tabular>
                {count}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="titleM" style={{ color: c.onAccent }}>
                Корзина
              </Txt>
              <Txt v="caption" style={{ color: c.onAccent, opacity: 0.8 }} numberOfLines={1}>
                {hint}
              </Txt>
            </View>
            <Txt testID="cart-bar-total" v="priceM" style={{ color: c.onAccent, marginRight: space.s }}>
              {rub(totals.total)}
            </Txt>
            <Icon name="chevron-right" raw={c.onAccent} />
          </View>
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}

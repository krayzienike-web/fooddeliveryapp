import { useMemo } from 'react';
import { calcTotals } from '@/entities/cart/model/pricing';
import { useMenu } from '@/entities/dish/model/store';
import { levelFor } from '@/entities/user/model/loyalty';
import { useSession } from '@/features/auth/model/store';
import { useDirector } from '@/features/director/model/store';
import { useCart } from './store';

/** Surge fee when the director turns on rain/storm (D1 «weather_load»). */
export function useDeliveryFeeOverride(): number | undefined {
  const weather = useDirector((s) => s.weather);
  return weather === 'storm' || weather === 'rain' ? 249 : undefined;
}

export function useCartTotals() {
  const cart = useCart();
  const byId = useMenu((s) => s.byId);
  const modifiers = useMenu((s) => s.modifiers);
  const user = useSession((s) => s.user);
  const fee = useDeliveryFeeOverride();
  return useMemo(
    () =>
      calcTotals({
        lines: cart.lines.filter((l) => byId[l.dishId]),
        dishes: byId,
        modifiers,
        mode: cart.mode,
        promo: cart.promo,
        pointsToSpend: cart.pointsToSpend,
        availablePoints: user?.points ?? 0,
        tips: cart.tips,
        cashbackPercent: levelFor(user?.levelSpend ?? 0).cashback,
        deliveryFeeOverride: fee,
      }),
    [cart.lines, cart.mode, cart.promo, cart.pointsToSpend, cart.tips, byId, modifiers, user?.points, user?.levelSpend, fee],
  );
}

import { PRICING, linePrice } from '@/entities/cart/model/pricing';
import { useMenu } from '@/entities/dish/model/store';
import { STATUS_TITLE, isFinal } from '@/entities/order/model/lifecycle';
import { useOrders } from '@/entities/order/model/store';
import type { Order } from '@/entities/order/model/types';
import type { Restaurant } from '@/entities/restaurant/model/types';
import { LOYALTY_LEVELS } from '@/entities/user/model/loyalty';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { directorNow, useDirector } from '@/features/director/model/store';
import { rankDishes } from '@/features/recommendations/model/engine';
import { useTaste } from '@/features/recommendations/model/store';
import { etaWindow } from '@/shared/lib/format';
import type { AssistantContext } from './protocol';

const WEATHER: Record<string, string> = { clear: 'ясно', rain: 'дождь', storm: 'ливень', cold: 'холодно', hot: 'жарко', snow: 'снег' };
const DIET: Record<string, string> = { none: 'без ограничений', pp: 'ПП', gluten_free: 'без глютена', halal: 'халяль', veg: 'вегетарианская' };

/** The guest's most repeated order (same dishes 2+ times), e.g. the Friday ritual. */
export function usualOrder(orders: Order[]): Array<{ dishId: string; qty: number }> | undefined {
  const counts = new Map<string, { n: number; items: Array<{ dishId: string; qty: number }> }>();
  for (const o of orders) {
    if (o.status !== 'delivered' && o.status !== 'picked_up') continue;
    const items = o.lines.map((l) => ({ dishId: l.dishId, qty: l.qty })).sort((a, b) => a.dishId.localeCompare(b.dishId));
    const key = items.map((i) => `${i.dishId}×${i.qty}`).join(',');
    const prev = counts.get(key);
    counts.set(key, { n: (prev?.n ?? 0) + 1, items });
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return best && best.n >= 2 ? best.items : undefined;
}

/** Snapshot of everything the assistant may know about this guest right now. */
export function snapshotContext(restaurants: Restaurant[]): AssistantContext {
  const menu = useMenu.getState();
  const cart = useCart.getState();
  const user = useSession.getState().user;
  const taste = useTaste.getState();
  const director = useDirector.getState();
  const ordersState = useOrders.getState();
  const nowMs = directorNow(director);
  const now = new Date(nowMs);
  const dishes = Object.values(menu.byId);
  const diet = user?.diet ?? 'none';
  const ranked = rankDishes(dishes, { profile: taste.profile, diet, ctx: { hour: now.getHours(), weekday: now.getDay(), weather: director.weather }, exploration: 0 });
  const active = ordersState.orders.find((o) => o.id === ordersState.activeId && !isFinal(o.status));
  const level = LOYALTY_LEVELS.find((l) => l.id === user?.level);
  return {
    dishes,
    ranked,
    stopList: menu.stopList,
    restaurants,
    cart: cart.lines.map((l) => ({ dishId: l.dishId, qty: l.qty })),
    cartTotal: cart.lines.reduce((s, l) => s + (menu.byId[l.dishId] ? linePrice(l, menu.byId, menu.modifiers) : 0), 0),
    order: active ? { id: active.id, statusTitle: STATUS_TITLE[active.status], eta: etaWindow(active.etaFrom, active.etaTo), isPickup: active.mode === 'pickup' } : undefined,
    user: user ? { name: user.name, points: user.points, levelTitle: level?.title ?? '', diet: DIET[diet] ?? diet } : undefined,
    usual: usualOrder(ordersState.orders),
    now,
    weather: WEATHER[director.weather] ?? director.weather,
    freeDeliveryFrom: PRICING.freeDeliveryFrom,
    deliveryFee: PRICING.deliveryFee,
  };
}

import type { FulfillmentMode } from '@/entities/cart/model/types';
import type { GeoPoint, OrderStatus } from './types';

export const DELIVERY_FLOW: OrderStatus[] = ['created', 'accepted', 'cooking', 'packing', 'courier_assigned', 'on_the_way', 'arriving', 'delivered'];
export const PICKUP_FLOW: OrderStatus[] = ['created', 'accepted', 'cooking', 'packing', 'ready_for_pickup', 'picked_up'];

export const STATUS_TITLE: Record<OrderStatus, string> = {
  created: 'Заказ создан',
  accepted: 'Ресторан принял заказ',
  cooking: 'Готовим',
  packing: 'Упаковываем',
  courier_assigned: 'Курьер забирает заказ',
  on_the_way: 'Курьер в пути',
  arriving: 'Курьер подъезжает',
  delivered: 'Доставлено',
  ready_for_pickup: 'Готов к выдаче',
  picked_up: 'Получен',
  cancelled: 'Отменён',
};

/** Short label for the Dynamic-Island-style capsule. */
export const STATUS_SHORT: Record<OrderStatus, string> = {
  created: 'Создан',
  accepted: 'Принят',
  cooking: 'Готовим',
  packing: 'Упаковка',
  courier_assigned: 'Курьер',
  on_the_way: 'В пути',
  arriving: 'Уже рядом',
  delivered: 'Доставлен',
  ready_for_pickup: 'Готов',
  picked_up: 'Получен',
  cancelled: 'Отменён',
};

export function flowFor(mode: FulfillmentMode): OrderStatus[] {
  return mode === 'delivery' ? DELIVERY_FLOW : PICKUP_FLOW;
}

export function isFinal(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'picked_up' || status === 'cancelled';
}

export function nextStatus(mode: FulfillmentMode, status: OrderStatus): OrderStatus | null {
  if (isFinal(status)) return null;
  const flow = flowFor(mode);
  const i = flow.indexOf(status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

/** 0..1 progress of the whole order, used by the progress ring. */
export function statusProgress(mode: FulfillmentMode, status: OrderStatus): number {
  if (status === 'cancelled') return 0;
  const flow = flowFor(mode);
  const i = flow.indexOf(status);
  return i < 0 ? 0 : i / (flow.length - 1);
}

export function canCancel(status: OrderStatus): boolean {
  return status === 'created' || status === 'accepted';
}

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function routeLength(route: GeoPoint[]): number {
  let len = 0;
  for (let i = 1; i < route.length; i++) len += distanceMeters(route[i - 1], route[i]);
  return len;
}

/** Point at fraction t (0..1) of the route length, plus heading in degrees. */
export function pointAlong(route: GeoPoint[], t: number): { point: GeoPoint; heading: number } {
  if (route.length === 0) return { point: { lat: 0, lng: 0 }, heading: 0 };
  if (route.length === 1) return { point: route[0], heading: 0 };
  const total = routeLength(route);
  let target = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const seg = distanceMeters(a, b);
    if (target <= seg || i === route.length - 1) {
      const f = seg === 0 ? 0 : Math.min(target / seg, 1);
      const heading = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
      return { point: { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }, heading };
    }
    target -= seg;
  }
  return { point: route[route.length - 1], heading: 0 };
}

/** Courier ETA in minutes for the remaining part of the route. Avg city speed ~ 18 km/h on a bike. */
export function remainingMinutes(route: GeoPoint[], progress: number, speedKmh = 18): number {
  const remaining = routeLength(route) * (1 - Math.min(Math.max(progress, 0), 1));
  return Math.max(1, Math.round(remaining / 1000 / speedKmh * 60));
}

import {
  DELIVERY_FLOW, PICKUP_FLOW, STATUS_SHORT, STATUS_TITLE, canCancel, distanceMeters, flowFor, isFinal, nextStatus,
  pointAlong, remainingMinutes, routeLength, statusProgress,
} from '@/entities/order/model/lifecycle';
import type { GeoPoint, OrderStatus } from '@/entities/order/model/types';

const ALL: OrderStatus[] = ['created', 'accepted', 'cooking', 'packing', 'courier_assigned', 'on_the_way', 'arriving', 'delivered', 'ready_for_pickup', 'picked_up', 'cancelled'];

describe('flows', () => {
  it('delivery and pickup flows start at created and end in a final status', () => {
    for (const flow of [DELIVERY_FLOW, PICKUP_FLOW]) {
      expect(flow[0]).toBe('created');
      expect(isFinal(flow[flow.length - 1])).toBe(true);
      expect(new Set(flow).size).toBe(flow.length);
    }
    expect(flowFor('delivery')).toBe(DELIVERY_FLOW);
    expect(flowFor('pickup')).toBe(PICKUP_FLOW);
  });
  it('pickup flow never involves a courier', () => {
    expect(PICKUP_FLOW).not.toEqual(expect.arrayContaining(['courier_assigned']));
    expect(PICKUP_FLOW.some((s) => ['courier_assigned', 'on_the_way', 'arriving', 'delivered'].includes(s))).toBe(false);
  });
  it('every status has a full and a short Russian title', () => {
    for (const s of ALL) {
      expect(STATUS_TITLE[s]).toMatch(/[а-яё]/i);
      expect(STATUS_SHORT[s]).toMatch(/[а-яё]/i);
      expect(STATUS_SHORT[s].length).toBeLessThanOrEqual(12);
    }
  });
});

describe('nextStatus / isFinal', () => {
  it('walks the delivery flow step by step to delivered', () => {
    let s: OrderStatus | null = 'created';
    const seen: OrderStatus[] = [];
    while (s) { seen.push(s); s = nextStatus('delivery', s); }
    expect(seen).toEqual(DELIVERY_FLOW);
  });
  it('walks the pickup flow to picked_up', () => {
    let s: OrderStatus | null = 'created';
    const seen: OrderStatus[] = [];
    while (s) { seen.push(s); s = nextStatus('pickup', s); }
    expect(seen).toEqual(PICKUP_FLOW);
  });
  it('final statuses have no next', () => {
    expect(isFinal('delivered')).toBe(true);
    expect(isFinal('picked_up')).toBe(true);
    expect(isFinal('cancelled')).toBe(true);
    expect(nextStatus('delivery', 'cancelled')).toBeNull();
    expect(nextStatus('delivery', 'delivered')).toBeNull();
    expect(ALL.filter(isFinal)).toHaveLength(3);
  });
  it('status not in the mode flow → null', () => {
    expect(nextStatus('delivery', 'ready_for_pickup')).toBeNull();
    expect(nextStatus('pickup', 'on_the_way')).toBeNull();
  });
  it('can cancel only before cooking', () => {
    expect(ALL.filter(canCancel)).toEqual(['created', 'accepted']);
  });
});

describe('statusProgress', () => {
  it('is 0 at created, 1 at the final step, monotonic in between', () => {
    for (const mode of ['delivery', 'pickup'] as const) {
      const flow = flowFor(mode);
      const ps = flow.map((s) => statusProgress(mode, s));
      expect(ps[0]).toBe(0);
      expect(ps[ps.length - 1]).toBe(1);
      for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThan(ps[i - 1]);
    }
  });
  it('cancelled and foreign statuses → 0', () => {
    expect(statusProgress('delivery', 'cancelled')).toBe(0);
    expect(statusProgress('pickup', 'on_the_way')).toBe(0);
  });
});

describe('geo helpers', () => {
  // ~1.11 km per 0.01° of latitude
  const A: GeoPoint = { lat: 59.93, lng: 30.31 };
  const B: GeoPoint = { lat: 59.94, lng: 30.31 };
  const C: GeoPoint = { lat: 59.94, lng: 30.33 };

  it('distanceMeters ≈ haversine', () => {
    expect(distanceMeters(A, A)).toBe(0);
    expect(distanceMeters(A, B)).toBeGreaterThan(1100);
    expect(distanceMeters(A, B)).toBeLessThan(1125);
    expect(distanceMeters(A, B)).toBeCloseTo(distanceMeters(B, A), 6);
  });
  it('routeLength sums segments; trivial routes → 0', () => {
    expect(routeLength([])).toBe(0);
    expect(routeLength([A])).toBe(0);
    expect(routeLength([A, B, C])).toBeCloseTo(distanceMeters(A, B) + distanceMeters(B, C), 6);
  });
  it('pointAlong returns endpoints at t=0/1 and clamps t', () => {
    const r = [A, B, C];
    expect(pointAlong(r, 0).point).toEqual(A);
    const end = pointAlong(r, 1).point;
    expect(end.lat).toBeCloseTo(C.lat, 9);
    expect(end.lng).toBeCloseTo(C.lng, 9);
    expect(pointAlong(r, -1).point).toEqual(A);
    expect(pointAlong(r, 2).point.lng).toBeCloseTo(C.lng, 9);
  });
  it('pointAlong interpolates by distance and gives heading (0 = north, 90 = east)', () => {
    const mid = pointAlong([A, B], 0.5);
    expect(mid.point.lat).toBeCloseTo(59.935, 6);
    expect(mid.heading).toBeCloseTo(0, 6);
    expect(pointAlong([B, C], 0.5).heading).toBeCloseTo(90, 6);
    // first leg is ~1.11 km, second ~1.11 km (0.02° lng at 60°N) → 0.75 lies on the second leg
    const p = pointAlong([A, B, C], 0.75);
    expect(p.point.lat).toBeCloseTo(B.lat, 9);
    expect(p.point.lng).toBeGreaterThan(B.lng);
  });
  it('pointAlong handles degenerate routes', () => {
    expect(pointAlong([], 0.5)).toEqual({ point: { lat: 0, lng: 0 }, heading: 0 });
    expect(pointAlong([A], 0.5)).toEqual({ point: A, heading: 0 });
  });
  it('remainingMinutes decreases with progress, min 1, uses speed', () => {
    const r = [A, B]; // ~1.11 km → ~4 min at 18 km/h
    expect(remainingMinutes(r, 0)).toBe(4);
    expect(remainingMinutes(r, 0, 9)).toBe(7);
    expect(remainingMinutes(r, 0.5)).toBe(2);
    expect(remainingMinutes(r, 1)).toBe(1);
    expect(remainingMinutes(r, 5)).toBe(1);
    expect(remainingMinutes(r, -3)).toBe(4);
  });
});

import {
  MAX_PROACTIVE_MESSAGES_PER_ORDER, buildIncident, compensationFor, detectIncidents, lateMinutes, shouldNotify, type LiveSignals,
} from '@/entities/order/model/incidents';
import type { IncidentKind } from '@/entities/order/model/types';
import { MIN, makeIncident, makeLine, makeOrder } from '../fixtures';

const ALL_KINDS: IncidentKind[] = ['stop_list', 'kitchen_delay', 'courier_delay', 'weather_load', 'payment_failed', 'cold_risk', 'restaurant_overload', 'not_confirmed'];

const order = makeOrder({ createdAt: 0, etaFrom: 30 * MIN, etaTo: 45 * MIN, lines: [makeLine({ dishId: 'pz' }), makeLine({ dishId: 'cola' })] });
const calm = (over: Partial<LiveSignals> = {}): LiveSignals => ({
  now: 10 * MIN, predictedEta: 40 * MIN, outOfStockDishIds: [], paymentFailed: false, weather: 'clear',
  courierStuckMinutes: 0, minutesSinceHandoffUnconfirmed: 0, ...over,
});

describe('compensation ladder', () => {
  it.each([
    [0, 0], [9, 0], [10, 150], [19, 150], [20, 300], [29, 300], [30, 500], [90, 500],
  ])('delay %i min → %i points (kitchen & courier)', (delay, pts) => {
    expect(compensationFor('kitchen_delay', delay)).toBe(pts);
    expect(compensationFor('courier_delay', delay)).toBe(pts);
  });
  it('fixed gestures for other kinds', () => {
    expect(compensationFor('stop_list')).toBe(100);
    expect(compensationFor('cold_risk')).toBe(200);
    for (const k of ['weather_load', 'payment_failed', 'restaurant_overload', 'not_confirmed'] as const) expect(compensationFor(k)).toBe(0);
  });
  it('ladder is monotonic', () => {
    let prev = -1;
    for (let d = 0; d <= 60; d++) {
      const p = compensationFor('courier_delay', d);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe('lateMinutes', () => {
  it('rounds positive lateness against etaTo, never negative', () => {
    expect(lateMinutes({ etaTo: 45 * MIN }, 40 * MIN)).toBe(0);
    expect(lateMinutes({ etaTo: 45 * MIN }, 57 * MIN)).toBe(12);
    expect(lateMinutes({ etaTo: 45 * MIN }, 45 * MIN + 29_000)).toBe(0);
  });
});

describe('detectIncidents', () => {
  it('nothing on a calm order', () => {
    expect(detectIncidents(order, calm())).toEqual([]);
  });
  it('payment failure', () => {
    expect(detectIncidents(order, calm({ paymentFailed: true }))).toEqual(['payment_failed']);
  });
  it('stop list only for dishes in the order', () => {
    expect(detectIncidents(order, calm({ outOfStockDishIds: ['other'] }))).toEqual([]);
    expect(detectIncidents(order, calm({ outOfStockDishIds: ['cola'] }))).toEqual(['stop_list']);
  });
  it('lateness ≥10 min in kitchen phase → kitchen_delay; 9 min → nothing', () => {
    for (const status of ['created', 'accepted', 'cooking', 'packing'] as const) {
      expect(detectIncidents({ ...order, status }, calm({ predictedEta: 55 * MIN }))).toEqual(['kitchen_delay']);
    }
    expect(detectIncidents({ ...order, status: 'cooking' }, calm({ predictedEta: 54 * MIN }))).toEqual([]);
  });
  it('lateness after handoff → courier_delay', () => {
    expect(detectIncidents({ ...order, status: 'courier_assigned' }, calm({ predictedEta: 60 * MIN }))).toEqual(['courier_delay']);
  });
  it('courier stuck ≥8 min while on_the_way → courier_delay', () => {
    expect(detectIncidents({ ...order, status: 'on_the_way' }, calm({ courierStuckMinutes: 8 }))).toEqual(['courier_delay']);
    expect(detectIncidents({ ...order, status: 'on_the_way' }, calm({ courierStuckMinutes: 7 }))).toEqual([]);
    expect(detectIncidents({ ...order, status: 'cooking' }, calm({ courierStuckMinutes: 20 }))).toEqual([]);
  });
  it('≥25 min late on the way → cold_risk as well', () => {
    expect(detectIncidents({ ...order, status: 'on_the_way' }, calm({ predictedEta: 70 * MIN }))).toEqual(['courier_delay', 'cold_risk']);
  });
  it('handoff unconfirmed ≥5 min → not_confirmed', () => {
    expect(detectIncidents(order, calm({ minutesSinceHandoffUnconfirmed: 5 }))).toEqual(['not_confirmed']);
  });
  it('does not re-raise kinds already on the order', () => {
    const o = { ...order, status: 'on_the_way' as const, incidents: [makeIncident({ kind: 'courier_delay' })] };
    expect(detectIncidents(o, calm({ predictedEta: 70 * MIN }))).toEqual(['cold_risk']);
  });
  // BUG (incidents.ts detectIncidents): `push` de-duplicates only against order.incidents, not against `out`.
  // Order on_the_way, 12 min late AND courier stuck 10 min → returns ['courier_delay', 'courier_delay'];
  // caller would build/notify the same incident twice (and burn the 2-message cap).
  test('never returns the same kind twice', () => {
    const kinds = detectIncidents({ ...order, status: 'on_the_way' }, calm({ predictedEta: 57 * MIN, courierStuckMinutes: 10 }));
    expect(kinds).toEqual(['courier_delay']);
  });
});

describe('shouldNotify (max 2 proactive messages per order)', () => {
  it('cap is 2', () => expect(MAX_PROACTIVE_MESSAGES_PER_ORDER).toBe(2));
  it('allows first and second, blocks third', () => {
    const o0 = makeOrder();
    const o1 = makeOrder({ incidents: [makeIncident({ kind: 'stop_list' })] });
    const o2 = makeOrder({ incidents: [makeIncident({ kind: 'stop_list' }), makeIncident({ kind: 'kitchen_delay' })] });
    expect(shouldNotify(o0, 'kitchen_delay')).toBe(true);
    expect(shouldNotify(o1, 'kitchen_delay')).toBe(true);
    expect(shouldNotify(o2, 'courier_delay')).toBe(false);
  });
  it('payment problems always pass and do not consume the cap', () => {
    const o2 = makeOrder({ incidents: [makeIncident({ kind: 'stop_list' }), makeIncident({ kind: 'kitchen_delay' })] });
    expect(shouldNotify(o2, 'payment_failed')).toBe(true);
    const oPay = makeOrder({ incidents: [makeIncident({ kind: 'payment_failed' }), makeIncident({ kind: 'payment_failed' }), makeIncident({ kind: 'stop_list' })] });
    expect(shouldNotify(oPay, 'courier_delay')).toBe(true);
  });
});

describe('buildIncident', () => {
  it.each(ALL_KINDS)('%s: Russian title & message, ≥1 resolution with unique ids, deterministic id', (kind) => {
    const inc = buildIncident(kind, 1234, { delayMinutes: 20 });
    expect(inc.id).toBe(`inc_${kind}_1234`);
    expect(inc.kind).toBe(kind);
    expect(inc.createdAt).toBe(1234);
    expect(inc.title).toMatch(/[а-яё]/i);
    expect(inc.message).toMatch(/[а-яё]/i);
    expect(inc.resolutions.length).toBeGreaterThanOrEqual(1);
    expect(new Set(inc.resolutions.map((r) => r.id)).size).toBe(inc.resolutions.length);
    expect(inc.compensationPoints).toBe(compensationFor(kind, 20));
    expect(inc.message).not.toMatch(/undefined|NaN/);
    expect(inc.title).not.toMatch(/undefined|NaN/);
  });
  it('delay incidents mention minutes and points', () => {
    const k = buildIncident('kitchen_delay', 0, { delayMinutes: 25 });
    expect(k.title).toBe('Кухня задерживается на 25 мин');
    expect(k.compensationPoints).toBe(300);
    expect(k.message).toContain('300 баллов');
    expect(k.resolutions.map((r) => r.kind)).toEqual(['wait', 'cancel']);
    const c = buildIncident('courier_delay', 0, { delayMinutes: 35 });
    expect(c.message).toContain('500 баллов');
  });
  it('no points → no promise of points in copy', () => {
    expect(buildIncident('kitchen_delay', 0, { delayMinutes: 5 }).message).not.toMatch(/балл/);
    expect(buildIncident('courier_delay', 0, { delayMinutes: 5 }).message).not.toMatch(/балл/);
  });
  it('stop_list offers replace / refund and 100 points', () => {
    const s = buildIncident('stop_list', 0, { dishId: 'pz', replacementDishIds: ['a', 'b'] });
    expect(s.message).toContain('100 баллов');
    expect(s.resolutions.map((r) => r.kind)).toEqual(['replace', 'refund_item']);
    expect(s.dishId).toBe('pz');
    expect(s.replacementDishIds).toEqual(['a', 'b']);
  });
  it('payment_failed offers retry and SBP', () => {
    const p = buildIncident('payment_failed', 0);
    expect(p.resolutions.map((r) => r.kind)).toEqual(['retry_payment', 'switch_method']);
    expect(p.resolutions[1].payload).toEqual({ method: 'sbp' });
  });
  it('weather_load offers switch to pickup', () => {
    expect(buildIncident('weather_load', 0).resolutions.map((r) => r.kind)).toContain('switch_pickup');
  });
  it('extra overrides defaults', () => {
    expect(buildIncident('cold_risk', 0, { title: 'X', compensationPoints: 1 })).toMatchObject({ title: 'X', compensationPoints: 1 });
  });
});

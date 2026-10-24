import { CONFIDENCE_THRESHOLD, averageCycleDays, predict, ritualMatches, type PredictInput } from '@/features/predictions/model/predict';
import { DAY, MIN, at, makeLine, makeOrder } from '../fixtures';

// 2026-10-23 is a Friday (getDay() === 5). TZ is pinned to Europe/Moscow in jest.config.js.
const FRI_1930 = at(2026, 10, 23, 19, 30);

const pizzaOrder = (createdAt: number, id = `o-${createdAt}`) =>
  makeOrder({ id, createdAt, lines: [makeLine({ dishId: 'pz' }), makeLine({ dishId: 'cola' })] });

const input = (over: Partial<PredictInput> = {}): PredictInput => ({
  orders: [], now: FRI_1930, ctx: { hour: 19, weekday: 5, weather: 'clear' }, cartDishIds: [], viewCounts: {}, orderedDishIds: [], muted: [], ...over,
});

const kinds = (i: PredictInput) => predict(i).map((p) => p.kind);

describe('ritual (same weekday ±90 min, ≥3 times)', () => {
  const fridays = [at(2026, 10, 16, 19, 0), at(2026, 10, 9, 19, 15), at(2026, 10, 2, 18, 30)].map((t) => pizzaOrder(t));

  it('sanity: fixture date is a Friday', () => expect(new Date(FRI_1930).getDay()).toBe(5));

  it('matches only same weekday within ±90 min', () => {
    const edge = pizzaOrder(at(2026, 10, 16, 21, 0)); // +90
    const out = pizzaOrder(at(2026, 10, 16, 21, 1)); // +91
    const thursday = pizzaOrder(at(2026, 10, 22, 19, 30));
    expect(ritualMatches([...fridays, edge, out, thursday], FRI_1930).map((o) => o.id)).toEqual([...fridays, edge].map((o) => o.id));
  });
  it('3 matching orders → «Как обычно в пятницу?» with repeat CTA', () => {
    const [p] = predict(input({ orders: fridays }));
    expect(p).toMatchObject({ kind: 'ritual', title: 'Как обычно в пятницу?', cta: 'Повторить', dishIds: ['pz', 'cola'] });
    expect(p.confidence).toBeCloseTo(0.85);
    expect(p.why).toContain('по пятницам');
    expect(p.why).toContain('3 раза');
  });
  it('2 matching orders → no ritual', () => {
    expect(kinds(input({ orders: fridays.slice(0, 2) }))).not.toContain('ritual');
  });
  it('picks the most frequent basket and its latest occurrence', () => {
    const sushi = makeOrder({ id: 'sushi', createdAt: at(2026, 10, 16, 19, 10), lines: [makeLine({ dishId: 'roll' })] });
    const p = predict(input({ orders: [...fridays, sushi] })).find((x) => x.kind === 'ritual')!;
    expect(p.dishIds.sort()).toEqual(['cola', 'pz']);
    expect(p.orderId).toBe(fridays[0].id);
  });
  it('confidence capped at 0.95', () => {
    const many = Array.from({ length: 8 }, (_, i) => pizzaOrder(FRI_1930 - (i + 1) * 7 * DAY));
    expect(predict(input({ orders: many })).find((x) => x.kind === 'ritual')!.confidence).toBe(0.95);
  });
  // BUG (predict.ts ritual `why`): count is always followed by «раза» → «5 раза», «8 раза».
  // Russian needs «5 раз» (plural genitive for 5–20, 25+…). Same pattern in viewed_not_ordered («смотрели … N раза»).
  test('Russian plural in why-copy: 5 → «5 раз»', () => {
    const five = Array.from({ length: 5 }, (_, i) => pizzaOrder(FRI_1930 - (i + 1) * 7 * DAY));
    expect(predict(input({ orders: five })).find((x) => x.kind === 'ritual')!.why).toMatch(/5 раз(?!а)/);
  });
});

describe('reorder cycle', () => {
  // orders every 5 days at 10:00 → not a ritual for Friday 19:30
  const every5 = (lastDaysAgo: number) => [0, 5, 10].map((k) => pizzaOrder(at(2026, 10, 23, 10, 0) - (lastDaysAgo + k) * DAY));

  it('averageCycleDays needs ≥3 orders', () => {
    expect(averageCycleDays(every5(5).slice(0, 2))).toBeNull();
    expect(averageCycleDays(every5(5))).toBeCloseTo(5, 6);
  });
  it('suggests reorder when the usual cycle has elapsed', () => {
    const p = predict(input({ orders: every5(5) })).find((x) => x.kind === 'reorder_cycle');
    expect(p).toBeDefined();
    expect(p!.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    expect(p!.confidence).toBeLessThanOrEqual(0.85);
    expect(p!.why).toContain('раз в 5 дн.');
  });
  it('does not suggest too early', () => {
    expect(kinds(input({ orders: every5(3) }))).not.toContain('reorder_cycle');
  });
});

describe('abandoned cart (>60 min)', () => {
  it('suggests returning to the cart after an hour', () => {
    const p = predict(input({ cartDishIds: ['a', 'b'], cartUpdatedAt: FRI_1930 - 61 * MIN }))[0];
    expect(p).toMatchObject({ kind: 'abandoned_cart', dishIds: ['a', 'b'], cta: 'Перейти в корзину' });
    expect(p.subtitle).toContain('2 поз.');
  });
  it('not before 60 min, not for empty cart', () => {
    expect(kinds(input({ cartDishIds: ['a'], cartUpdatedAt: FRI_1930 - 60 * MIN }))).toEqual([]);
    expect(kinds(input({ cartDishIds: [], cartUpdatedAt: FRI_1930 - 600 * MIN }))).toEqual([]);
  });
});

describe('other triggers, threshold, muting, ordering', () => {
  it('viewed ≥3 times and never ordered', () => {
    const ps = predict(input({ viewCounts: { a: 2, b: 5, c: 4 }, orderedDishIds: ['b'] }));
    expect(ps.find((p) => p.kind === 'viewed_not_ordered')!.dishIds).toEqual(['c']);
  });
  it('bad weather suggests soups', () => {
    expect(predict(input({ ctx: { hour: 19, weekday: 5, weather: 'snow' } }))[0]).toMatchObject({ kind: 'weather', title: 'Снег — время супа' });
  });
  it('near restaurant and birthday window (0..7 days)', () => {
    expect(kinds(input({ nearRestaurantName: 'ЖАР на Рубинштейна' }))).toEqual(['near_restaurant']);
    expect(kinds(input({ birthdayInDays: 7 }))).toEqual(['birthday']);
    expect(kinds(input({ birthdayInDays: 8 }))).toEqual([]);
    expect(kinds(input({ birthdayInDays: -1 }))).toEqual([]);
  });
  it('company weekend: Sat/Sun after noon with ≥2 big orders', () => {
    const sat = at(2026, 10, 24, 14, 0);
    const big = (t: number) => makeOrder({ createdAt: t, lines: [makeLine({ dishId: 'set', qty: 5 })] });
    const orders = [big(sat - 30 * DAY), big(sat - 60 * DAY)];
    expect(kinds(input({ now: sat, orders }))).toContain('company_weekend');
    expect(kinds(input({ now: FRI_1930, orders }))).not.toContain('company_weekend');
    expect(kinds(input({ now: sat, orders: orders.slice(0, 1) }))).not.toContain('company_weekend');
  });
  it('every returned prediction is ≥ threshold, sorted by confidence desc', () => {
    const fridays = [1, 2, 3].map((w) => pizzaOrder(FRI_1930 - w * 7 * DAY));
    const ps = predict(input({
      orders: fridays, cartDishIds: ['x'], cartUpdatedAt: FRI_1930 - 2 * 60 * MIN, viewCounts: { v: 3 },
      ctx: { hour: 19, weekday: 5, weather: 'rain' }, nearRestaurantName: 'R', birthdayInDays: 2,
    }));
    expect(ps.length).toBeGreaterThan(3);
    for (const p of ps) expect(p.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    for (let i = 1; i < ps.length; i++) expect(ps[i].confidence).toBeLessThanOrEqual(ps[i - 1].confidence);
    expect(ps[0].kind).toBe('ritual');
    for (const p of ps) { expect(p.why.length).toBeGreaterThan(0); expect(p.cta.length).toBeGreaterThan(0); }
  });
  it('muted kinds are never returned («Не предлагать такое»)', () => {
    const fridays = [1, 2, 3].map((w) => pizzaOrder(FRI_1930 - w * 7 * DAY));
    const ps = predict(input({ orders: fridays, muted: ['ritual', 'weather'], ctx: { hour: 19, weekday: 5, weather: 'rain' } }));
    expect(ps.map((p) => p.kind)).not.toEqual(expect.arrayContaining(['ritual']));
    expect(ps.map((p) => p.kind)).not.toContain('weather');
  });
  it('no history, no signals → nothing', () => {
    expect(predict(input())).toEqual([]);
  });
});

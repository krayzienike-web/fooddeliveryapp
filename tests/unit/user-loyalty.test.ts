import { LOYALTY_LEVELS, WHEEL_PRIZES, levelFor, levelInfo, nextLevel, pickPrize } from '@/entities/user/model/loyalty';

describe('loyalty levels', () => {
  it('levels are ordered by threshold and cashback grows', () => {
    expect(LOYALTY_LEVELS.map((l) => l.id)).toEqual(['bronze', 'silver', 'gold', 'black']);
    expect(LOYALTY_LEVELS[0].threshold).toBe(0);
    for (let i = 1; i < LOYALTY_LEVELS.length; i++) {
      expect(LOYALTY_LEVELS[i].threshold).toBeGreaterThan(LOYALTY_LEVELS[i - 1].threshold);
      expect(LOYALTY_LEVELS[i].cashback).toBeGreaterThan(LOYALTY_LEVELS[i - 1].cashback);
    }
  });
  it.each([
    [0, 'bronze'], [9999, 'bronze'], [10000, 'silver'], [29999, 'silver'], [30000, 'gold'], [69999, 'gold'], [70000, 'black'], [1e7, 'black'],
  ])('spend %i → %s', (spend, id) => expect(levelFor(spend).id).toBe(id));
  it('levelInfo by id', () => {
    expect(levelInfo('gold')).toMatchObject({ title: 'Жар', cashback: 7 });
  });
  it('nextLevel: remaining & progress', () => {
    expect(nextLevel(0)).toMatchObject({ level: { id: 'silver' }, remaining: 10000, progress: 0 });
    expect(nextLevel(5000)).toMatchObject({ level: { id: 'silver' }, remaining: 5000, progress: 0.5 });
    expect(nextLevel(10000)).toMatchObject({ level: { id: 'gold' }, remaining: 20000, progress: 0 });
    expect(nextLevel(50000)).toMatchObject({ level: { id: 'black' }, remaining: 20000, progress: 0.5 });
    expect(nextLevel(70000)).toBeNull();
  });
  it('progress always within 0..1 for non-negative spend', () => {
    for (let s = 0; s < 70000; s += 777) {
      const n = nextLevel(s)!;
      expect(n.progress).toBeGreaterThanOrEqual(0);
      expect(n.progress).toBeLessThan(1);
    }
  });
});

describe('spin wheel', () => {
  it('weights sum to 100 and ids are unique', () => {
    expect(WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0)).toBe(100);
    expect(new Set(WHEEL_PRIZES.map((p) => p.id)).size).toBe(WHEEL_PRIZES.length);
  });
  it('dish prizes reference a dish', () => {
    for (const p of WHEEL_PRIZES.filter((x) => x.kind === 'dish')) expect(p.dishId).toBeTruthy();
  });
  it.each([
    [0, 'p50'], [0.2599, 'p50'], [0.26, 'p100'], [0.4599, 'p100'], [0.46, 'fd'], [0.62, 'dessert'], [0.74, 'd15'],
    [0.86, 'p300'], [0.94, 'drink'], [0.989, 'drink'], [0.99, 'p1000'], [0.999999, 'p1000'], [1, 'p1000'],
  ])('rand %f → %s', (r, id) => expect(pickPrize(r).id).toBe(id));
  it('distribution over a uniform grid matches weights', () => {
    const N = 100_000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const id = pickPrize((i + 0.5) / N).id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    for (const p of WHEEL_PRIZES) expect(Math.abs(counts[p.id] / N - p.weight / 100)).toBeLessThan(0.001);
  });
  it('custom prize list', () => {
    const prizes = [
      { id: 'a', title: 'a', short: 'a', weight: 1, kind: 'points' as const, value: 1 },
      { id: 'b', title: 'b', short: 'b', weight: 3, kind: 'points' as const, value: 1 },
    ];
    expect(pickPrize(0.24, prizes).id).toBe('a');
    expect(pickPrize(0.25, prizes).id).toBe('b');
  });
});

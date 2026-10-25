import { WHEEL_PRIZES } from '@/entities/user/model/loyalty';
import { createApi } from '@/services/mock';
import { nextSpinIn, prizeOdds, sectorAt, targetRotation } from '../wheel';

describe('wheel geometry', () => {
  test.each([0, 1, 3, 7])('target rotation lands sector %i under the pointer, with jitter, from any start', (i) => {
    for (const start of [0, 37, 725, -90]) {
      for (const j of [-0.4, 0, 0.39]) {
        const r = targetRotation(start, i, 8, 5, j);
        expect(sectorAt(r, 8)).toBe(i);
        expect(r - start).toBeGreaterThanOrEqual(5 * 360);
        expect(r - start).toBeLessThan(6 * 360);
      }
    }
  });

  test('odds add up to 100% and match weights', () => {
    const odds = prizeOdds(WHEEL_PRIZES);
    expect(odds.reduce((s, o) => s + o.percent, 0)).toBeCloseTo(100, 0);
    expect(odds.find((o) => o.prize.id === 'p1000')!.percent).toBe(1);
  });

  test('next spin wording', () => {
    const now = 0;
    expect(nextSpinIn(null, now)).toBeNull();
    expect(nextSpinIn(5 * 3600000, now)).toBe('через 5 часов');
    expect(nextSpinIn(3 * 86400000, now)).toBe('через 3 дня');
    expect(nextSpinIn(21 * 3600000 + 1, now)).toBe('через 22 часа');
  });
});

describe('mock LoyaltyApi', () => {
  test('two demo spins (weekly + order bonus), then none; points prizes credit, others become a personal promo usable once', async () => {
    const api = createApi({ latencyMs: 0, seed: 3 });
    const s0 = await api.loyalty.state();
    expect(s0.spins).toBe(2);
    const before = (await api.user.me()).points;
    const results = [await api.loyalty.spin(), await api.loyalty.spin()];
    await expect(api.loyalty.spin()).rejects.toMatchObject({ code: 'conflict' });
    const s = await api.loyalty.state();
    expect(s.spins).toBe(0);
    expect(s.nextWeeklySpinAt).not.toBeNull();
    const pointsWon = results.filter((r) => r.prize.kind === 'points').reduce((sum, r) => sum + r.prize.value, 0);
    expect((await api.user.me()).points).toBe(before + pointsWon);
    for (const r of results) {
      if (r.prize.kind === 'points') expect(r.promo).toBeUndefined();
      else {
        expect(r.promo).toMatchObject({ personal: true });
        expect((await api.catalog.getPromos()).some((p) => p.code === r.promo!.code)).toBe(true);
        await expect(api.catalog.validatePromo(r.promo!.code, 100)).resolves.toMatchObject({ code: r.promo!.code });
      }
    }
  });
});

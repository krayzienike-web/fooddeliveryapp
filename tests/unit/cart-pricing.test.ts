import { PRICING, calcTotals, lineKey, linePrice, maxSpendablePoints, promoDiscount, unitPrice } from '@/entities/cart/model/pricing';
import { indexBy, makeDish, makeLine, makeModifierGroup, makePromo, makeTotalsInput } from '../fixtures';

describe('lineKey', () => {
  it('is stable regardless of option / removed-ingredient order', () => {
    expect(lineKey('d', ['b', 'a'], ['y', 'x'])).toBe(lineKey('d', ['a', 'b'], ['x', 'y']));
    expect(lineKey('d', ['b', 'a'], ['y', 'x'])).toBe('d|a,b|x,y');
  });
  it('differs for different modifiers / removals / dishes', () => {
    expect(lineKey('d', ['a'], [])).not.toBe(lineKey('d', [], ['a']));
    expect(lineKey('d', ['a'], [])).not.toBe(lineKey('e', ['a'], []));
  });
  it('does not mutate inputs', () => {
    const opts = ['b', 'a'];
    lineKey('d', opts, []);
    expect(opts).toEqual(['b', 'a']);
  });
});

describe('unitPrice / linePrice with modifiers', () => {
  const size = makeModifierGroup({ id: 'size', options: [
    { id: 's30', title: '30 см', priceDelta: 0 },
    { id: 's40', title: '40 см', priceDelta: 250 },
  ] });
  const extras = makeModifierGroup({ id: 'extra', kind: 'multi', options: [
    { id: 'cheese', title: 'Сыр', priceDelta: 90 },
    { id: 'bacon', title: 'Бекон', priceDelta: 120 },
  ] });
  const pizza = makeDish({ id: 'pz', price: 600, modifierGroupIds: ['size', 'extra'] });
  const dishes = indexBy([pizza]);
  const mods = indexBy([size, extras]);

  it('adds deltas of selected options', () => {
    expect(unitPrice({ dishId: 'pz', optionIds: [] }, dishes, mods)).toBe(600);
    expect(unitPrice({ dishId: 'pz', optionIds: ['s40', 'cheese', 'bacon'] }, dishes, mods)).toBe(600 + 250 + 90 + 120);
  });
  it('ignores options not belonging to the dish groups and unknown groups', () => {
    expect(unitPrice({ dishId: 'pz', optionIds: ['ghost'] }, dishes, mods)).toBe(600);
    const d2 = makeDish({ id: 'x', price: 100, modifierGroupIds: ['missing'] });
    expect(unitPrice({ dishId: 'x', optionIds: [] }, indexBy([d2]), mods)).toBe(100);
  });
  it('returns 0 for unknown dish', () => {
    expect(unitPrice({ dishId: 'nope', optionIds: [] }, dishes, mods)).toBe(0);
  });
  it('multiplies by qty', () => {
    expect(linePrice(makeLine({ dishId: 'pz', qty: 3, optionIds: ['s40'] }), dishes, mods)).toBe(3 * 850);
  });
});

describe('calcTotals: delivery fee & thresholds', () => {
  it('charges delivery below free-delivery threshold', () => {
    const t = calcTotals(makeTotalsInput([[makeDish({ price: 1000 }), 1]]));
    expect(t).toMatchObject({ itemsTotal: 1000, discount: 0, deliveryFee: PRICING.deliveryFee, toFreeDelivery: 500, total: 1199, itemsCount: 1 });
  });
  it('free delivery exactly at threshold (1500)', () => {
    const t = calcTotals(makeTotalsInput([[makeDish({ price: 500 }), 3]]));
    expect(t.deliveryFee).toBe(0);
    expect(t.toFreeDelivery).toBe(0);
    expect(t.total).toBe(1500);
  });
  it('threshold is checked after discount', () => {
    const promo = makePromo({ kind: 'fixed', amount: 200, minTotal: 0 });
    const t = calcTotals(makeTotalsInput([[makeDish({ price: 1600 }), 1]], { promo }));
    expect(t.toFreeDelivery).toBe(100);
    expect(t.deliveryFee).toBe(199);
  });
  it('empty cart → no delivery fee, zero total', () => {
    const t = calcTotals(makeTotalsInput([]));
    expect(t).toMatchObject({ itemsTotal: 0, itemsCount: 0, deliveryFee: 0, total: 0 });
  });
  it('surge override replaces base fee', () => {
    const t = calcTotals(makeTotalsInput([[makeDish({ price: 300 }), 1]], { deliveryFeeOverride: 349 }));
    expect(t.deliveryFee).toBe(349);
  });
  it('toGift counts down to 2500', () => {
    expect(calcTotals(makeTotalsInput([[makeDish({ price: 2000 }), 1]])).toGift).toBe(500);
    expect(calcTotals(makeTotalsInput([[makeDish({ price: 3000 }), 1]])).toGift).toBe(0);
  });
});

describe('calcTotals: pickup', () => {
  it('gives 10% pickup discount and no delivery fee', () => {
    const t = calcTotals(makeTotalsInput([[makeDish({ price: 1000 }), 1]], { mode: 'pickup' }));
    expect(t).toMatchObject({ discount: 100, deliveryFee: 0, toFreeDelivery: 0, total: 900 });
  });
  it('pickup discount applies on top of promo (to remainder)', () => {
    const promo = makePromo({ kind: 'fixed', amount: 200, minTotal: 0 });
    const t = calcTotals(makeTotalsInput([[makeDish({ price: 1000 }), 1]], { mode: 'pickup', promo }));
    expect(t.discount).toBe(200 + 80);
    expect(t.total).toBe(720);
  });
});

describe('promo mechanics', () => {
  const pizza = makeDish({ id: 'pz', categoryId: 'pizza', price: 500 });
  const pizzaCheap = makeDish({ id: 'pz2', categoryId: 'pizza', price: 300 });
  const roll = makeDish({ id: 'rl', categoryId: 'rolls', price: 400 });

  it('percent on whole order', () => {
    const promo = makePromo({ kind: 'percent', percent: 15 });
    expect(calcTotals(makeTotalsInput([[pizza, 2]], { promo })).discount).toBe(150);
  });
  it('percent respects minTotal', () => {
    const promo = makePromo({ kind: 'percent', percent: 10, minTotal: 2000 });
    expect(calcTotals(makeTotalsInput([[pizza, 2]], { promo })).discount).toBe(0);
    expect(calcTotals(makeTotalsInput([[pizza, 4]], { promo })).discount).toBe(200);
  });
  it('percent limited to a category', () => {
    const promo = makePromo({ kind: 'percent', percent: 20, categoryId: 'rolls' });
    expect(calcTotals(makeTotalsInput([[pizza, 1], [roll, 2]], { promo })).discount).toBe(160);
  });
  it('percent rounds to whole rubles', () => {
    const promo = makePromo({ kind: 'percent', percent: 15 });
    expect(calcTotals(makeTotalsInput([[makeDish({ price: 333 }), 1]], { promo })).discount).toBe(50);
  });
  it('fixed requires minTotal and never exceeds items total', () => {
    const promo = makePromo({ kind: 'fixed', amount: 300, minTotal: 1000 });
    expect(calcTotals(makeTotalsInput([[pizza, 1]], { promo })).discount).toBe(0);
    expect(calcTotals(makeTotalsInput([[pizza, 2]], { promo })).discount).toBe(300);
    const big = makePromo({ kind: 'fixed', amount: 5000, minTotal: 0 });
    const t = calcTotals(makeTotalsInput([[pizza, 1]], { promo: big }));
    expect(t.discount).toBe(500);
    expect(t.total).toBeGreaterThanOrEqual(0);
  });
  it('n_plus_one: every (n+1)-th cheapest unit in category is free', () => {
    const promo = makePromo({ kind: 'n_plus_one', n: 2, categoryId: 'pizza' });
    expect(calcTotals(makeTotalsInput([[pizza, 2], [pizzaCheap, 1]], { promo })).discount).toBe(300);
    expect(calcTotals(makeTotalsInput([[pizza, 2]], { promo })).discount).toBe(0);
    expect(calcTotals(makeTotalsInput([[pizza, 4], [pizzaCheap, 2]], { promo })).discount).toBe(600);
    expect(calcTotals(makeTotalsInput([[pizza, 2], [roll, 5]], { promo })).discount).toBe(0);
  });
  it('n_plus_one uses unit price including modifiers', () => {
    const size = makeModifierGroup({ id: 'size', options: [{ id: 'big', title: '40', priceDelta: 200 }] });
    const p = makeDish({ id: 'p', categoryId: 'pizza', price: 500, modifierGroupIds: ['size'] });
    const promo = makePromo({ kind: 'n_plus_one', n: 1, categoryId: 'pizza' });
    const t = calcTotals(makeTotalsInput([[p, 1, ['big']], [p, 1]], { promo, modifierGroups: [size] }));
    expect(t.discount).toBe(500);
  });
  it('gift gives no money discount', () => {
    const promo = makePromo({ kind: 'gift', dishId: 'x', minTotal: 0 });
    expect(promoDiscount(promo, [], {}, {}, 1000)).toBe(0);
  });
  it('free_delivery waives fee when items total ≥ minTotal', () => {
    const promo = makePromo({ kind: 'free_delivery', minTotal: 700 });
    expect(calcTotals(makeTotalsInput([[pizza, 1]], { promo })).deliveryFee).toBe(199);
    const t = calcTotals(makeTotalsInput([[pizza, 2]], { promo }));
    expect(t.deliveryFee).toBe(0);
    expect(t.discount).toBe(0);
    expect(t.total).toBe(1000);
  });
  // BUG (pricing.ts calcTotals, `toFreeDelivery` line): documented as "Amount left to reach free delivery; 0 when reached",
  // but with an active free_delivery promo it still reports 500 → UI would nag "добавьте 500 ₽ до бесплатной доставки"
  // while delivery is already free. Remove `.failing` once fixed.
  test('free_delivery promo → toFreeDelivery is 0 (nothing left to reach)', () => {
    const promo = makePromo({ kind: 'free_delivery', minTotal: 700 });
    expect(calcTotals(makeTotalsInput([[pizza, 2]], { promo })).toFreeDelivery).toBe(0);
  });
  it('no promo → 0', () => {
    expect(promoDiscount(undefined, [], {}, {}, 1000)).toBe(0);
  });
});

describe('points, tips, cashback', () => {
  const d = makeDish({ price: 1000 });
  it('caps points at 30% of the order after discount', () => {
    expect(maxSpendablePoints(1000, 5000)).toBe(300);
    expect(maxSpendablePoints(1000, 120)).toBe(120);
    expect(maxSpendablePoints(999, 5000)).toBe(299);
    expect(maxSpendablePoints(0, 5000)).toBe(0);
    const t = calcTotals(makeTotalsInput([[d, 2]], { pointsToSpend: 10000, availablePoints: 10000 }));
    expect(t.pointsSpent).toBe(600);
    expect(t.total).toBe(1400);
  });
  it('cannot spend more than available or negative points', () => {
    expect(calcTotals(makeTotalsInput([[d, 2]], { pointsToSpend: 500, availablePoints: 100 })).pointsSpent).toBe(100);
    expect(calcTotals(makeTotalsInput([[d, 2]], { pointsToSpend: -50, availablePoints: 100 })).pointsSpent).toBe(0);
  });
  it('points cap uses pickup-discounted amount', () => {
    const t = calcTotals(makeTotalsInput([[d, 1]], { mode: 'pickup', pointsToSpend: 1000, availablePoints: 1000 }));
    expect(t.pointsSpent).toBe(270);
  });
  it('adds tips, ignores negative tips', () => {
    expect(calcTotals(makeTotalsInput([[d, 2]], { tips: 150 })).total).toBe(2150);
    expect(calcTotals(makeTotalsInput([[d, 2]], { tips: -150 })).tips).toBe(0);
  });
  it('cashback is earned on paid amount (after discount and points), excluding delivery and tips', () => {
    const t = calcTotals(makeTotalsInput([[d, 1]], { cashbackPercent: 5, pointsToSpend: 300, availablePoints: 300, tips: 100 }));
    expect(t.pointsEarned).toBe(35);
    expect(t.total).toBe(700 + 199 + 100);
  });
  it('cashback is floored', () => {
    expect(calcTotals(makeTotalsInput([[makeDish({ price: 333 }), 1]], { cashbackPercent: 3 })).pointsEarned).toBe(9);
  });
  it('invariant: total = items − discount − points + delivery + service + tips, never negative', () => {
    const promo = makePromo({ kind: 'percent', percent: 7 });
    for (const qty of [1, 2, 3, 5, 8]) {
      for (const mode of ['delivery', 'pickup'] as const) {
        const t = calcTotals(makeTotalsInput([[makeDish({ price: 290 }), qty]], { mode, promo, pointsToSpend: 200, availablePoints: 200, tips: 50, cashbackPercent: 5 }));
        expect(t.total).toBe(t.itemsTotal - t.discount - t.pointsSpent + t.deliveryFee + t.serviceFee + t.tips);
        expect(t.total).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

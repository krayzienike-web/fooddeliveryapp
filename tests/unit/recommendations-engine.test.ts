import {
  NEUTRAL_TASTE, SIGNAL_WEIGHT, TASTE_AXES, applySignal, contextBoost, emptyProfile, explainMatch, fitsDiet, rankDishes, scoreDish, tasteMatch,
  type Context, type RankOptions,
} from '@/features/recommendations/model/engine';
import type { Dish, TasteVector } from '@/entities/dish/model/types';
import { makeDish, makeProfile, neutralTaste } from '../fixtures';

const dist = (a: TasteVector, b: TasteVector) => Math.sqrt(TASTE_AXES.reduce((s, k) => s + (a[k] - b[k]) ** 2, 0));
const noon: Context = { hour: 13, weekday: 3, weather: 'clear' };
const quiet: Context = { hour: 16, weekday: 2, weather: 'clear' }; // no context boosts

describe('applySignal', () => {
  const spicyDish = makeDish({ id: 'spicy', taste: neutralTaste({ spicy: 1, asian: 0.9, sweet: 0 }) });

  it('like/order/addToCart move the profile toward the dish', () => {
    for (const sig of ['like', 'order', 'addToCart', 'longView', 'view'] as const) {
      const p0 = emptyProfile();
      const p1 = applySignal(p0, spicyDish, sig);
      expect(dist(p1.vector, spicyDish.taste)).toBeLessThan(dist(p0.vector, spicyDish.taste));
      expect(p1.vector.spicy).toBeGreaterThan(0.5);
      expect(p1.vector.sweet).toBeLessThan(0.5);
    }
  });
  it('stronger signals move more (order > like > view)', () => {
    const d = (s: 'order' | 'like' | 'view') => applySignal(emptyProfile(), spicyDish, s).vector.spicy;
    expect(d('order')).toBeGreaterThan(d('like'));
    expect(d('like')).toBeGreaterThan(d('view'));
  });
  it('profile visibly adapts within 5–10 likes', () => {
    let p = emptyProfile();
    for (let i = 0; i < 8; i++) p = applySignal(p, spicyDish, 'like');
    expect(p.vector.spicy).toBeGreaterThan(0.75);
  });
  it('skip/dislike move away from the dish; dislike records the dish once', () => {
    const p1 = applySignal(emptyProfile(), spicyDish, 'dislike');
    expect(p1.vector.spicy).toBeLessThan(0.5);
    expect(p1.dislikedDishIds).toEqual(['spicy']);
    const p2 = applySignal(p1, spicyDish, 'dislike');
    expect(p2.dislikedDishIds).toEqual(['spicy']);
    const s = applySignal(emptyProfile(), spicyDish, 'skip');
    expect(s.vector.spicy).toBeLessThan(0.5);
    expect(s.dislikedDishIds).toEqual([]);
  });
  it('accumulates dish affinity by signal weight', () => {
    let p = applySignal(emptyProfile(), spicyDish, 'like');
    p = applySignal(p, spicyDish, 'order');
    expect(p.dishAffinity.spicy).toBeCloseTo(SIGNAL_WEIGHT.like + SIGNAL_WEIGHT.order, 9);
  });
  it('keeps every axis within 0..1 and does not mutate input', () => {
    const p0 = makeProfile({ vector: neutralTaste({ spicy: 0.99, sweet: 0.01 }) });
    const snapshot = JSON.stringify(p0);
    let p = p0;
    for (let i = 0; i < 50; i++) p = applySignal(p, makeDish({ taste: neutralTaste({ spicy: 1, sweet: 0 }) }), i % 2 ? 'order' : 'dislike');
    for (const k of TASTE_AXES) { expect(p.vector[k]).toBeGreaterThanOrEqual(0); expect(p.vector[k]).toBeLessThanOrEqual(1); }
    expect(JSON.stringify(p0)).toBe(snapshot);
  });
});

describe('tasteMatch / explainMatch', () => {
  it('neutral profile → 0.5', () => {
    expect(tasteMatch(NEUTRAL_TASTE, makeDish({ taste: neutralTaste({ spicy: 1 }) }))).toBe(0.5);
  });
  it('aligned > orthogonal > opposite, all within 0..1', () => {
    const v = neutralTaste({ spicy: 1 });
    const aligned = tasteMatch(v, makeDish({ taste: neutralTaste({ spicy: 0.9 }) }));
    const opposite = tasteMatch(v, makeDish({ taste: neutralTaste({ spicy: 0 }) }));
    const ortho = tasteMatch(v, makeDish({ taste: neutralTaste({ sweet: 1 }) }));
    expect(aligned).toBeCloseTo(1, 6);
    expect(opposite).toBeCloseTo(0, 6);
    expect(ortho).toBeCloseTo(0.5, 6);
  });
  it('explains the strongest shared axis', () => {
    expect(explainMatch(neutralTaste({ spicy: 0.9, meat: 0.7 }), makeDish({ taste: neutralTaste({ spicy: 0.8, meat: 0.8 }) }))).toBe('Вы любите острое');
    expect(explainMatch(NEUTRAL_TASTE, makeDish())).toBeNull();
  });
});

describe('fitsDiet', () => {
  it('none accepts all', () => expect(fitsDiet(makeDish({ taste: neutralTaste({ meat: 1 }) }), 'none')).toBe(true));
  it('veg requires veg/vegan tag', () => {
    expect(fitsDiet(makeDish({ tags: ['veg'] }), 'veg')).toBe(true);
    expect(fitsDiet(makeDish({ tags: ['vegan'] }), 'veg')).toBe(true);
    expect(fitsDiet(makeDish({ tags: [] }), 'veg')).toBe(false);
  });
  it('gluten_free excludes gluten allergen', () => {
    expect(fitsDiet(makeDish({ allergens: ['gluten'] }), 'gluten_free')).toBe(false);
    expect(fitsDiet(makeDish({ allergens: ['nuts'] }), 'gluten_free')).toBe(true);
  });
  it('pp: tag or ≤450 kcal', () => {
    expect(fitsDiet(makeDish({ tags: ['pp'], nutrition: { kcal: 900, protein: 0, fat: 0, carbs: 0 } }), 'pp')).toBe(true);
    expect(fitsDiet(makeDish({ nutrition: { kcal: 450, protein: 0, fat: 0, carbs: 0 } }), 'pp')).toBe(true);
    expect(fitsDiet(makeDish({ nutrition: { kcal: 451, protein: 0, fat: 0, carbs: 0 } }), 'pp')).toBe(false);
  });
  it('halal: tag or (almost) no meat', () => {
    expect(fitsDiet(makeDish({ tags: ['halal'], taste: neutralTaste({ meat: 1 }) }), 'halal')).toBe(true);
    expect(fitsDiet(makeDish({ taste: neutralTaste({ meat: 0.1 }) }), 'halal')).toBe(true);
    expect(fitsDiet(makeDish({ taste: neutralTaste({ meat: 0.8 }) }), 'halal')).toBe(false);
  });
});

describe('contextBoost', () => {
  const d = (categoryId: Dish['categoryId'], hearty = 0.5) => makeDish({ categoryId, taste: neutralTaste({ hearty }) });
  it('breakfast in the morning, penalised after 15:00', () => {
    expect(contextBoost(d('breakfast'), { hour: 8, weekday: 1, weather: 'clear' })).toBeCloseTo(0.35);
    expect(contextBoost(d('breakfast'), { hour: 16, weekday: 1, weather: 'clear' })).toBeCloseTo(-0.2);
  });
  it('soups / hearty dishes in bad weather', () => {
    for (const weather of ['rain', 'snow', 'storm'] as const) expect(contextBoost(d('soups'), { hour: 16, weekday: 1, weather })).toBeCloseTo(0.3);
    expect(contextBoost(d('hot', 0.9), { hour: 16, weekday: 1, weather: 'rain' })).toBeCloseTo(0.3);
    expect(contextBoost(d('soups'), { hour: 16, weekday: 1, weather: 'clear' })).toBe(0);
  });
  it('sets/combo/pizza on Friday & Saturday evening', () => {
    expect(contextBoost(d('sets'), { hour: 19, weekday: 5, weather: 'clear' })).toBeCloseTo(0.25);
    expect(contextBoost(d('pizza'), { hour: 19, weekday: 6, weather: 'clear' })).toBeCloseTo(0.25);
    expect(contextBoost(d('sets'), { hour: 19, weekday: 3, weather: 'clear' })).toBe(0);
  });
  it('late-night comfort food', () => {
    expect(contextBoost(d('burgers'), { hour: 1, weekday: 2, weather: 'clear' })).toBeCloseTo(0.2);
    expect(contextBoost(d('salads'), { hour: 1, weekday: 2, weather: 'clear' })).toBe(0);
  });
  it('lunch: soups/wok/salads', () => {
    expect(contextBoost(d('wok'), noon)).toBeCloseTo(0.15);
    expect(contextBoost(d('desserts'), noon)).toBe(0);
  });
  it('boosts stack (rainy lunch soup)', () => {
    expect(contextBoost(d('soups'), { hour: 13, weekday: 2, weather: 'rain' })).toBeCloseTo(0.45);
  });
});

describe('rankDishes', () => {
  const opts = (over: Partial<RankOptions> = {}): RankOptions => ({ profile: makeProfile(), diet: 'none', ctx: quiet, exploration: 0, ...over });

  it('ranks dishes matching the taste profile higher', () => {
    const spicy = makeDish({ id: 'spicy', taste: neutralTaste({ spicy: 1 }) });
    const sweet = makeDish({ id: 'sweet', taste: neutralTaste({ sweet: 1, spicy: 0 }) });
    const ranked = rankDishes([sweet, spicy], opts({ profile: makeProfile({ vector: neutralTaste({ spicy: 0.9, sweet: 0.2 }) }) }));
    expect(ranked.map((d) => d.id)).toEqual(['spicy', 'sweet']);
  });
  it('excludes disliked dishes and dishes outside the diet', () => {
    const a = makeDish({ id: 'a', tags: ['veg'] });
    const b = makeDish({ id: 'b', tags: ['veg'] });
    const meat = makeDish({ id: 'meat', tags: [] });
    const ranked = rankDishes([a, b, meat], opts({ diet: 'veg', profile: makeProfile({ dislikedDishIds: ['b'] }) }));
    expect(ranked.map((d) => d.id)).toEqual(['a']);
    expect(scoreDish(b, opts({ profile: makeProfile({ dislikedDishIds: ['b'] }) }))).toBe(-Infinity);
  });
  it('affinity from past signals lifts a dish', () => {
    const a = makeDish({ id: 'a' });
    const b = makeDish({ id: 'b' });
    expect(rankDishes([a, b], opts({ profile: makeProfile({ dishAffinity: { b: 3 } }) }))[0].id).toBe('b');
  });
  it('diversity: never 3 dishes of the same category in a row while alternatives remain', () => {
    const pizzas = Array.from({ length: 6 }, (_, i) => makeDish({ id: `pz${i}`, categoryId: 'pizza', popularity: 600, rating: 5 }));
    const others = [
      makeDish({ id: 's1', categoryId: 'salads', popularity: 0, rating: 4 }),
      makeDish({ id: 's2', categoryId: 'salads', popularity: 0, rating: 4 }),
      makeDish({ id: 'w1', categoryId: 'wok', popularity: 0, rating: 4 }),
    ];
    const ranked = rankDishes([...pizzas, ...others], opts());
    expect(ranked).toHaveLength(9);
    const cats = ranked.map((d) => d.categoryId);
    // with 6 pizzas and 3 others the best possible is P P x P P x P P x
    for (let i = 2; i < cats.length; i++) expect(cats[i] === cats[i - 1] && cats[i] === cats[i - 2]).toBe(false);
    expect(cats.slice(0, 2)).toEqual(['pizza', 'pizza']);
  });
  it('falls back gracefully when only one category is left', () => {
    const ranked = rankDishes(Array.from({ length: 4 }, () => makeDish({ categoryId: 'rolls' })), opts());
    expect(ranked).toHaveLength(4);
  });
  it('context boost reorders: breakfast wins in the morning', () => {
    const br = makeDish({ id: 'br', categoryId: 'breakfast' });
    const burger = makeDish({ id: 'bg', categoryId: 'burgers' });
    expect(rankDishes([burger, br], opts({ ctx: { hour: 9, weekday: 2, weather: 'clear' } }))[0].id).toBe('br');
    expect(rankDishes([br, burger], opts({ ctx: { hour: 23, weekday: 2, weather: 'clear' } }))[0].id).toBe('bg');
  });
  it('is deterministic for a given seed and returns a permutation', () => {
    const ds = Array.from({ length: 20 }, (_, i) => makeDish({ id: `d${i}`, categoryId: (['pizza', 'rolls', 'wok', 'soups'] as const)[i % 4] }));
    const o = opts({ exploration: 0.3, seed: 7 });
    const r1 = rankDishes(ds, o).map((d) => d.id);
    expect(rankDishes(ds, o).map((d) => d.id)).toEqual(r1);
    expect([...r1].sort()).toEqual(ds.map((d) => d.id).sort());
  });
});

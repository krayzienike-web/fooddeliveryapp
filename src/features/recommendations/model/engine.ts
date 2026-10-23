import type { Dish, TasteAxis, TasteVector } from '@/entities/dish/model/types';
import type { DietMode, TasteProfile } from '@/entities/user/model/types';

export const TASTE_AXES: TasteAxis[] = ['spicy', 'sweet', 'meat', 'seafood', 'cheesy', 'fresh', 'hearty', 'asian'];

export const TASTE_AXIS_TITLE: Record<TasteAxis, string> = {
  spicy: 'Острое',
  sweet: 'Сладкое',
  meat: 'Мясо',
  seafood: 'Морепродукты',
  cheesy: 'Сырное',
  fresh: 'Свежее',
  hearty: 'Сытное',
  asian: 'Азия',
};

export const NEUTRAL_TASTE: TasteVector = { spicy: 0.5, sweet: 0.5, meat: 0.5, seafood: 0.5, cheesy: 0.5, fresh: 0.5, hearty: 0.5, asian: 0.5 };

export function emptyProfile(): TasteProfile {
  return { vector: { ...NEUTRAL_TASTE }, dishAffinity: {}, dislikedDishIds: [], mutedSuggestionKinds: [], onboarded: false };
}

/**
 * Signal weights. A like moves the profile toward the dish, a skip slightly away.
 * Learning rate is intentionally high so the feed visibly adapts within 5–10 swipes.
 */
export const SIGNAL_WEIGHT = {
  order: 1,
  like: 0.6,
  addToCart: 0.7,
  longView: 0.25,
  view: 0.05,
  skip: -0.15,
  dislike: -0.6,
} as const;

export type Signal = keyof typeof SIGNAL_WEIGHT;

const LEARNING_RATE = 0.22;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function applySignal(profile: TasteProfile, dish: Dish, signal: Signal): TasteProfile {
  const w = SIGNAL_WEIGHT[signal];
  const vector = { ...profile.vector };
  for (const axis of TASTE_AXES) {
    const target = dish.taste[axis];
    const delta = (target - vector[axis]) * LEARNING_RATE * Math.abs(w);
    vector[axis] = clamp01(vector[axis] + (w >= 0 ? delta : -delta * 0.5));
  }
  const dishAffinity = { ...profile.dishAffinity, [dish.id]: (profile.dishAffinity[dish.id] ?? 0) + w };
  const dislikedDishIds = signal === 'dislike' ? [...new Set([...profile.dislikedDishIds, dish.id])] : profile.dislikedDishIds;
  return { ...profile, vector, dishAffinity, dislikedDishIds };
}

/** Cosine-like similarity between the profile and a dish, 0..1. */
export function tasteMatch(v: TasteVector, dish: Dish): number {
  let dot = 0;
  let a = 0;
  let b = 0;
  for (const axis of TASTE_AXES) {
    const x = v[axis] - 0.5;
    const y = dish.taste[axis] - 0.5;
    dot += x * y;
    a += x * x;
    b += y * y;
  }
  if (a === 0 || b === 0) return 0.5;
  return (dot / Math.sqrt(a * b) + 1) / 2;
}

export function fitsDiet(dish: Dish, diet: DietMode): boolean {
  switch (diet) {
    case 'none':
      return true;
    case 'pp':
      return dish.tags.includes('pp') || dish.nutrition.kcal <= 450;
    case 'gluten_free':
      return !dish.allergens.includes('gluten');
    case 'halal':
      return dish.tags.includes('halal') || dish.taste.meat < 0.2;
    case 'veg':
      return dish.tags.includes('veg') || dish.tags.includes('vegan');
  }
}

export interface Context {
  hour: number;
  weekday: number;
  weather: 'clear' | 'rain' | 'snow' | 'storm';
}

/** Context boosts (C10): breakfast in the morning, soups in the rain, sets on Friday night, desserts late. */
export function contextBoost(dish: Dish, ctx: Context): number {
  let boost = 0;
  const c = dish.categoryId;
  if (ctx.hour >= 7 && ctx.hour < 12 && c === 'breakfast') boost += 0.35;
  if (ctx.hour >= 15 && c === 'breakfast') boost -= 0.2;
  if ((ctx.weather === 'rain' || ctx.weather === 'snow' || ctx.weather === 'storm') && (c === 'soups' || dish.taste.hearty > 0.7)) boost += 0.3;
  if ((ctx.weekday === 5 || ctx.weekday === 6) && ctx.hour >= 17 && (c === 'sets' || c === 'combo' || c === 'pizza')) boost += 0.25;
  if (ctx.hour >= 23 || ctx.hour < 4) {
    if (c === 'burgers' || c === 'snacks' || c === 'pizza') boost += 0.2;
  }
  if (ctx.hour >= 12 && ctx.hour < 15 && (c === 'soups' || c === 'wok' || c === 'salads')) boost += 0.15;
  return boost;
}

export interface RankOptions {
  profile: TasteProfile;
  diet: DietMode;
  ctx: Context;
  /** 0..1 exploration share, keeps the feed from collapsing into a single taste. */
  exploration?: number;
  seed?: number;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function scoreDish(dish: Dish, o: RankOptions): number {
  if (o.profile.dislikedDishIds.includes(dish.id)) return -Infinity;
  if (!fitsDiet(dish, o.diet)) return -Infinity;
  const match = tasteMatch(o.profile.vector, dish);
  const affinity = Math.tanh((o.profile.dishAffinity[dish.id] ?? 0) / 2) * 0.3;
  const popularity = Math.min(dish.popularity / 600, 1) * 0.15;
  const rating = (dish.rating - 4) * 0.1;
  return match * 0.6 + affinity + popularity + rating + contextBoost(dish, o.ctx);
}

export function rankDishes(dishes: Dish[], o: RankOptions): Dish[] {
  const rnd = mulberry32(o.seed ?? 42);
  const exploration = o.exploration ?? 0.15;
  const scored = dishes
    .map((d) => ({ d, s: scoreDish(d, o) + rnd() * exploration }))
    .filter((x) => Number.isFinite(x.s))
    .sort((a, b) => b.s - a.s);
  // Diversify: avoid more than 2 dishes of the same category in a row.
  const out: Dish[] = [];
  const pool = [...scored];
  while (pool.length) {
    const lastTwo = out.slice(-2).map((d) => d.categoryId);
    let idx = pool.findIndex((x) => !(lastTwo.length === 2 && lastTwo.every((c) => c === x.d.categoryId)));
    if (idx < 0) idx = 0;
    out.push(pool.splice(idx, 1)[0].d);
  }
  return out;
}

/** Human explanation for "Почему?" chips. */
export function explainMatch(v: TasteVector, dish: Dish): string | null {
  const top = TASTE_AXES.filter((a) => v[a] > 0.62 && dish.taste[a] > 0.62).sort((a, b) => v[b] - v[a]);
  if (!top.length) return null;
  return `Вы любите ${TASTE_AXIS_TITLE[top[0]].toLowerCase()}`;
}

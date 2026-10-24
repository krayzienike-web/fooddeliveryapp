/**
 * Typed fixture factories. Tests must build their own data with these factories
 * instead of importing seed content from src/mocks/seed (seed changes often).
 * Every factory takes a partial override; defaults are minimal and neutral.
 */
import type { CartLine } from '@/entities/cart/model/types';
import type { Dish, ModifierGroup, TasteVector } from '@/entities/dish/model/types';
import type { Incident, Order } from '@/entities/order/model/types';
import type { Promo, PromoMechanic } from '@/entities/promo/model/types';
import type { TasteProfile } from '@/entities/user/model/types';
import type { DishIndex, ModifierIndex, TotalsInput } from '@/entities/cart/model/pricing';

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

export const neutralTaste = (over: Partial<TasteVector> = {}): TasteVector => ({
  spicy: 0.5, sweet: 0.5, meat: 0.5, seafood: 0.5, cheesy: 0.5, fresh: 0.5, hearty: 0.5, asian: 0.5, ...over,
});

export function makeDish(over: Partial<Dish> = {}): Dish {
  const id = over.id ?? nextId('dish');
  return {
    id,
    categoryId: 'hot',
    name: `Блюдо ${id}`,
    tagline: '',
    description: '',
    price: 500,
    weight: 300,
    unit: 'г',
    nutrition: { kcal: 600, protein: 20, fat: 20, carbs: 60 },
    tags: [],
    allergens: [],
    ingredients: [],
    modifierGroupIds: [],
    taste: neutralTaste(),
    popularity: 100,
    rating: 4.5,
    reviewsCount: 10,
    cookMinutes: 15,
    image: `img/${id}`,
    pairsWith: [],
    ...over,
  };
}

export function makeModifierGroup(over: Partial<ModifierGroup> = {}): ModifierGroup {
  return { id: over.id ?? nextId('mg'), title: 'Размер', kind: 'single', required: false, options: [], ...over };
}

export function makeLine(over: Partial<CartLine> & { dishId: string }): CartLine {
  const optionIds = over.optionIds ?? [];
  const removed = over.removedIngredientIds ?? [];
  return { key: `${over.dishId}|${optionIds.join(',')}|${removed.join(',')}`, qty: 1, optionIds, removedIngredientIds: removed, ...over };
}

export const indexBy = <T extends { id: string }>(xs: T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, x]));

export function makePromo(mechanic: PromoMechanic, over: Partial<Promo> = {}): Promo {
  return {
    id: nextId('promo'), code: 'TEST', title: 'Тест', subtitle: '', description: '', image: '', tint: '#000000',
    mechanic, validUntil: '2099-12-31', conditions: [], ...over,
  };
}

/** Convenience: totals input over a set of dishes; lines given as [dish, qty]. */
export function makeTotalsInput(
  items: Array<[Dish, number] | [Dish, number, string[]]>,
  over: Partial<TotalsInput> & { modifierGroups?: ModifierGroup[] } = {},
): TotalsInput {
  const { modifierGroups = [], ...rest } = over;
  const dishes: DishIndex = indexBy(items.map(([d]) => d));
  const modifiers: ModifierIndex = indexBy(modifierGroups);
  return {
    lines: items.map(([d, qty, opts]) => makeLine({ dishId: d.id, qty, optionIds: opts ?? [] })),
    dishes, modifiers, mode: 'delivery', pointsToSpend: 0, availablePoints: 0, tips: 0, cashbackPercent: 0,
    ...rest,
  };
}

export function makeIncident(over: Partial<Incident> & Pick<Incident, 'kind'>): Incident {
  return { id: nextId('inc'), createdAt: 0, title: '', message: '', compensationPoints: 0, resolutions: [], ...over };
}

export function makeOrder(over: Partial<Order> = {}): Order {
  const createdAt = over.createdAt ?? Date.UTC(2026, 9, 23, 12, 0);
  return {
    id: over.id ?? nextId('order'),
    number: '1001',
    createdAt,
    mode: 'delivery',
    lines: [makeLine({ dishId: 'd1' })],
    total: 1000,
    pointsEarned: 0,
    pointsSpent: 0,
    payment: 'card',
    restaurantId: 'r1',
    status: 'created',
    history: [{ status: 'created', at: createdAt }],
    etaFrom: createdAt + 30 * 60000,
    etaTo: createdAt + 45 * 60000,
    promisedBy: createdAt + 45 * 60000,
    chef: { id: 'c1', name: 'Шеф', rating: 5, avatar: '', specialty: '' },
    courierProgress: 0,
    incidents: [],
    ...over,
  };
}

export function makeProfile(over: Partial<TasteProfile> = {}): TasteProfile {
  return { vector: neutralTaste(), dishAffinity: {}, dislikedDishIds: [], mutedSuggestionKinds: [], onboarded: true, ...over };
}

/** Local-time timestamp helper (predict.ts works in local time via Date#getDay/getHours). */
export const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime();
export const MIN = 60000;
export const DAY = 86400000;

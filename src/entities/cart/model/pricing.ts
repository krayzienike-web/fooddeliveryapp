import type { Dish, ModifierGroup } from '@/entities/dish/model/types';
import type { Promo } from '@/entities/promo/model/types';
import type { CartLine, CartTotals, FulfillmentMode } from './types';

export const PRICING = {
  freeDeliveryFrom: 1500,
  deliveryFee: 199,
  giftFrom: 2500,
  serviceFeePercent: 0,
  /** Max share of the order that can be paid with points. */
  maxPointsShare: 0.3,
  pickupDiscountPercent: 10,
} as const;

export type DishIndex = Record<string, Dish>;
export type ModifierIndex = Record<string, ModifierGroup>;

export function lineKey(dishId: string, optionIds: string[], removedIngredientIds: string[]): string {
  return [dishId, [...optionIds].sort().join(','), [...removedIngredientIds].sort().join(',')].join('|');
}

export function unitPrice(line: Pick<CartLine, 'dishId' | 'optionIds'>, dishes: DishIndex, modifiers: ModifierIndex): number {
  const dish = dishes[line.dishId];
  if (!dish) return 0;
  let price = dish.price;
  for (const groupId of dish.modifierGroupIds) {
    const group = modifiers[groupId];
    if (!group) continue;
    for (const opt of group.options) {
      if (line.optionIds.includes(opt.id)) price += opt.priceDelta;
    }
  }
  return price;
}

export function linePrice(line: CartLine, dishes: DishIndex, modifiers: ModifierIndex): number {
  return unitPrice(line, dishes, modifiers) * line.qty;
}

export function promoDiscount(promo: Promo | undefined, lines: CartLine[], dishes: DishIndex, modifiers: ModifierIndex, itemsTotal: number): number {
  if (!promo) return 0;
  const m = promo.mechanic;
  switch (m.kind) {
    case 'percent': {
      if (m.minTotal && itemsTotal < m.minTotal) return 0;
      const base = m.categoryId
        ? lines.filter((l) => dishes[l.dishId]?.categoryId === m.categoryId).reduce((s, l) => s + linePrice(l, dishes, modifiers), 0)
        : itemsTotal;
      return Math.round((base * m.percent) / 100);
    }
    case 'fixed':
      return itemsTotal >= m.minTotal ? Math.min(m.amount, itemsTotal) : 0;
    case 'n_plus_one': {
      // Every (n+1)-th cheapest unit in the category is free.
      const units: number[] = [];
      for (const l of lines) {
        if (dishes[l.dishId]?.categoryId !== m.categoryId) continue;
        const p = unitPrice(l, dishes, modifiers);
        for (let i = 0; i < l.qty; i++) units.push(p);
      }
      units.sort((a, b) => a - b);
      const free = Math.floor(units.length / (m.n + 1));
      return units.slice(0, free).reduce((s, p) => s + p, 0);
    }
    case 'gift':
    case 'free_delivery':
      return 0;
  }
}

export interface TotalsInput {
  lines: CartLine[];
  dishes: DishIndex;
  modifiers: ModifierIndex;
  mode: FulfillmentMode;
  promo?: Promo;
  pointsToSpend: number;
  availablePoints: number;
  tips: number;
  cashbackPercent: number;
  /** Surge delivery fee override (weather / peak load). */
  deliveryFeeOverride?: number;
}

export function maxSpendablePoints(itemsAfterDiscount: number, availablePoints: number): number {
  return Math.max(0, Math.min(availablePoints, Math.floor(itemsAfterDiscount * PRICING.maxPointsShare)));
}

export function calcTotals(input: TotalsInput): CartTotals {
  const { lines, dishes, modifiers, mode, promo } = input;
  const itemsTotal = lines.reduce((s, l) => s + linePrice(l, dishes, modifiers), 0);
  const itemsCount = lines.reduce((s, l) => s + l.qty, 0);
  let discount = promoDiscount(promo, lines, dishes, modifiers, itemsTotal);
  if (mode === 'pickup') discount += Math.round(((itemsTotal - discount) * PRICING.pickupDiscountPercent) / 100);
  const afterDiscount = Math.max(0, itemsTotal - discount);

  const freeDeliveryByPromo = promo?.mechanic.kind === 'free_delivery' && itemsTotal >= promo.mechanic.minTotal;
  const toFreeDelivery = mode === 'delivery' ? Math.max(0, PRICING.freeDeliveryFrom - afterDiscount) : 0;
  const baseFee = input.deliveryFeeOverride ?? PRICING.deliveryFee;
  const deliveryFee = mode === 'pickup' || itemsCount === 0 || freeDeliveryByPromo || toFreeDelivery === 0 ? 0 : baseFee;

  const pointsSpent = Math.min(Math.max(0, input.pointsToSpend), maxSpendablePoints(afterDiscount, input.availablePoints));
  const serviceFee = 0;
  const tips = Math.max(0, input.tips);
  const total = afterDiscount - pointsSpent + deliveryFee + serviceFee + tips;
  const pointsEarned = Math.floor(((afterDiscount - pointsSpent) * input.cashbackPercent) / 100);

  return {
    itemsTotal,
    discount,
    deliveryFee,
    serviceFee,
    pointsSpent,
    tips,
    total,
    toFreeDelivery,
    toGift: Math.max(0, PRICING.giftFrom - afterDiscount),
    pointsEarned,
    itemsCount,
  };
}

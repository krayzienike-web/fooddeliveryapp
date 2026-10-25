import type { LoyaltyLevel, LoyaltyLevelInfo } from './types';

export const LOYALTY_LEVELS: LoyaltyLevelInfo[] = [
  { id: 'bronze', title: 'Искра', threshold: 0, cashback: 3, perks: ['3% баллами', 'Подарок в день рождения'] },
  { id: 'silver', title: 'Пламя', threshold: 10000, cashback: 5, perks: ['5% баллами', 'Бесплатная доставка от 1000 ₽', 'Ранний доступ к новинкам'] },
  { id: 'gold', title: 'Жар', threshold: 30000, cashback: 7, perks: ['7% баллами', 'Приоритетная доставка', 'Скидка 20% в ДР', 'Персональный шеф-сет раз в месяц'] },
  { id: 'black', title: 'Пекло', threshold: 70000, cashback: 10, perks: ['10% баллами', 'Бесплатная доставка всегда', 'Стол без очереди', 'Закрытые дегустации'] },
];

export function levelFor(spend: number): LoyaltyLevelInfo {
  let lvl = LOYALTY_LEVELS[0];
  for (const l of LOYALTY_LEVELS) if (spend >= l.threshold) lvl = l;
  return lvl;
}

export function levelInfo(id: LoyaltyLevel): LoyaltyLevelInfo {
  return LOYALTY_LEVELS.find((l) => l.id === id)!;
}

export function nextLevel(spend: number): { level: LoyaltyLevelInfo; remaining: number; progress: number } | null {
  const cur = levelFor(spend);
  const idx = LOYALTY_LEVELS.indexOf(cur);
  const next = LOYALTY_LEVELS[idx + 1];
  if (!next) return null;
  return { level: next, remaining: next.threshold - spend, progress: (spend - cur.threshold) / (next.threshold - cur.threshold) };
}

/** Wheel rules (guidebook §3.12): one weekly spin + one per order from orderMin; prizes live ≥ 7 days. */
export const WHEEL_RULES = { weeklyEveryDays: 7, orderMin: 1500, prizeTtlDays: 14 } as const;

/** Spin-wheel prizes (C12). Weights sum to 100; one spin per completed order. */
export interface WheelPrize {
  id: string;
  title: string;
  short: string;
  weight: number;
  kind: 'points' | 'dish' | 'free_delivery' | 'discount';
  value: number;
  dishId?: string;
}

export const WHEEL_PRIZES: WheelPrize[] = [
  { id: 'p50', title: '50 баллов', short: '50', weight: 26, kind: 'points', value: 50 },
  { id: 'p100', title: '100 баллов', short: '100', weight: 20, kind: 'points', value: 100 },
  { id: 'fd', title: 'Бесплатная доставка', short: 'Доставка', weight: 16, kind: 'free_delivery', value: 1 },
  { id: 'dessert', title: 'Десерт в подарок', short: 'Десерт', weight: 12, kind: 'dish', value: 1, dishId: 'des-cheesecake' },
  { id: 'd15', title: 'Скидка 15%', short: '−15%', weight: 12, kind: 'discount', value: 15 },
  { id: 'p300', title: '300 баллов', short: '300', weight: 8, kind: 'points', value: 300 },
  { id: 'drink', title: 'Лимонад в подарок', short: 'Лимонад', weight: 5, kind: 'dish', value: 1, dishId: 'drk-lemonade-mango' },
  { id: 'p1000', title: '1000 баллов', short: '1000', weight: 1, kind: 'points', value: 1000 },
];

export function pickPrize(rand: number, prizes: WheelPrize[] = WHEEL_PRIZES): WheelPrize {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let x = rand * total;
  for (const p of prizes) {
    if (x < p.weight) return p;
    x -= p.weight;
  }
  return prizes[prizes.length - 1];
}

import type { CategoryId, Dish } from '@/entities/dish/model/types';
import type { BanquetFormat } from '@/entities/restaurant/model/types';

/**
 * Banquet menu constructor (J6, C9). Pure.
 * Builds a shared-platter menu from portion norms (grams per guest per course),
 * then fits it into the budget: popular dishes first, cheaper per gram if over budget,
 * smaller portions down to 85% of the norm, premium dishes if the budget allows.
 */

interface Course {
  title: string;
  cats: CategoryId[];
  /** Grams per guest (for drinks: servings per guest). */
  norm: number;
  drinks?: boolean;
}

const COURSES: Record<BanquetFormat, Course[]> = {
  banquet: [
    { title: 'Холодные закуски', cats: ['sets', 'rolls'], norm: 220 },
    { title: 'Салаты', cats: ['salads'], norm: 180 },
    { title: 'Горячее', cats: ['hot', 'pizza'], norm: 320 },
    { title: 'Закуски к столу', cats: ['snacks'], norm: 120 },
    { title: 'Десерты', cats: ['desserts'], norm: 110 },
    { title: 'Напитки', cats: ['drinks'], norm: 1, drinks: true },
  ],
  buffet: [
    { title: 'Роллы и сеты', cats: ['sets', 'rolls'], norm: 220 },
    { title: 'Фингерфуд', cats: ['snacks'], norm: 200 },
    { title: 'Пицца', cats: ['pizza'], norm: 150 },
    { title: 'Десерты', cats: ['desserts'], norm: 90 },
    { title: 'Напитки', cats: ['drinks'], norm: 1, drinks: true },
  ],
  catering: [
    { title: 'Сеты', cats: ['sets'], norm: 200 },
    { title: 'Закуски', cats: ['snacks'], norm: 180 },
    { title: 'Пицца', cats: ['pizza'], norm: 200 },
    { title: 'Салаты', cats: ['salads'], norm: 120 },
    { title: 'Десерты', cats: ['desserts'], norm: 90 },
    { title: 'Напитки', cats: ['drinks'], norm: 1, drinks: true },
  ],
};

/** Food that doesn't share well on a platter. */
const NOT_SHAREABLE = new Set(['soups', 'breakfast', 'wok', 'pasta', 'combo', 'burgers']);

export const BANQUET_LIMITS = { minGuests: 10, maxGuests: 120, minBudget: 1500, maxBudget: 8000, budgetStep: 250 };

export interface BanquetSection {
  title: string;
  items: Array<{ dishId: string; qty: number }>;
}

export interface BanquetMenu {
  sections: BanquetSection[];
  total: number;
  perGuest: number;
  /** Food only, drinks excluded. */
  gramsPerGuest: number;
  fitsBudget: boolean;
  strategy: 'popular' | 'value' | 'premium';
}

type Strategy = BanquetMenu['strategy'];

function variety(guests: number): number {
  return guests >= 60 ? 4 : guests >= 20 ? 3 : 2;
}

function build(dishes: Dish[], guests: number, format: BanquetFormat, strategy: Strategy, scale: number, variant: number, stopList: string[]): BanquetMenu {
  const sections: BanquetSection[] = [];
  let total = 0;
  let grams = 0;
  for (const course of COURSES[format]) {
    const pool = dishes
      .filter((d) => course.cats.includes(d.categoryId) && !NOT_SHAREABLE.has(d.categoryId) && !stopList.includes(d.id) && !d.tags.includes('kids'))
      .filter((d) => (course.drinks ? d.unit === 'мл' && !/кофе|латте|раф|капучино/i.test(d.name) : d.weight > 0));
    const ppg = (d: Dish) => d.price / Math.max(1, d.weight);
    const sorted = [...pool].sort((a, b) =>
      strategy === 'value' ? ppg(a) - ppg(b) || b.popularity - a.popularity : strategy === 'premium' ? ppg(b) - ppg(a) : b.popularity - a.popularity,
    );
    const n = Math.min(variety(guests), sorted.length);
    if (!n) continue;
    // «Пересобрать»: rotate within the top of the list so a new variant still respects the strategy.
    const window = sorted.slice(0, Math.min(sorted.length, n + 3));
    const picked = Array.from({ length: n }, (_, i) => window[(i + variant) % window.length]).filter((d, i, a) => a.indexOf(d) === i);
    const items = picked.map((d) => {
      const qty = course.drinks ? Math.ceil((guests * course.norm) / picked.length) : Math.max(1, Math.round((course.norm * scale * guests) / (picked.length * d.weight)));
      total += d.price * qty;
      if (!course.drinks) grams += d.weight * qty;
      return { dishId: d.id, qty };
    });
    sections.push({ title: course.title, items });
  }
  return { sections, total, perGuest: Math.round(total / guests), gramsPerGuest: Math.round(grams / guests), fitsBudget: true, strategy };
}

export function composeBanquetMenu(
  dishes: Dish[],
  opts: { guests: number; budgetPerGuest: number; format: BanquetFormat; variant?: number; stopList?: string[] },
): BanquetMenu {
  const { guests, budgetPerGuest, format, variant = 0, stopList = [] } = opts;
  const budget = guests * budgetPerGuest;
  const make = (s: Strategy, scale: number) => build(dishes, guests, format, s, scale, variant, stopList);

  let menu = make('popular', 1);
  if (menu.total < budget * 0.6) {
    const premium = make('premium', 1);
    if (premium.total <= budget) menu = premium;
  }
  if (menu.total > budget) menu = make('value', 1);
  for (let scale = 0.95; menu.total > budget && scale >= 0.85 - 1e-9; scale -= 0.05) menu = make('value', scale);
  return { ...menu, fitsBudget: menu.total <= budget };
}

/** The cheapest honest menu for this group, per guest, rounded up to the slider step. */
export function minBudgetPerGuest(dishes: Dish[], guests: number, format: BanquetFormat, stopList: string[] = []): number {
  const cheapest = build(dishes, guests, format, 'value', 0.85, 0, stopList);
  const step = BANQUET_LIMITS.budgetStep;
  return Math.max(BANQUET_LIMITS.minBudget, Math.ceil(cheapest.perGuest / step) * step);
}

/** Recommended food per guest for the format, grams — shown as the norm next to the menu. */
export function gramsNorm(format: BanquetFormat): [number, number] {
  return format === 'banquet' ? [850, 1100] : format === 'buffet' ? [550, 750] : [650, 850];
}

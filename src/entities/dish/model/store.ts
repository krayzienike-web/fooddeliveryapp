import { create } from 'zustand';
import { api } from '@/services';
import type { Category, Dish, ModifierGroup } from './types';

interface MenuState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  categories: Category[];
  dishes: Dish[];
  byId: Record<string, Dish>;
  modifiers: Record<string, ModifierGroup>;
  stopList: string[];
  load: () => Promise<void>;
}

export const useMenu = create<MenuState>((set, get) => ({
  status: 'idle',
  categories: [],
  dishes: [],
  byId: {},
  modifiers: {},
  stopList: [],
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading' });
    try {
      const m = await api.catalog.getMenu();
      set({
        status: 'ready',
        categories: m.categories,
        dishes: m.dishes,
        byId: Object.fromEntries(m.dishes.map((d) => [d.id, d])),
        modifiers: Object.fromEntries(m.modifiers.map((g) => [g.id, g])),
        stopList: m.stopList,
      });
    } catch {
      set({ status: 'error' });
    }
  },
}));

export const useDish = (id: string | undefined) => useMenu((s) => (id ? s.byId[id] : undefined));

/** Default option ids for required single-choice groups. */
export function defaultOptions(dish: Dish, modifiers: Record<string, ModifierGroup>): string[] {
  return dish.modifierGroupIds
    .map((g) => modifiers[g])
    .filter((g): g is ModifierGroup => !!g && g.kind === 'single' && !!g.defaultOptionId)
    .map((g) => g.defaultOptionId!);
}

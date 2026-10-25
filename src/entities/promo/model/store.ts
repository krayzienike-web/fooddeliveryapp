import { create } from 'zustand';
import { api } from '@/services';
import type { Promo } from './types';

interface PromosState {
  list: Promo[];
  loaded: boolean;
  /** Always refetches: wheel prizes add personal promos at any time. */
  load: () => Promise<void>;
}

export const usePromos = create<PromosState>((set) => ({
  list: [],
  loaded: false,
  load: async () => {
    const list = await api.catalog.getPromos();
    set({ list, loaded: true });
  },
}));

export const usePromo = (id?: string) => usePromos((s) => s.list.find((p) => p.id === id));

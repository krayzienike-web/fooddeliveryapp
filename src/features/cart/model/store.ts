import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { lineKey } from '@/entities/cart/model/pricing';
import type { CartLine, FulfillmentMode } from '@/entities/cart/model/types';
import type { Promo } from '@/entities/promo/model/types';
import { safeStorage } from '@/shared/lib/storage';

export interface GroupMember {
  id: string;
  name: string;
  color: string;
  paid?: boolean;
}

interface CartState {
  lines: CartLine[];
  mode: FulfillmentMode;
  addressId?: string;
  pickupRestaurantId?: string;
  promo?: Promo;
  pointsToSpend: number;
  tips: number;
  cutlery: number;
  comment: string;
  updatedAt?: number;
  /** Group cart (C7). Empty = solo cart. */
  group: GroupMember[];
  /** Last added dish id — drives the "fly to cart" animation. */
  lastAdded?: { dishId: string; at: number };

  add: (dishId: string, optionIds?: string[], removedIngredientIds?: string[], qty?: number, addedBy?: string) => void;
  setQty: (key: string, qty: number) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  replaceAll: (lines: CartLine[]) => void;
  setMode: (m: FulfillmentMode) => void;
  setAddress: (id: string) => void;
  setPickupRestaurant: (id: string) => void;
  setPromo: (p?: Promo) => void;
  setPoints: (n: number) => void;
  setTips: (n: number) => void;
  setCutlery: (n: number) => void;
  setComment: (s: string) => void;
  startGroup: (members: GroupMember[]) => void;
  endGroup: () => void;
  markPaid: (memberId: string) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      mode: 'delivery',
      addressId: 'addr-home',
      pointsToSpend: 0,
      tips: 0,
      cutlery: 1,
      comment: '',
      group: [],

      add: (dishId, optionIds = [], removed = [], qty = 1, addedBy) => {
        const key = lineKey(dishId, optionIds, removed) + (addedBy ? `@${addedBy}` : '');
        const lines = [...get().lines];
        const i = lines.findIndex((l) => l.key === key);
        if (i >= 0) lines[i] = { ...lines[i], qty: lines[i].qty + qty };
        else lines.push({ key, dishId, qty, optionIds, removedIngredientIds: removed, addedBy });
        set({ lines, updatedAt: Date.now(), lastAdded: { dishId, at: Date.now() } });
      },
      setQty: (key, qty) => set({ lines: get().lines.map((l) => (l.key === key ? { ...l, qty } : l)).filter((l) => l.qty > 0), updatedAt: Date.now() }),
      inc: (key) => get().setQty(key, (get().lines.find((l) => l.key === key)?.qty ?? 0) + 1),
      dec: (key) => get().setQty(key, (get().lines.find((l) => l.key === key)?.qty ?? 0) - 1),
      remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key), updatedAt: Date.now() }),
      clear: () => set({ lines: [], promo: undefined, pointsToSpend: 0, tips: 0, comment: '', group: [], updatedAt: Date.now() }),
      replaceAll: (lines) => set({ lines, updatedAt: Date.now(), lastAdded: lines[0] ? { dishId: lines[0].dishId, at: Date.now() } : undefined }),
      setMode: (mode) => set({ mode }),
      setAddress: (addressId) => set({ addressId }),
      setPickupRestaurant: (pickupRestaurantId) => set({ pickupRestaurantId }),
      setPromo: (promo) => set({ promo }),
      setPoints: (pointsToSpend) => set({ pointsToSpend }),
      setTips: (tips) => set({ tips }),
      setCutlery: (cutlery) => set({ cutlery: Math.max(0, Math.min(10, cutlery)) }),
      setComment: (comment) => set({ comment }),
      startGroup: (group) => set({ group }),
      endGroup: () => set({ group: [] }),
      markPaid: (id) => set({ group: get().group.map((m) => (m.id === id ? { ...m, paid: true } : m)) }),
    }),
    {
      name: 'zhar-cart',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ lines: s.lines, mode: s.mode, addressId: s.addressId, pickupRestaurantId: s.pickupRestaurantId, cutlery: s.cutlery, updatedAt: s.updatedAt }),
    },
  ),
);

export const useCartCount = () => useCart((s) => s.lines.reduce((a, l) => a + l.qty, 0));
export const useDishQty = (dishId: string) => useCart((s) => s.lines.filter((l) => l.dishId === dishId).reduce((a, l) => a + l.qty, 0));

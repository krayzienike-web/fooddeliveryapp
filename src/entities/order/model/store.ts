import { create } from 'zustand';
import { api } from '@/services';
import { isFinal } from './lifecycle';
import type { Order } from './types';

interface OrdersState {
  orders: Order[];
  activeId?: string;
  loaded: boolean;
  load: () => Promise<void>;
  upsert: (o: Order) => void;
  track: (o: Order) => void;
}

const unsubs = new Map<string, () => void>();

export const useOrders = create<OrdersState>((set, get) => ({
  orders: [],
  loaded: false,
  load: async () => {
    const orders = await api.orders.list();
    set({ orders, loaded: true });
  },
  upsert: (o) => {
    const exists = get().orders.some((x) => x.id === o.id);
    set({ orders: exists ? get().orders.map((x) => (x.id === o.id ? o : x)) : [o, ...get().orders] });
  },
  /** Subscribe to live updates and make this the order shown in the status capsule. */
  track: (o) => {
    get().upsert(o);
    set({ activeId: o.id });
    if (unsubs.has(o.id)) return;
    const off = api.orders.subscribe(o.id, (next) => {
      get().upsert(next);
      if (isFinal(next.status)) {
        // keep the capsule a little longer after delivery so the guest sees the result
        setTimeout(() => {
          if (get().activeId === next.id) set({ activeId: undefined });
          unsubs.get(next.id)?.();
          unsubs.delete(next.id);
        }, 15000);
      }
    });
    unsubs.set(o.id, off);
  },
}));

export const useActiveOrder = () => useOrders((s) => s.orders.find((o) => o.id === s.activeId));
export const useOrder = (id?: string) => useOrders((s) => s.orders.find((o) => o.id === id));

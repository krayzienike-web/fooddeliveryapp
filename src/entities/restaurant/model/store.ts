import { create } from 'zustand';
import { api } from '@/services';
import type { Booking, Restaurant } from './types';

interface RestaurantsState {
  list: Restaurant[];
  loaded: boolean;
  load: () => Promise<void>;
  bookings: Booking[];
  addBooking: (b: Booking) => void;
}

export const useRestaurants = create<RestaurantsState>((set, get) => ({
  list: [],
  loaded: false,
  bookings: [],
  addBooking: (b) => set({ bookings: [b, ...get().bookings.filter((x) => x.id !== b.id)] }),
  load: async () => {
    if (get().loaded) return;
    const list = await api.booking.restaurants();
    set({ list, loaded: true });
  },
}));

export const useRestaurant = (id?: string) => useRestaurants((s) => s.list.find((r) => r.id === id));

import { create } from 'zustand';

interface Flight {
  id: number;
  image: string;
  x: number;
  y: number;
  size: number;
}

interface FlyState {
  flights: Flight[];
  sessionCount: number;
  launch: (f: Omit<Flight, 'id'>) => void;
  land: (id: number) => void;
}

/** Fly-to-cart (C3): shown for the first 3 adds per session, then only bump + haptic (guidebook §2.6). */
export const useFly = create<FlyState>((set, get) => ({
  flights: [],
  sessionCount: 0,
  launch: (f) => {
    if (get().sessionCount >= 3) return;
    set({ flights: [...get().flights, { ...f, id: Date.now() + Math.random() }], sessionCount: get().sessionCount + 1 });
  },
  land: (id) => set({ flights: get().flights.filter((x) => x.id !== id) }),
}));

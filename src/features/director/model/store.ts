import { create } from 'zustand';
import type { Context } from '@/features/recommendations/model/engine';

/**
 * «Панель режиссёра» (D0): overrides the context the app believes it's in (day, time, weather)
 * so the presenter can show predictions and context-aware home live. Demo-only.
 */
interface DirectorState {
  open: boolean;
  weekday?: number;
  hour?: number;
  weather: Context['weather'];
  speed: number;
  nearRestaurant: boolean;
  setOpen: (v: boolean) => void;
  setTime: (weekday?: number, hour?: number) => void;
  setWeather: (w: Context['weather']) => void;
  setSpeed: (s: number) => void;
  setNearRestaurant: (v: boolean) => void;
  reset: () => void;
}

export const useDirector = create<DirectorState>((set) => ({
  open: false,
  weather: 'clear',
  speed: 1,
  nearRestaurant: false,
  setOpen: (open) => set({ open }),
  setTime: (weekday, hour) => set({ weekday, hour }),
  setWeather: (weather) => set({ weather }),
  setSpeed: (speed) => set({ speed }),
  setNearRestaurant: (nearRestaurant) => set({ nearRestaurant }),
  reset: () => set({ weekday: undefined, hour: undefined, weather: 'clear', speed: 1, nearRestaurant: false }),
}));

/** The "now" the app reasons with: real time, shifted to the director's weekday/hour if set. */
export function directorNow(s: Pick<DirectorState, 'weekday' | 'hour'>): number {
  const d = new Date();
  if (s.weekday !== undefined) d.setDate(d.getDate() + ((s.weekday - d.getDay() + 7) % 7));
  if (s.hour !== undefined) d.setHours(s.hour, 5, 0, 0);
  return d.getTime();
}

export function useAppContext(): Context & { now: number } {
  const s = useDirector();
  const now = directorNow(s);
  const d = new Date(now);
  return { now, hour: d.getHours(), weekday: d.getDay(), weather: s.weather };
}

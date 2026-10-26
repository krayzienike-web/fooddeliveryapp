import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Dish } from '@/entities/dish/model/types';
import type { TasteProfile } from '@/entities/user/model/types';
import { DEMO_VIEW_COUNTS } from '@/mocks/seed/user';
import { safeStorage } from '@/shared/lib/storage';
import { applySignal, emptyProfile, type Signal } from './engine';

interface TasteState {
  profile: TasteProfile;
  viewCounts: Record<string, number>;
  likes: string[];
  signal: (dish: Dish, s: Signal) => void;
  view: (dishId: string) => void;
  toggleLike: (dish: Dish) => void;
  mute: (kind: string) => void;
  setProfile: (p: TasteProfile) => void;
  reset: () => void;
}

export const useTaste = create<TasteState>()(
  persist(
    (set, get) => ({
      profile: emptyProfile(),
      viewCounts: { ...DEMO_VIEW_COUNTS },
      likes: [],
      signal: (dish, s) => set({ profile: applySignal(get().profile, dish, s) }),
      view: (id) => set({ viewCounts: { ...get().viewCounts, [id]: (get().viewCounts[id] ?? 0) + 1 } }),
      toggleLike: (dish) => {
        const liked = get().likes.includes(dish.id);
        set({ likes: liked ? get().likes.filter((x) => x !== dish.id) : [...get().likes, dish.id] });
        if (!liked) get().signal(dish, 'like');
      },
      mute: (kind) => set({ profile: { ...get().profile, mutedSuggestionKinds: [...new Set([...get().profile.mutedSuggestionKinds, kind])] } }),
      setProfile: (profile) => set({ profile }),
      reset: () => set({ profile: emptyProfile(), viewCounts: { ...DEMO_VIEW_COUNTS }, likes: [] }),
    }),
    {
      name: 'zhar-taste',
      storage: createJSONStorage(() => safeStorage),
      // Storage is async: a «Не предлагать такое» or a like made before rehydration finishes must survive it.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TasteState>;
        if (!p.profile) return { ...current, ...p };
        return {
          ...current,
          ...p,
          profile: { ...p.profile, mutedSuggestionKinds: [...new Set([...p.profile.mutedSuggestionKinds, ...current.profile.mutedSuggestionKinds])] },
          likes: [...new Set([...(p.likes ?? []), ...current.likes])],
        };
      },
    },
  ),
);

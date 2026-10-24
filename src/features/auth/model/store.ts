import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/entities/user/model/types';
import { api } from '@/services';
import { E2E } from '@/shared/config/env';
import { safeStorage } from '@/shared/lib/storage';

interface SessionState {
  token?: string;
  user?: User;
  onboarded: boolean;
  /** Where to go after login (e.g. back to checkout). */
  pendingRoute?: string;
  setSession: (token: string, user: User) => void;
  refreshUser: () => Promise<void>;
  patchUser: (p: Partial<User>) => Promise<void>;
  logout: () => void;
  setOnboarded: (v: boolean) => void;
  setPendingRoute: (r?: string) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      token: undefined,
      user: undefined,
      onboarded: !!E2E.skipOnboarding,
      setSession: (token, user) => set({ token, user }),
      refreshUser: async () => {
        if (!get().token) return;
        const user = await api.user.me();
        set({ user });
      },
      patchUser: async (p) => {
        const user = await api.user.update(p);
        set({ user });
      },
      logout: () => set({ token: undefined, user: undefined }),
      setOnboarded: (onboarded) => set({ onboarded }),
      setPendingRoute: (pendingRoute) => set({ pendingRoute }),
    }),
    { name: 'zhar-session', storage: createJSONStorage(() => safeStorage), partialize: (s) => ({ token: s.token, user: s.user, onboarded: s.onboarded }) },
  ),
);

export const useIsLoggedIn = () => useSession((s) => !!s.token);

/** E2E bootstrap: log in the demo user without the SMS flow. */
export async function bootstrapE2ESession() {
  if (!E2E.loggedIn) return;
  const r = await api.auth.verifyCode('+79215551234', '0000');
  useSession.getState().setSession(r.token, r.user);
}

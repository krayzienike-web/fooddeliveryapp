import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';
import { E2E } from '@/shared/config/env';

/**
 * Storage that never throws: sandboxed iframes, private windows and e2e runs
 * may block or wipe storage — the app must keep working without it.
 */
export const safeStorage: StateStorage = {
  getItem: async (k) => {
    if (E2E.persist === false) return null;
    try {
      return await AsyncStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: async (k, v) => {
    if (E2E.persist === false) return;
    try {
      await AsyncStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: async (k) => {
    try {
      await AsyncStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

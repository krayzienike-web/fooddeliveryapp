import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { dark, light, type Palette } from './tokens';

export * from './tokens';

export type ThemeMode = 'system' | 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  /** Dark-first brand: «system» still defaults to dark unless the OS explicitly asks for light. */
  mode: 'dark',
  setMode: (mode) => set({ mode }),
}));

export function useTheme(): { c: Palette; isDark: boolean } {
  const mode = useThemeStore((s) => s.mode);
  const os = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && os !== 'light');
  return { c: isDark ? dark : light, isDark };
}

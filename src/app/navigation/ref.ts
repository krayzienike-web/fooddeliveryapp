import { createNavigationContainerRef } from '@react-navigation/native';
import { IS_E2E } from '@/shared/config/env';
import type { RootStackParamList } from './types';

/** For navigating from outside React components (global overlays, AI tool calls). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// e2e only: lets tests and visual checks jump straight to a screen (`window.__ZHAR_NAV__.navigate('AR', {...})`).
if (IS_E2E && typeof globalThis !== 'undefined') (globalThis as { __ZHAR_NAV__?: typeof navigationRef }).__ZHAR_NAV__ = navigationRef;

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** For navigating from outside React components (global overlays, AI tool calls). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

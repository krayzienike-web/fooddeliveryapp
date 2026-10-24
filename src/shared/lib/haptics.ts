import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { create } from 'zustand';

/** Haptic map from the guidebook §2.7. Calls are fire-and-forget and never throw. */

interface HapticsPrefs {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export const useHapticsPrefs = create<HapticsPrefs>((set) => ({ enabled: true, setEnabled: (enabled) => set({ enabled }) }));

const run = (fn: () => Promise<unknown>) => {
  if (Platform.OS === 'web' || !useHapticsPrefs.getState().enabled) return;
  fn().catch(() => undefined);
};

export const haptic = {
  /** Add to cart, +1 stepper, free delivery reached, payment success. */
  confirm: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Chips, tabs, segments, wheel ticks. */
  tick: () => run(() => Haptics.selectionAsync()),
  /** Long press preview. */
  longPress: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Swipe threshold crossed (swipe-to-delete, slide-to-pay end). */
  threshold: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  /** Payment / validation error. */
  reject: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Rising pressure for slide-to-pay. */
  soft: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
};

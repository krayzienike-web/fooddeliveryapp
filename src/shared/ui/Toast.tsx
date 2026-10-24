import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { elevation, radius, space, useTheme } from '@/shared/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

interface ToastItem {
  id: number;
  text: string;
  icon?: IconName;
  tone?: 'default' | 'success' | 'error' | 'gold';
  action?: { label: string; onPress: () => void };
}

interface ToastState {
  current: ToastItem | null;
  show: (t: Omit<ToastItem, 'id'>) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  current: null,
  show: (t) => set({ current: { ...t, id: Date.now() } }),
  hide: () => set({ current: null }),
}));

export const toast = (text: string, opts: Omit<ToastItem, 'id' | 'text'> = {}) => useToast.getState().show({ text, ...opts });

export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const cur = useToast((s) => s.current);
  const hide = useToast((s) => s.hide);
  useEffect(() => {
    if (!cur) return;
    const t = setTimeout(hide, cur.action ? 4500 : 2600);
    return () => clearTimeout(t);
  }, [cur, hide]);
  if (!cur) return null;
  const fg = { default: c.textPrimary, success: c.success, error: c.error, gold: c.gold }[cur.tone ?? 'default'];
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space.s, left: space.l, right: space.l, zIndex: 1000 }}>
      <Animated.View
        key={cur.id}
        entering={FadeInUp.springify().stiffness(380).damping(33)}
        exiting={FadeOutUp.duration(160)}
        testID="toast"
        style={[{ flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: c.surfaceRaised, borderRadius: radius.m, paddingHorizontal: space.l, paddingVertical: space.m, minHeight: 52 }, elevation.float]}
      >
        {cur.icon ? <Icon name={cur.icon} size={22} raw={fg} /> : null}
        <Txt v="bodyM" style={{ flex: 1 }}>
          {cur.text}
        </Txt>
        {cur.action ? (
          <PressableScale
            onPress={() => {
              cur.action?.onPress();
              hide();
            }}
            style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: space.s }}
          >
            <Txt v="label" color="accent">
              {cur.action.label}
            </Txt>
          </PressableScale>
        ) : null}
      </Animated.View>
    </View>
  );
}

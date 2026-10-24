import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { motion } from '@/shared/theme';
import { haptic } from '@/shared/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. 0.97 for cards, 0.94 for small controls. */
  pressedScale?: number;
  hapticOnPress?: keyof typeof haptic;
}

/** Press feedback ≤100 ms (guidebook §2.6): quick scale-down, spring back. */
export function PressableScale({ children, style, pressedScale = 0.97, hapticOnPress, onPress, disabled, ...rest }: PressableScaleProps) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => {
        s.value = withTiming(pressedScale, { duration: 90 });
      }}
      onPressOut={() => {
        s.value = withSpring(1, motion.springExpressive);
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic[hapticOnPress]();
        onPress?.(e);
      }}
      style={[a, style, disabled ? { opacity: 0.45 } : null]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

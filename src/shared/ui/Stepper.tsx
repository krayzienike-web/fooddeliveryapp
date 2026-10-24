import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { motion, radius, useTheme } from '@/shared/theme';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function Stepper({ value, onInc, onDec, testID, size = 'm', min = 0, deleteAtOne = false }: { value: number; onInc: () => void; onDec: () => void; testID?: string; size?: 's' | 'm'; min?: number; deleteAtOne?: boolean }) {
  const { c } = useTheme();
  const bump = useSharedValue(1);
  useEffect(() => {
    bump.value = withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, motion.springExpressive));
  }, [value, bump]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const h = size === 's' ? 36 : 44;
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceRaised, borderRadius: radius.full, height: h }}>
      <PressableScale testID={testID ? `${testID}-dec` : undefined} accessibilityLabel="Убрать одну" onPress={onDec} disabled={value <= min} hapticOnPress="tick" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={deleteAtOne && value <= 1 ? 'trash-can-outline' : 'minus'} size={20} />
      </PressableScale>
      <Animated.View style={[{ minWidth: 20, alignItems: 'center' }, a]}>
        <Txt v="titleM" tabular>
          {value}
        </Txt>
      </Animated.View>
      <PressableScale testID={testID ? `${testID}-inc` : undefined} accessibilityLabel="Добавить ещё" onPress={onInc} hapticOnPress="confirm" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={20} />
      </PressableScale>
    </View>
  );
}

import { useEffect, useState } from 'react';
import { ActivityIndicator, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '@/shared/lib/haptics';
import { motion, radius, useTheme } from '@/shared/theme';
import { Icon, PressableScale, Txt } from '@/shared/ui';

const THUMB = 48;

/**
 * Slide-to-pay (C3): drag the thumb to the end — haptics build up along the way.
 * A tap also works (the thumb auto-slides), so it never blocks accessibility or tests.
 */
export function SlideToPay({ label, onConfirm, loading, disabled, testID }: { label: string; onConfirm: () => void; loading?: boolean; disabled?: boolean; testID?: string }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const lastStep = useSharedValue(0);
  const max = Math.max(1, w - THUMB - 8);

  const fire = () => {
    haptic.threshold();
    onConfirm();
  };
  const step = () => haptic.soft();

  const pan = usePanGesture({
    enabled: !disabled && !loading,
    onUpdate: (e) => {
      'worklet';
      x.value = Math.max(0, Math.min(max, e.translationX));
      const s = Math.floor((x.value / max) * 5);
      if (s !== lastStep.value) {
        lastStep.value = s;
        runOnJS(step)();
      }
    },
    onDeactivate: () => {
      'worklet';
      if (x.value > max * 0.86) {
        x.value = withTiming(max, { duration: 120 });
        runOnJS(fire)();
      } else {
        x.value = withSpring(0, motion.springStandard);
      }
      lastStep.value = 0;
    },
  });

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value + THUMB + 4 }));
  const text = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, max * 0.6], [1, 0], Extrapolation.CLAMP) }));

  const tap = () => {
    if (disabled || loading) return;
    x.value = withTiming(max, { duration: 360 }, (done) => {
      if (done) runOnJS(fire)();
    });
  };

  useEffect(() => {
    // payment failed or finished: bring the thumb back
    if (!loading) x.value = withSpring(0, motion.springStandard);
  }, [loading, x]);

  return (
    <PressableScale testID={testID} onPress={tap} disabled={disabled} accessibilityLabel={label} pressedScale={0.99}>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: 56, borderRadius: radius.full, backgroundColor: c.accentTonal, justifyContent: 'center', overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.full, backgroundColor: c.accent }, fill]} />
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }, text]}>
          <Txt v="titleM" color="accent">
            {label}
          </Txt>
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ position: 'absolute', left: 4, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }, thumb]}>
            {loading ? <ActivityIndicator color={c.onAccent} /> : <Icon name="chevron-double-right" raw={c.onAccent} />}
          </Animated.View>
        </GestureDetector>
      </View>
    </PressableScale>
  );
}

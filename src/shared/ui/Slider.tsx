import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { haptic } from '@/shared/lib/haptics';
import { useTheme } from '@/shared/theme';

const THUMB = 28;

/** Stepped slider with a haptic tick per step. Accessible as an adjustable control (±1 step). */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  testID,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  testID?: string;
  label: string;
}) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const pos = useSharedValue(0);
  const start = useSharedValue(0);
  const width = useSharedValue(0);
  const last = useRef(value);
  const toPos = (v: number) => (max === min ? 0 : (Math.min(max, Math.max(min, v)) - min) / (max - min));

  useEffect(() => {
    pos.value = toPos(value);
    last.current = value;
  }, [value, min, max]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (p: number) => {
    const v = Math.min(max, Math.max(min, min + Math.round((p * (max - min)) / step) * step));
    if (v !== last.current) {
      last.current = v;
      haptic.tick();
      onChange(v);
    }
  };

  const pan = usePanGesture({
    onBegin: (e) => {
      'worklet';
      // Tap anywhere on the track jumps there; drag continues from that point.
      const p = Math.min(1, Math.max(0, (e.x - THUMB / 2) / Math.max(1, width.value - THUMB)));
      pos.value = p;
      start.value = p;
      runOnJS(emit)(p);
    },
    onUpdate: (e) => {
      'worklet';
      const p = Math.min(1, Math.max(0, start.value + e.translationX / Math.max(1, width.value - THUMB)));
      pos.value = p;
      runOnJS(emit)(p);
    },
  });

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * Math.max(0, width.value - THUMB) }] }));
  const fill = useAnimatedStyle(() => ({ width: THUMB / 2 + pos.value * Math.max(0, width.value - THUMB) }));

  return (
    <GestureDetector gesture={pan}>
      <View
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
        onLayout={(e) => {
          setW(e.nativeEvent.layout.width);
          width.value = e.nativeEvent.layout.width;
        }}
        style={{ height: 44, justifyContent: 'center' }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceHigh, marginHorizontal: 0 }} />
        <Animated.View style={[{ position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: c.accent }, fill]} />
        {w ? <Animated.View style={[{ position: 'absolute', left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: c.textPrimary, borderWidth: 4, borderColor: c.accent }, thumb]} /> : null}
      </View>
    </GestureDetector>
  );
}

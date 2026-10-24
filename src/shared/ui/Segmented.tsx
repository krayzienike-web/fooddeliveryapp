import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { motion, radius, useTheme } from '@/shared/theme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function Segmented<T extends string>({ items, value, onChange, testID }: { items: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void; testID?: string }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const idx = Math.max(0, items.findIndex((i) => i.id === value));
  const seg = w / items.length;
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(idx * seg, motion.springStandard) }], width: seg }), [idx, seg]);
  return (
    <View testID={testID} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 8)} style={{ flexDirection: 'row', backgroundColor: c.surfaceRaised, borderRadius: radius.full, padding: 4, height: 48 }}>
      {w > 0 ? <Animated.View style={[{ position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: radius.full, backgroundColor: c.surfaceHigh }, a]} /> : null}
      {items.map((it) => (
        <PressableScale
          key={it.id}
          testID={testID ? `${testID}-${it.id}` : undefined}
          accessibilityState={{ selected: it.id === value }}
          onPress={() => onChange(it.id)}
          hapticOnPress="tick"
          pressedScale={0.97}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt v="label" color={it.id === value ? 'textPrimary' : 'textSecondary'}>
            {it.label}
          </Txt>
        </PressableScale>
      ))}
    </View>
  );
}

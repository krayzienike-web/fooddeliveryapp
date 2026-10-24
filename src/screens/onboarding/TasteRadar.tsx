import { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import type { TasteVector } from '@/entities/dish/model/types';
import { TASTE_AXES, TASTE_AXIS_TITLE } from '@/features/recommendations/model/engine';
import { fonts, useTheme } from '@/shared/theme';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

/** «Вкусовая ДНК» radar: 8 taste axes, grows from the centre. */
export function TasteRadar({ vector, size = 300 }: { vector: TasteVector; size?: number }) {
  const { c } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.back(1.4)) });
  }, [t]);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;
  const pt = (i: number, r: number) => {
    const a = (i / TASTE_AXES.length) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const values = TASTE_AXES.map((a) => Math.max(0.12, vector[a]));
  const props = useAnimatedProps(() => ({
    points: values.map((v, i) => {
      const a = (i / values.length) * Math.PI * 2 - Math.PI / 2;
      const r = R * v * t.value;
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    }).join(' '),
  }));
  return (
    <Svg width={size} height={size}>
      {[0.33, 0.66, 1].map((k) => (
        <Polygon key={k} points={TASTE_AXES.map((_, i) => pt(i, R * k).join(',')).join(' ')} fill="none" stroke={c.outline} strokeWidth={1} />
      ))}
      {TASTE_AXES.map((a, i) => {
        const [x, y] = pt(i, R);
        return <Line key={a} x1={cx} y1={cy} x2={x} y2={y} stroke={c.outline} strokeWidth={1} />;
      })}
      <AnimatedPolygon animatedProps={props} fill={c.accent} fillOpacity={0.28} stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" />
      <Circle cx={cx} cy={cy} r={3} fill={c.accent} />
      {TASTE_AXES.map((a, i) => {
        const [lx, ly] = pt(i, R + 24);
        return (
          <SvgText key={a} x={lx} y={ly + 4} fill={vector[a] > 0.6 ? c.textPrimary : c.textTertiary} fontSize={12} fontFamily={fonts.text500} textAnchor="middle">
            {TASTE_AXIS_TITLE[a]}
          </SvgText>
        );
      })}
    </Svg>
  );
}

import { View } from 'react-native';
import type { FloorPlan, FloorTable } from '@/entities/restaurant/model/types';
import { tableState, type TableState } from '@/features/booking/model/booking';
import { haptic } from '@/shared/lib/haptics';
import { radius, useTheme } from '@/shared/theme';
import { Icon, PressableScale, Txt } from '@/shared/ui';

/**
 * Simplified floor plan (guidebook §3.11): free tables outlined, selected filled accent-tonal,
 * busy ones just muted (no alarming red). Too-small tables are hidden in plain sight (very faint).
 */
export function FloorPlanView({
  plan,
  width,
  busy,
  guests,
  selectedId,
  onSelect,
}: {
  plan: FloorPlan;
  width: number;
  busy: string[];
  guests: number;
  selectedId?: string;
  onSelect: (t: FloorTable) => void;
}) {
  const { c } = useTheme();
  const k = width / plan.width;
  const height = plan.height * k;

  const styleFor = (s: TableState) => {
    switch (s) {
      case 'selected':
        return { backgroundColor: c.accentTonal, borderColor: c.accent, borderWidth: 2, opacity: 1 };
      case 'free':
        return { backgroundColor: c.surface, borderColor: c.textPrimary, borderWidth: 1.5, opacity: 1 };
      case 'busy':
        return { backgroundColor: c.surfaceHigh, borderColor: 'transparent', borderWidth: 0, opacity: 0.45 };
      case 'small':
        return { backgroundColor: c.surfaceHigh, borderColor: 'transparent', borderWidth: 0, opacity: 0.2 };
    }
  };

  return (
    <View testID="booking-floor-plan" style={{ width, height, borderRadius: radius.m, backgroundColor: c.surfaceRaised, overflow: 'hidden' }}>
      {plan.decor.map((d, i) => {
        const base = { position: 'absolute' as const, left: d.x * k, top: d.y * k, width: d.w * k, height: d.h * k };
        if (d.kind === 'window') return <View key={i} style={{ ...base, backgroundColor: c.info, opacity: 0.5, borderRadius: 2 }} />;
        if (d.kind === 'plant') return <View key={i} style={{ ...base, backgroundColor: c.success, opacity: 0.35, borderRadius: 999 }} />;
        return (
          <View key={i} style={{ ...base, borderRadius: radius.xs, borderWidth: 1, borderStyle: 'dashed', borderColor: c.outline, alignItems: 'center', justifyContent: 'center' }}>
            {d.kind === 'entrance' ? <Icon name="door-open" size={14} color="textTertiary" /> : null}
            {d.label && d.kind !== 'entrance' ? (
              <Txt v="caption" color="textTertiary" align="center" style={{ fontSize: 10 }}>
                {d.label}
              </Txt>
            ) : null}
          </View>
        );
      })}
      {plan.tables.map((t) => {
        const s = tableState(t, busy, guests, selectedId);
        const round = t.shape === 'round' || t.shape === 'bar';
        const enabled = s === 'free' || s === 'selected';
        return (
          <PressableScale
            key={t.id}
            testID={`booking-table-${t.id}`}
            disabled={!enabled}
            accessibilityLabel={`Стол ${t.label}, ${t.seats} мест${s === 'busy' ? ', занят' : s === 'small' ? ', мало мест' : ''}`}
            accessibilityState={{ selected: s === 'selected', disabled: !enabled }}
            pressedScale={0.9}
            onPress={() => {
              haptic.tick();
              onSelect(t);
            }}
            style={{
              position: 'absolute',
              left: t.x * k,
              top: t.y * k,
              width: t.w * k,
              height: t.h * k,
              borderRadius: round ? 999 : t.shape === 'booth' ? radius.m : radius.xs,
              alignItems: 'center',
              justifyContent: 'center',
              ...styleFor(s),
            }}
          >
            <Txt v="label" color={s === 'selected' ? 'accent' : 'textPrimary'} style={{ fontSize: t.shape === 'bar' ? 10 : 13 }}>
              {t.label}
            </Txt>
            {t.shape !== 'bar' && t.h * k > 34 ? (
              <Txt v="caption" color="textTertiary" style={{ fontSize: 10, lineHeight: 12 }}>
                {t.seats} м.
              </Txt>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

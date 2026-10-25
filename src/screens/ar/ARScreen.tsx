import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/app/navigation/types';
import { defaultOptions, useDish, useMenu } from '@/entities/dish/model/store';
import { useAddToCart } from '@/features/add-to-cart/model/useAddToCart';
import { buildDish, type ArKind } from '@/features/ar/model';
import { rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, Chip, IconButton, Segmented, Txt } from '@/shared/ui';
import { CameraBackdrop } from '@/widgets/dish-3d/CameraBackdrop';
import { Dish3DView } from '@/widgets/dish-3d/Dish3DView';

const SIZE_GROUP = 'pizza-size';
/** A standard dinner plate, for the size hint. */
const PLATE_CM = 27;

/**
 * AR / 3D dish (D3): five flagship dishes built procedurally at real scale.
 * «3D» to turn and take apart; «На столе» puts the dish over the camera at its true size.
 */
export function ARScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProp<RootStackParamList, 'AR'>>();
  const dish = useDish(params.dishId);
  const modifiers = useMenu((s) => s.modifiers);
  const addToCart = useAddToCart();
  const sizes = dish?.modifierGroupIds.includes(SIZE_GROUP) ? modifiers[SIZE_GROUP]?.options.filter((o) => o.sizeCm) ?? [] : [];
  const [sizeId, setSizeId] = useState(modifiers[SIZE_GROUP]?.defaultOptionId ?? 'pz-30');
  const size = sizes.find((o) => o.id === sizeId);
  const [mode, setMode] = useState<'orbit' | 'table'>('orbit');
  const [explode, setExplode] = useState(0);
  const [focusId, setFocusId] = useState<string>();
  const [camState, setCamState] = useState<'camera' | 'photo' | 'asking'>('asking');

  const kind = (dish?.arModel ?? 'burger') as ArKind;
  const model = useMemo(() => buildDish(kind, { sizeCm: size?.sizeCm }), [kind, size?.sizeCm]);
  // Ingredients in the order they appear, merged by title (two patties → one chip).
  const chips = useMemo(() => {
    const seen = new Map<string, true>();
    model.parts.forEach((p) => seen.set(p.title, true));
    return [...seen.keys()];
  }, [model]);

  if (!dish) return <View testID="ar-screen" style={{ flex: 1, backgroundColor: c.bg }} />;
  const price = dish.price + (size?.priceDelta ?? 0);

  const add = () => {
    const optionIds = defaultOptions(dish, modifiers).filter((id) => !sizes.some((s) => s.id === id));
    if (size) optionIds.push(size.id);
    addToCart(dish, null, { optionIds });
    nav.goBack();
  };

  return (
    <View testID="ar-screen" style={{ flex: 1, backgroundColor: c.bg }}>
      {mode === 'table' ? <CameraBackdrop onState={setCamState} /> : null}

      <View style={{ flex: 1 }}>
        <Dish3DView testID="ar-view" model={model} explode={mode === 'table' ? 0 : explode} focusId={focusId} mode={mode} />
      </View>

      {/* Top bar */}
      <View style={{ position: 'absolute', top: insets.top + space.s, left: space.s, right: space.s, flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <IconButton testID="ar-back" icon="arrow-left" label="Назад" tone="glass" onPress={() => nav.goBack()} />
        <View style={{ flex: 1 }}>
          <Segmented
            testID="ar-mode"
            items={[
              { id: 'orbit', label: '3D' },
              { id: 'table', label: 'На столе' },
            ]}
            value={mode}
            onChange={(m) => {
              haptic.tick();
              setMode(m);
            }}
          />
        </View>
      </View>

      {mode === 'table' ? (
        <Animated.View entering={FadeIn} style={{ position: 'absolute', top: insets.top + 72, alignSelf: 'center', paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.full, backgroundColor: c.scrim }}>
          <Txt v="caption" style={{ color: c.onPhoto }} align="center" testID="ar-table-hint">
            {camState === 'camera' ? 'Держите телефон над столом — блюдо в натуральную величину' : camState === 'asking' ? 'Включаем камеру…' : 'Камера недоступна — показываем на столе ресторана'}
          </Txt>
        </Animated.View>
      ) : null}

      {/* Bottom panel */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space.m, paddingBottom: Math.max(insets.bottom, space.l), gap: space.m, backgroundColor: mode === 'table' ? c.scrim : 'transparent' }}>
        <View style={{ paddingHorizontal: space.l }}>
          <Txt v="headline" style={mode === 'table' ? { color: c.onPhoto } : undefined}>
            {dish.name}
          </Txt>
          <Txt v="caption" color={mode === 'table' ? undefined : 'textSecondary'} style={mode === 'table' ? { color: c.onPhoto, opacity: 0.8 } : undefined}>
            {size?.sizeCm
              ? `Ø ${size.sizeCm} см — ${size.sizeCm > PLATE_CM ? 'шире' : size.sizeCm < PLATE_CM - 2 ? 'меньше' : 'как'} обычной тарелки (${PLATE_CM} см)`
              : explode > 0
                ? 'Нажмите на ингредиент — он подсветится'
                : 'Крутите пальцем, щипком — ближе'}
          </Txt>
        </View>

        {sizes.length ? (
          <View style={{ flexDirection: 'row', gap: space.s, paddingHorizontal: space.l }}>
            {sizes.map((o) => (
              <Chip
                key={o.id}
                testID={`ar-size-${o.sizeCm}`}
                label={o.title}
                selected={o.id === sizeId}
                onPress={() => {
                  haptic.tick();
                  setSizeId(o.id);
                }}
              />
            ))}
          </View>
        ) : null}

        {explode > 0 && mode === 'orbit' ? (
          <Animated.View entering={FadeInDown}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }} testID="ar-ingredients">
              {chips.map((title, i) => (
                <Chip
                  key={title}
                  testID={`ar-part-${i}`}
                  small
                  label={title}
                  selected={focusId === title}
                  onPress={() => {
                    haptic.tick();
                    // Re-tapping the same chip pops it again.
                    setFocusId(undefined);
                    requestAnimationFrame(() => setFocusId(title));
                  }}
                />
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.s, paddingHorizontal: space.l }}>
          {mode === 'orbit' ? (
            <Button
              testID="ar-explode"
              kind="tonal"
              icon={explode ? 'arrow-collapse-vertical' : 'arrow-expand-vertical'}
              title={explode ? 'Собрать' : 'Разобрать'}
              onPress={() => {
                haptic.confirm();
                setExplode(explode ? 0 : 1);
                setFocusId(undefined);
              }}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Button testID="ar-add" full title={`В корзину · ${rub(price)}`} onPress={add} />
          </View>
        </View>
      </View>
    </View>
  );
}

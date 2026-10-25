import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePromos } from '@/entities/promo/model/store';
import type { Promo } from '@/entities/promo/model/types';
import { useCart } from '@/features/cart/model/store';
import { radius, space, useTheme } from '@/shared/theme';
import { FoodImage, Header, Icon, PressableScale, Screen, Skeleton, Txt } from '@/shared/ui';

function until(validUntil: string): string {
  const [y, m, d] = validUntil.split('-').map(Number);
  return `до ${d}.${String(m).padStart(2, '0')}${y !== new Date().getFullYear() ? `.${y}` : ''}`;
}

function PromoRow({ p, index, applied }: { p: Promo; index: number; applied: boolean }) {
  const { c } = useTheme();
  const nav = useNavigation();
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
      <PressableScale testID={`promos-item-${p.id}`} onPress={() => nav.navigate('Promo', { id: p.id })} pressedScale={0.98} style={{ flexDirection: 'row', borderRadius: radius.l, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: applied ? c.accent : c.outline }}>
        <FoodImage id={p.image} small style={{ width: 104, height: 112 }} />
        <View style={{ flex: 1, padding: space.m, gap: 2, justifyContent: 'center' }}>
          <Txt v="titleM" numberOfLines={2}>
            {p.title}
          </Txt>
          <Txt v="caption" color="textSecondary" numberOfLines={1}>
            {p.subtitle}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.xs }}>
            <View style={{ paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.xs, borderWidth: 1, borderStyle: 'dashed', borderColor: c.outline }}>
              <Txt v="caption" tabular>
                {p.code}
              </Txt>
            </View>
            <Txt v="caption" color="textTertiary">
              {until(p.validUntil)}
            </Txt>
            {applied ? <Icon name="check-circle" size={16} color="accent" /> : null}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** Promos (A14): personal offers and wheel prizes first, then everything else. Applying happens on the promo card. */
export function PromosScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { list, loaded, load } = usePromos();
  const applied = useCart((s) => s.promo?.code);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const personal = list.filter((p) => p.personal);
  const common = list.filter((p) => !p.personal);

  return (
    <Screen testID="promos-screen">
      <Header title="Акции" onBack={() => nav.goBack()} testID="promos-header" />
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.x4, gap: space.m }}>
        {!loaded ? (
          [0, 1, 2].map((i) => <Skeleton key={i} h={112} r={radius.l} />)
        ) : (
          <>
            {personal.length ? (
              <Txt v="titleL" style={{ marginTop: space.xs }}>
                Для вас
              </Txt>
            ) : null}
            {personal.map((p, i) => (
              <PromoRow key={p.id} p={p} index={i} applied={applied === p.code} />
            ))}
            <Txt v="titleL" style={{ marginTop: space.m }}>
              Для всех
            </Txt>
            {common.map((p, i) => (
              <PromoRow key={p.id} p={p} index={personal.length + i} applied={applied === p.code} />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

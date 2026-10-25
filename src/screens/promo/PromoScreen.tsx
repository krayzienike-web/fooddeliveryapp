import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/app/navigation/types';
import { usePromo, usePromos } from '@/entities/promo/model/store';
import { useCart } from '@/features/cart/model/store';
import { useCartTotals } from '@/features/cart/model/useTotals';
import { useApi } from '@/services';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, FoodImage, Icon, IconButton, PressableScale, Txt, toast } from '@/shared/ui';

/** Promo card (A14): what it gives, conditions, the code — one primary «Применить». */
export function PromoScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Promo'>>();
  const load = usePromos((s) => s.load);
  const p = usePromo(params.id);
  const lines = useCart((s) => s.lines);
  const current = useCart((s) => s.promo);
  const setPromo = useCart((s) => s.setPromo);
  const totals = useCartTotals();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!p) load();
  }, [p, load]);

  if (!p) return <View testID="promo-screen" style={{ flex: 1, backgroundColor: c.bg }} />;
  const isApplied = current?.code === p.code;

  const apply = async () => {
    if (!lines.length) {
      // Nothing to discount yet: keep the promo on the cart, it validates at checkout.
      setPromo(p);
      haptic.confirm();
      toast('Промокод сохранён — применится в корзине', { icon: 'ticket-percent-outline', tone: 'success' });
      nav.goBack();
      nav.navigate('Tabs', { screen: 'Menu' });
      return;
    }
    setBusy(true);
    try {
      const ok = await api.catalog.validatePromo(p.code, totals.itemsTotal);
      setPromo(ok);
      haptic.confirm();
      toast(`«${ok.title}» применён`, { icon: 'ticket-percent-outline', tone: 'success' });
      nav.goBack();
      nav.navigate('Cart');
    } catch (e) {
      haptic.reject();
      toast((e as { message?: string }).message ?? 'Не получилось применить', { icon: 'alert-circle-outline', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="promo-screen" style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={{ height: width * 0.75 }}>
          <FoodImage id={p.image} style={{ width, height: width * 0.75 }} />
          <LinearGradient colors={['transparent', c.bg]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
        </View>
        <View style={{ padding: space.l, gap: space.l, marginTop: -space.x4 }}>
          <View style={{ gap: space.xs }}>
            {p.personal ? (
              <Txt v="label" color="gold" upper>
                Персонально для вас
              </Txt>
            ) : null}
            <Txt v="displayM">{p.title}</Txt>
            <Txt v="bodyL" color="textSecondary">
              {p.description}
            </Txt>
          </View>
          <PressableScale
            testID="promo-code"
            onPress={async () => {
              await Clipboard.setStringAsync(p.code).catch(() => undefined);
              haptic.tick();
              toast('Код скопирован', { icon: 'content-copy' });
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderRadius: radius.m, borderWidth: 1, borderStyle: 'dashed', borderColor: c.accent }}
          >
            <Txt v="headline" color="accent" style={{ flex: 1 }} tabular>
              {p.code}
            </Txt>
            <Icon name="content-copy" size={20} color="accent" />
          </PressableScale>
          <View style={{ gap: space.s }}>
            {p.conditions.map((t) => (
              <View key={t} style={{ flexDirection: 'row', gap: space.s }}>
                <Icon name="check" size={18} color="textSecondary" />
                <Txt v="bodyM" color="textSecondary" style={{ flex: 1 }}>
                  {t}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', top: insets.top + space.s, left: space.s }}>
        <IconButton testID="promo-close" icon="close" label="Закрыть" tone="glass" onPress={() => nav.goBack()} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline }}>
        {isApplied ? (
          <Button testID="promo-applied" kind="tonal" full icon="check" title="Применён · в корзину" onPress={() => nav.navigate('Cart')} />
        ) : (
          <Button testID="promo-apply" full loading={busy} title={lines.length ? 'Применить к корзине' : 'Сохранить и выбрать блюда'} onPress={apply} />
        )}
      </View>
    </View>
  );
}

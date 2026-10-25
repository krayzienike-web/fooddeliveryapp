import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/app/navigation/types';
import { useRestaurant, useRestaurants } from '@/entities/restaurant/model/store';
import { useCart } from '@/features/cart/model/store';
import { loadLabel, openStatus } from '@/features/booking/model/booking';
import { directorNow, useDirector } from '@/features/director/model/store';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, Chip, FoodImage, Icon, IconButton, PressableScale, Txt, toast, type IconName } from '@/shared/ui';
import { BrandMap } from '@/widgets/courier-map/CourierMap';

function Action({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const { c } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.m, borderRadius: radius.m, backgroundColor: c.surfaceRaised }}>
      <Icon name={icon} size={22} color="textPrimary" />
      <Txt v="caption" color="textSecondary" align="center">
        {label}
      </Txt>
    </PressableScale>
  );
}

async function open(url: string, fallback: string) {
  try {
    await Linking.openURL(url);
  } catch {
    toast(fallback, { icon: 'information-outline' });
  }
}

/** Restaurant (A15): gallery, facts, one primary action — book a table. */
export function RestaurantScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Restaurant'>>();
  const load = useRestaurants((s) => s.load);
  const r = useRestaurant(params.id);
  const setMode = useCart((s) => s.setMode);
  const setPickupRestaurant = useCart((s) => s.setPickupRestaurant);
  const director = useDirector();
  const [page, setPage] = useState(0);

  useEffect(() => {
    load();
  }, [load]);

  if (!r) return <View testID="restaurant-screen" style={{ flex: 1, backgroundColor: c.bg }} />;
  const status = openStatus(r, new Date(directorNow(director)));
  const busy = loadLabel(r.load);
  const heroH = Math.round(width * 0.8);

  const pickupHere = () => {
    setMode('pickup');
    setPickupRestaurant(r.id);
    haptic.confirm();
    toast(`Самовывоз из «${r.name}» — готовим за ${r.pickupMinutes} мин`, { icon: 'storefront-outline' });
    nav.navigate('Tabs', { screen: 'Menu' });
  };

  return (
    <View testID="restaurant-screen" style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ height: heroH }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            testID="restaurant-gallery"
          >
            {r.gallery.map((g) => (
              <FoodImage key={g} id={g} style={{ width, height: heroH }} />
            ))}
          </ScrollView>
          <View style={{ position: 'absolute', bottom: space.m, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
            {r.gallery.map((g, i) => (
              <View key={g} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: c.onPhoto, opacity: i === page ? 1 : 0.5 }} />
            ))}
          </View>
        </View>

        <Animated.View entering={FadeInDown.springify()} style={{ padding: space.l, gap: space.l }}>
          <View style={{ gap: space.xs }}>
            <Txt v="displayM">{r.name}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' }}>
              <Icon name="star" size={16} color="gold" />
              <Txt v="label" tabular>
                {r.rating.toFixed(1)}
              </Txt>
              <Txt v="label" color="textTertiary">
                {r.reviewsCount.toLocaleString('ru-RU')} отзывов · средний чек {r.avgCheck.toLocaleString('ru-RU')} ₽
              </Txt>
            </View>
          </View>

          <View style={{ gap: space.s }}>
            <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
              <Icon name="map-marker-outline" size={18} color="textSecondary" />
              <Txt v="bodyM" style={{ flex: 1 }}>
                {r.address} · м. {r.metro}
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
              <Icon name="clock-outline" size={18} color="textSecondary" />
              <Txt v="bodyM" color={status.open ? 'textPrimary' : 'error'}>
                {status.text}
              </Txt>
              <Txt v="bodyM" color="textTertiary">
                · {r.hours}
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
              <View style={{ width: 18, alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c[busy.tone] }} />
              </View>
              <Txt v="bodyM">{busy.text}</Txt>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {r.features.map((f) => (
              <Chip key={f} label={f} small />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Action testID="restaurant-pickup" icon="storefront-outline" label={`Забрать за ${r.pickupMinutes} мин`} onPress={pickupHere} />
            {r.hasBanquetHall ? <Action testID="restaurant-banquet" icon="party-popper" label="Банкет" onPress={() => nav.navigate('Banquet', { restaurantId: r.id })} /> : null}
            <Action testID="restaurant-route" icon="directions" label="Маршрут" onPress={() => open(`https://yandex.ru/maps/?rtext=~${r.point.lat},${r.point.lng}`, 'Маршрут откроется в картах телефона')} />
            <Action testID="restaurant-call" icon="phone-outline" label="Позвонить" onPress={() => open(`tel:${r.phone.replace(/[^\d+]/g, '')}`, r.phone)} />
          </View>

          <View style={{ borderRadius: radius.l, overflow: 'hidden' }}>
            <BrandMap testID="restaurant-map" width={width - space.l * 2} height={180} fit={[r.point]} padding={200} pins={[{ id: r.id, point: r.point, icon: 'fire', tone: 'accent' }]} />
          </View>
        </Animated.View>
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top + space.s, left: space.s }}>
        <IconButton testID="restaurant-back" icon="arrow-left" label="Назад" tone="glass" onPress={() => nav.goBack()} />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline }}>
        <Button testID="restaurant-book" full title="Забронировать стол" onPress={() => nav.navigate('Booking', { restaurantId: r.id })} />
      </View>
    </View>
  );
}

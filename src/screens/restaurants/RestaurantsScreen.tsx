import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { TAB_BAR_SPACE } from '@/app/navigation/TabBar';
import { distanceMeters } from '@/entities/order/model/lifecycle';
import { useRestaurants } from '@/entities/restaurant/model/store';
import type { Restaurant } from '@/entities/restaurant/model/types';
import { useSession } from '@/features/auth/model/store';
import { loadLabel, openStatus } from '@/features/booking/model/booking';
import { directorNow, useDirector } from '@/features/director/model/store';
import { distance } from '@/shared/lib/format';
import { radius, space, useTheme } from '@/shared/theme';
import { FoodImage, Icon, PressableScale, Screen, Segmented, Skeleton, Txt, type IconName } from '@/shared/ui';
import { BrandMap } from '@/widgets/courier-map/CourierMap';

const CITY_CENTER = { lat: 59.9343, lng: 30.3351 };

function Meta({ r, dist, now }: { r: Restaurant; dist?: number; now: Date }) {
  const { c } = useTheme();
  const open = openStatus(r, now);
  const load = loadLabel(r.load);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' }}>
        {dist !== undefined ? (
          <Txt v="label" color="textSecondary">
            {distance(dist)}
          </Txt>
        ) : null}
        <Txt v="label" color={open.open ? 'textSecondary' : 'error'}>
          {open.text}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Icon name="star" size={14} color="gold" />
          <Txt v="label" color="textSecondary" tabular>
            {r.rating.toFixed(1)}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c[load.tone] }} />
        <Txt v="caption" color="textTertiary">
          {load.text}
        </Txt>
      </View>
    </View>
  );
}

function RestaurantCard({ r, dist, now, index }: { r: Restaurant; dist?: number; now: Date; index: number }) {
  const { c } = useTheme();
  const nav = useNavigation();
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <PressableScale testID={`restaurants-item-${r.id}`} onPress={() => nav.navigate('Restaurant', { id: r.id })} pressedScale={0.98} style={{ borderRadius: radius.l, backgroundColor: c.surface, overflow: 'hidden', borderWidth: 1, borderColor: c.outline }}>
        <FoodImage id={r.image} style={{ width: '100%', height: 150 }} />
        <View style={{ padding: space.l, gap: space.s }}>
          <View>
            <Txt v="titleL">{r.name}</Txt>
            <Txt v="bodyM" color="textSecondary" numberOfLines={1}>
              {r.address} · м. {r.metro}
            </Txt>
          </View>
          <Meta r={r} dist={dist} now={now} />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function Shortcut({ icon, title, subtitle, onPress, testID }: { icon: IconName; title: string; subtitle: string; onPress: () => void; testID: string }) {
  const { c } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} style={{ flex: 1, padding: space.m, borderRadius: radius.m, backgroundColor: c.surfaceRaised, gap: space.xs }}>
      <Icon name={icon} size={22} color="accent" />
      <Txt v="titleM">{title}</Txt>
      <Txt v="caption" color="textTertiary" numberOfLines={2}>
        {subtitle}
      </Txt>
    </PressableScale>
  );
}

/** Restaurants (A15): list or map, sorted by distance from the guest's address. */
export function RestaurantsScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const { list, loaded, load } = useRestaurants();
  const user = useSession((s) => s.user);
  const director = useDirector();
  const now = new Date(directorNow(director));
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    load();
  }, [load]);

  const home = user?.addresses.find((a) => a.id === user.defaultAddressId)?.point;
  const sorted = useMemo(() => {
    const from = home ?? CITY_CENTER;
    return list.map((r) => ({ r, d: distanceMeters(from, r.point) })).sort((a, b) => a.d - b.d);
  }, [list, home]);
  const sel = sorted.find((x) => x.r.id === selected) ?? sorted[0];

  return (
    <Screen testID="restaurants-screen">
      <View style={{ paddingHorizontal: space.l, paddingTop: space.s, gap: space.m }}>
        <View>
          <Txt v="displayM">Рестораны</Txt>
          <Txt v="bodyM" color="textSecondary">
            {list.length || 8} в Петербурге{home ? ' · ближайшие к дому' : ''}
          </Txt>
        </View>
        <Segmented
          testID="restaurants-view"
          items={[
            { id: 'list', label: 'Списком' },
            { id: 'map', label: 'На карте' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'list' ? (
        <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: TAB_BAR_SPACE, gap: space.l }}>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Shortcut testID="restaurants-banquet" icon="party-popper" title="Банкет" subtitle="Меню под гостей и бюджет" onPress={() => nav.navigate('Banquet')} />
            <Shortcut testID="restaurants-qr" icon="qrcode-scan" title="За столом" subtitle="Меню по QR и счёт" onPress={() => nav.navigate('QrMenu')} />
            <Shortcut testID="restaurants-gift" icon="gift-outline" title="Подарок" subtitle="Сертификат другу" onPress={() => nav.navigate('Gift')} />
          </View>
          {!loaded
            ? [0, 1, 2].map((i) => <Skeleton key={i} h={260} r={radius.l} />)
            : sorted.map(({ r, d }, i) => <RestaurantCard key={r.id} r={r} dist={home ? d : undefined} now={now} index={i} />)}
        </ScrollView>
      ) : (
        <Animated.View entering={FadeIn} style={{ flex: 1, paddingTop: space.m }}>
          {loaded ? (
            <View style={{ flex: 1, marginHorizontal: space.l, borderRadius: radius.l, overflow: 'hidden' }}>
              <BrandMap
                testID="restaurants-map"
                width={width - space.l * 2}
                height={Math.max(260, (width - space.l * 2) * 1.05)}
                fit={[...list.map((r) => r.point), ...(home ? [home] : [])]}
                padding={40}
                pins={[
                  ...list.map((r) => ({ id: r.id, point: r.point, icon: 'fire' as const, tone: r.id === sel?.r.id ? ('accent' as const) : ('neutral' as const) })),
                  ...(home ? [{ id: 'home', point: home, icon: 'home' as const, tone: 'gold' as const }] : []),
                ]}
              />
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: space.l, gap: space.s, paddingBottom: TAB_BAR_SPACE - 40 }} style={{ flexGrow: 0 }}>
            {sorted.map(({ r, d }) => {
              const active = r.id === sel?.r.id;
              return (
                <PressableScale
                  key={r.id}
                  testID={`restaurants-map-item-${r.id}`}
                  onPress={() => (active ? nav.navigate('Restaurant', { id: r.id }) : setSelected(r.id))}
                  style={{ width: 240, padding: space.m, borderRadius: radius.m, backgroundColor: active ? c.surfaceRaised : c.surface, borderWidth: 1, borderColor: active ? c.accent : c.outline, gap: space.xs }}
                >
                  <Txt v="titleM" numberOfLines={1}>
                    {r.name}
                  </Txt>
                  <Txt v="caption" color="textSecondary" numberOfLines={1}>
                    {r.address}
                  </Txt>
                  <Meta r={r} dist={home ? d : undefined} now={now} />
                  {active ? (
                    <Txt v="label" color="accent">
                      Открыть
                    </Txt>
                  ) : null}
                </PressableScale>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}
    </Screen>
  );
}

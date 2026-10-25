import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TAB_BAR_SPACE } from '@/app/navigation/TabBar';
import { useMenu } from '@/entities/dish/model/store';
import { useRestaurants } from '@/entities/restaurant/model/store';
import type { Booking } from '@/entities/restaurant/model/types';
import { levelFor } from '@/entities/user/model/loyalty';
import { useSession } from '@/features/auth/model/store';
import { normTime, parseYmd } from '@/features/booking/model/booking';
import { useTaste } from '@/features/recommendations/model/store';
import { useApi } from '@/services';
import { dayMonth, maskPhone, plural, points } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, Icon, PressableScale, Screen, Sheet, Txt, type IconName } from '@/shared/ui';
import { DishCard } from '@/widgets/dish-card/DishCard';

function Row({ icon, title, value, onPress, testID, tone }: { icon: IconName; title: string; value?: string; onPress: () => void; testID: string; tone?: 'error' }) {
  const { c } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 56, paddingHorizontal: space.l }}>
      <Icon name={icon} size={22} color={tone ?? 'textSecondary'} />
      <Txt v="bodyL" color={tone ?? 'textPrimary'} style={{ flex: 1 }}>
        {title}
      </Txt>
      {value ? (
        <Txt v="label" color="textTertiary">
          {value}
        </Txt>
      ) : null}
      {tone ? null : <Icon name="chevron-right" size={20} color="textTertiary" />}
      <View style={{ position: 'absolute', left: space.l + 34, right: 0, bottom: 0, height: 1, backgroundColor: c.outline }} />
    </PressableScale>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={{ borderRadius: radius.l, backgroundColor: c.surface, overflow: 'hidden' }}>{children}</View>;
}

/** Profile (A12, guidebook §3.13): a plain list, one line for the balance, no duplicated loyalty card. */
export function ProfileScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const refreshUser = useSession((s) => s.refreshUser);
  const byId = useMenu((s) => s.byId);
  const likes = useTaste((s) => s.likes);
  const restaurants = useRestaurants((s) => s.list);
  const loadRestaurants = useRestaurants((s) => s.load);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sheet, setSheet] = useState<'favorites' | 'bookings' | 'logout' | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      refreshUser();
      loadRestaurants();
      api.booking.myBookings().then((b) => setBookings(b.filter((x) => x.status === 'confirmed')));
    }, [api, user?.id]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!user) {
    return (
      <Screen testID="profile-screen">
        <View style={{ flex: 1, padding: space.l, paddingBottom: TAB_BAR_SPACE, justifyContent: 'center', gap: space.l }}>
          <Icon name="account-circle-outline" size={56} color="textTertiary" />
          <Txt v="displayM">Войдите, чтобы копить баллы и видеть заказы</Txt>
          <Txt v="bodyL" color="textSecondary">
            Номер телефона и код из SMS — без паролей и почты.
          </Txt>
          <Button testID="profile-login" title="Войти по номеру" onPress={() => nav.navigate('Auth', { then: 'Profile' })} />
          <Button testID="profile-settings-guest" kind="ghost" title="Настройки" onPress={() => nav.navigate('Settings')} />
        </View>
      </Screen>
    );
  }

  const level = levelFor(user.levelSpend);
  const favorites = [...new Set([...user.favorites, ...likes])].map((id) => byId[id]).filter(Boolean);
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Screen testID="profile-screen">
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: TAB_BAR_SPACE, gap: space.l }}>
        <Animated.View entering={FadeInDown.springify()} style={{ flexDirection: 'row', alignItems: 'center', gap: space.l, paddingVertical: space.s }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentTonal, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="headline" color="accent">
              {initials}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="displayM" numberOfLines={1}>
              {user.name}
            </Txt>
            <Txt v="bodyM" color="textSecondary">
              {maskPhone(user.phone)}
            </Txt>
          </View>
        </Animated.View>

        <PressableScale testID="profile-loyalty" onPress={() => nav.navigate('Loyalty')} pressedScale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderRadius: radius.l, backgroundColor: c.goldTonal }}>
          <Icon name="star-four-points" size={22} color="gold" />
          <Txt v="titleM" style={{ flex: 1 }}>
            {points(user.points)} · {level.title} {level.cashback}%
          </Txt>
          <Txt v="label" color="gold">
            Бонусы и колесо
          </Txt>
          <Icon name="chevron-right" size={20} color="gold" />
        </PressableScale>

        <Group>
          <Row testID="profile-orders" icon="receipt-text-outline" title="Мои заказы" onPress={() => nav.navigate('Orders')} />
          <Row testID="profile-bookings" icon="table-chair" title="Брони" value={bookings.length ? String(bookings.length) : undefined} onPress={() => setSheet('bookings')} />
          <Row testID="profile-favorites" icon="heart-outline" title="Избранное" value={favorites.length ? String(favorites.length) : undefined} onPress={() => setSheet('favorites')} />
          <Row testID="profile-promos" icon="ticket-percent-outline" title="Акции и промокоды" onPress={() => nav.navigate('Promos')} />
          <Row testID="profile-gift" icon="gift-outline" title="Подарить сертификат" onPress={() => nav.navigate('Gift')} />
        </Group>

        <Group>
          <Row testID="profile-addresses" icon="map-marker-outline" title="Адреса" value={`${user.addresses.length}`} onPress={() => nav.navigate('Address')} />
          <Row testID="profile-cards" icon="credit-card-outline" title="Способы оплаты" value={user.savedCards.map((k) => `•• ${k.last4}`).join(', ')} onPress={() => nav.navigate('Settings')} />
          <Row testID="profile-settings" icon="cog-outline" title="Настройки" onPress={() => nav.navigate('Settings')} />
          <Row testID="profile-help" icon="lifebuoy" title="Помощь" onPress={() => nav.navigate('Support')} />
        </Group>

        <Group>
          <Row testID="profile-logout" icon="logout" title="Выйти" tone="error" onPress={() => setSheet('logout')} />
        </Group>
      </ScrollView>

      <Sheet open={sheet === 'favorites'} onClose={() => setSheet(null)} title="Избранное" testID="profile-favorites-sheet">
        <View style={{ gap: space.s, paddingBottom: space.l }}>
          {favorites.length ? (
            favorites.map((d) => <DishCard key={d.id} dish={d} variant="row" />)
          ) : (
            <Txt v="bodyM" color="textSecondary">
              Отмечайте блюда сердечком в Reels и меню — они появятся здесь.
            </Txt>
          )}
        </View>
      </Sheet>

      <Sheet open={sheet === 'bookings'} onClose={() => setSheet(null)} title="Брони" testID="profile-bookings-sheet">
        <View style={{ gap: space.m, paddingBottom: space.l }}>
          {bookings.length ? (
            bookings.map((b) => {
              const r = restaurants.find((x) => x.id === b.restaurantId);
              return (
                <View key={b.id} style={{ padding: space.m, borderRadius: radius.m, backgroundColor: c.surfaceRaised, gap: 2 }}>
                  <Txt v="titleM">{r?.name}</Txt>
                  <Txt v="bodyM" color="textSecondary">
                    {dayMonth(parseYmd(b.date).getTime())} в {normTime(b.time)} · {b.guests} {plural(b.guests, 'гость', 'гостя', 'гостей')}
                    {b.preorder.length ? ' · есть предзаказ' : ''}
                  </Txt>
                </View>
              );
            })
          ) : (
            <Txt v="bodyM" color="textSecondary">
              Броней пока нет.
            </Txt>
          )}
          <Button
            testID="profile-book-table"
            kind="tonal"
            title="Забронировать стол"
            onPress={() => {
              setSheet(null);
              nav.navigate('Tabs', { screen: 'Restaurants' });
            }}
          />
        </View>
      </Sheet>

      <Sheet open={sheet === 'logout'} onClose={() => setSheet(null)} title="Выйти из аккаунта?" testID="profile-logout-sheet">
        <View style={{ gap: space.s, paddingBottom: space.l }}>
          <Txt v="bodyM" color="textSecondary">
            Корзина и баллы сохранятся — войдите снова по номеру {maskPhone(user.phone)}.
          </Txt>
          <Button
            testID="profile-logout-confirm"
            kind="outline"
            title="Выйти"
            onPress={() => {
              haptic.tick();
              setSheet(null);
              logout();
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

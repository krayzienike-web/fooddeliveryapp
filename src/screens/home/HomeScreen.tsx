import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TAB_BAR_SPACE } from '@/app/navigation/TabBar';
import { useMenu } from '@/entities/dish/model/store';
import { useActiveOrder } from '@/entities/order/model/store';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { useAppContext, useDirector } from '@/features/director/model/store';
import { explainMatch, fitsDiet, rankDishes } from '@/features/recommendations/model/engine';
import { useTaste } from '@/features/recommendations/model/store';
import { usePromos } from '@/entities/promo/model/store';
import { radius, space, useTheme } from '@/shared/theme';
import { FoodImage, Icon, IconButton, PressableScale, Screen, SectionTitle, Segmented, Skeleton, Txt } from '@/shared/ui';
import { ActiveOrderCard } from '@/widgets/order-capsule/ActiveOrderCard';
import { DishCard } from '@/widgets/dish-card/DishCard';
import { PredictionCard, usePrediction } from '@/widgets/prediction/PredictionCard';
import { RepeatStrip } from './RepeatStrip';

const CATEGORY_IMG: Record<string, string> = {
  pizza: 'pz-pepperoni', rolls: 'rl-philadelphia', burgers: 'bg-zhar', wok: 'wk-teriyaki-chicken', soups: 'snd-tom-yum', salads: 'sal-poke-salmon',
  hot: 'hot-ribeye', pasta: 'pa-carbonara', breakfast: 'br-syrniki', snacks: 'snk-wings', desserts: 'des-cheesecake', drinks: 'drk-lemonade-mango', sets: 'set-big-philly', combo: 'cmb-friday',
};

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 17) return 'Добрый день';
  if (hour >= 17 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

export function HomeScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const ctx = useAppContext();
  const status = useMenu((s) => s.status);
  const dishes = useMenu((s) => s.dishes);
  const categories = useMenu((s) => s.categories);
  const profile = useTaste((s) => s.profile);
  const user = useSession((s) => s.user);
  const mode = useCart((s) => s.mode);
  const setMode = useCart((s) => s.setMode);
  const addressId = useCart((s) => s.addressId);
  const active = useActiveOrder();
  const prediction = usePrediction();
  const openDirector = useDirector((s) => s.setOpen);
  const taps = useRef<number[]>([]);
  const [promoIdx, setPromoIdx] = useState(0);

  const address = user?.addresses.find((a) => a.id === addressId) ?? user?.addresses[0];
  // Personalization off (Settings): same diet filter, but ranked by popularity instead of the taste profile.
  const personal = user?.personalization ?? true;
  const picks = useMemo(
    () =>
      personal
        ? rankDishes(dishes.filter((d) => d.categoryId !== 'drinks'), { profile, diet: user?.diet ?? 'none', ctx, seed: 11 }).slice(0, 10)
        : dishes.filter((d) => d.categoryId !== 'drinks' && fitsDiet(d, user?.diet ?? 'none')).sort((a, b) => b.popularity - a.popularity).slice(0, 10),
    [dishes, profile, personal, user?.diet, ctx.hour, ctx.weekday, ctx.weather], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const allPromos = usePromos((st) => st.list);
  const loadPromos = usePromos((st) => st.load);
  useEffect(() => {
    loadPromos();
  }, [loadPromos]);
  // Public promos only on the hero; personal codes and prizes live in «Акции».
  const promos = allPromos.filter((p) => !p.id.startsWith('prize-')).slice(0, 5);
  const colW = (width - space.l * 2 - space.m) / 2;

  const onLogo = () => {
    // Hidden director panel: triple tap on the logo.
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 600), now];
    if (taps.current.length >= 3) {
      taps.current = [];
      openDirector(true);
    }
  };

  return (
    <Screen testID="home-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} showsVerticalScrollIndicator={false}>
        {/* 1. Top bar: brand · address · mode */}
        <View style={{ paddingHorizontal: space.l, paddingTop: space.s, gap: space.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <PressableScale testID="home-logo" onPress={onLogo} pressedScale={0.95} accessibilityLabel="ЖАР">
              <Txt v="headline" style={{ fontFamily: 'Unbounded_800ExtraBold', letterSpacing: 1 }}>
                ЖАР<Txt v="headline" color="accent" style={{ fontFamily: 'Unbounded_800ExtraBold' }}>.</Txt>
              </Txt>
            </PressableScale>
            <PressableScale testID="home-address" onPress={() => (mode === 'pickup' ? nav.navigate('Tabs', { screen: 'Restaurants' }) : nav.navigate('Address'))} style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}>
              <Txt v="caption" color="textTertiary">
                {mode === 'pickup' ? 'Самовывоз из' : 'Доставим на'}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Txt v="titleM" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {mode === 'pickup' ? 'ЖАР на Рубинштейна' : address ? `${address.street}, ${address.house}` : 'Укажите адрес'}
                </Txt>
                <Icon name="chevron-down" size={18} color="textSecondary" />
              </View>
            </PressableScale>
            <IconButton testID="home-search" icon="magnify" label="Поиск" onPress={() => nav.navigate('Search')} />
          </View>
          <Segmented
            testID="home-mode"
            value={mode}
            onChange={(m) => setMode(m)}
            items={[
              { id: 'delivery', label: 'Доставка · 35–45 мин' },
              { id: 'pickup', label: 'Самовывоз · −10%' },
            ]}
          />
        </View>

        {/* 2. Active order OR the single smart suggestion */}
        <View style={{ marginTop: space.l }}>
          {active ? <ActiveOrderCard order={active} /> : prediction ? <PredictionCard prediction={prediction} /> : null}
        </View>

        {/* 3. Repeat */}
        <RepeatStrip />

        {/* 4. Hero promo (manual swipe, no autoplay) */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: space.xxl }}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => setPromoIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {promos.map((p) => (
            <View key={p.id} style={{ width, paddingHorizontal: space.l }}>
              <PressableScale testID={`home-promo-${p.id}`} onPress={() => nav.navigate('Promo', { id: p.id })} pressedScale={0.98}>
                <View style={{ height: 168, borderRadius: radius.l, overflow: 'hidden', backgroundColor: p.tint, flexDirection: 'row' }}>
                  <View style={{ flex: 1, padding: space.l, justifyContent: 'space-between' }}>
                    <View style={{ gap: space.xs }}>
                      {p.personal ? (
                        <Txt v="caption" style={{ color: c.gold }} upper>
                          Персонально
                        </Txt>
                      ) : null}
                      <Txt v="headline" style={{ color: c.onPhoto }} numberOfLines={3}>
                        {p.title}
                      </Txt>
                    </View>
                    <Txt v="caption" style={{ color: c.onPhoto, opacity: 0.8 }} numberOfLines={2}>
                      {p.subtitle}
                    </Txt>
                  </View>
                  <FoodImage id={p.image} style={{ width: 150, height: 168, borderTopLeftRadius: 84, borderBottomLeftRadius: 84 }} />
                </View>
              </PressableScale>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.s }}>
          {promos.map((p, i) => (
            <View key={p.id} style={{ width: i === promoIdx ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === promoIdx ? c.textPrimary : c.outline }} />
          ))}
        </View>

        {/* 5. Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.m, marginTop: space.xl }}>
          {(status === 'ready' ? categories : Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, title: '', emoji: '' }))).map((cat) => (
            <PressableScale key={cat.id} testID={`home-category-${cat.id}`} onPress={() => cat.title && nav.navigate('Tabs', { screen: 'Menu', params: { categoryId: cat.id } })} pressedScale={0.94} style={{ alignItems: 'center', width: 72, gap: space.xs }}>
              {cat.title ? <FoodImage id={CATEGORY_IMG[cat.id] ?? 'pz-pepperoni'} small style={{ width: 64, height: 64, borderRadius: 32 }} /> : <Skeleton w={64} h={64} r={32} />}
              <Txt v="caption" color="textSecondary" numberOfLines={1}>
                {cat.title}
              </Txt>
            </PressableScale>
          ))}
        </ScrollView>

        {/* 6. Reels + AI entry */}
        <View style={{ flexDirection: 'row', gap: space.m, paddingHorizontal: space.l, marginTop: space.xl }}>
          <PressableScale testID="home-reels-entry" onPress={() => nav.navigate('Reels')} style={{ flex: 1 }} pressedScale={0.97}>
            <View style={{ height: 120, borderRadius: radius.l, overflow: 'hidden' }}>
              <FoodImage id="reel-cheese" style={{ position: 'absolute', width: '100%', height: '100%' }} />
              <View style={{ flex: 1, backgroundColor: c.scrim, padding: space.m, justifyContent: 'space-between' }}>
                <Icon name="play-circle" size={28} raw={c.onPhoto} />
                <Txt v="titleM" style={{ color: c.onPhoto }}>
                  Смотреть, как готовим
                </Txt>
              </View>
            </View>
          </PressableScale>
          <PressableScale testID="home-ai-entry" onPress={() => nav.navigate('Tabs', { screen: 'Assistant' })} style={{ flex: 1 }} pressedScale={0.97}>
            <View style={{ height: 120, borderRadius: radius.l, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline, padding: space.m, justifyContent: 'space-between' }}>
              <Icon name="creation" size={26} color="accent" />
              <View>
                <Txt v="titleM">Шеф ИИ</Txt>
                <Txt v="caption" color="textSecondary" numberOfLines={2}>
                  «Ужин на четверых до 3000 ₽»
                </Txt>
              </View>
            </View>
          </PressableScale>
        </View>

        {/* 7. Personal picks */}
        <SectionTitle title={`${greeting(ctx.hour)}${user ? `, ${user.name}` : ''}`} action="Всё меню" onAction={() => nav.navigate('Tabs', { screen: 'Menu' })} testID="home-all-menu" />
        <Txt v="bodyM" color="textSecondary" style={{ paddingHorizontal: space.l, marginTop: -space.s, marginBottom: space.m }}>
          {ctx.weather === 'rain' || ctx.weather === 'storm' ? 'Подобрали согревающее — на улице дождь' : personal && profile.onboarded ? 'Подобрали по вашей вкусовой ДНК' : 'Самое популярное в Петербурге сейчас'}
        </Txt>
        <View testID="for-you-list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.m, paddingHorizontal: space.l }}>
          {status !== 'ready'
            ? Array.from({ length: 4 }, (_, i) => (
                <View key={i} style={{ width: colW, gap: space.s }}>
                  <Skeleton w={colW} h={colW} r={radius.m} />
                  <Skeleton w={colW * 0.8} />
                  <Skeleton w={colW * 0.4} />
                </View>
              ))
            : picks.map((d, i) => (
                <Animated.View key={d.id} entering={FadeInDown.delay(Math.min(i, 6) * 30).springify().stiffness(380).damping(33)}>
                  <DishCard dish={d} width={colW} why={profile.onboarded ? explainMatch(profile.vector, d) : null} />
                </Animated.View>
              ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

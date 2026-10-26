import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type ListViewToken } from 'react-native';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMenu } from '@/entities/dish/model/store';
import type { Dish, Reel } from '@/entities/dish/model/types';
import { useAddToCart } from '@/features/add-to-cart/model/useAddToCart';
import { useCartCount } from '@/features/cart/model/store';
import { useAppContext } from '@/features/director/model/store';
import { scoreDish } from '@/features/recommendations/model/engine';
import { useTaste } from '@/features/recommendations/model/store';
import { useSession } from '@/features/auth/model/store';
import { useApi } from '@/services';
import { rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { motion, radius, space, useTheme } from '@/shared/theme';
import { FoodImage, Icon, IconButton, PressableScale, Txt } from '@/shared/ui';

function KenBurns({ id, active }: { id: string; active: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = active ? withRepeat(withTiming(1.18, { duration: 7000, easing: Easing.inOut(Easing.quad) }), -1, true) : 1;
  }, [active, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { translateY: (s.value - 1) * -60 }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, a]}>
      <FoodImage id={id} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function ReelVideo({ source, poster, active, muted }: { source: number; poster: number; active: boolean; muted: boolean }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={poster} style={StyleSheet.absoluteFill} contentFit="cover" />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}

function ReelItem({ reel, dish, active, height, muted, onToggleMute }: { reel: Reel; dish: Dish; active: boolean; height: number; muted: boolean; onToggleMute: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const addToCart = useAddToCart();
  const likes = useTaste((s) => s.likes);
  const toggleLike = useTaste((s) => s.toggleLike);
  const liked = likes.includes(dish.id);
  const [showTag, setShowTag] = useState(false);
  const [heart, setHeart] = useState(0);
  const lastTap = useRef(0);

  useEffect(() => {
    if (!active) {
      setShowTag(false);
      return;
    }
    const t = setTimeout(() => setShowTag(true), reel.tagAt * 1000);
    return () => clearTimeout(t);
  }, [active, reel.tagAt]);

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) toggleLike(dish);
      haptic.confirm();
      setHeart(now);
    }
    lastTap.current = now;
  };

  return (
    <View testID={`reels-item-${dish.id}`} style={{ height, backgroundColor: c.island }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} accessibilityLabel="Двойной тап — в избранное">
        {reel.video ? <ReelVideo source={reel.video} poster={reel.poster as number} active={active} muted={muted} /> : <KenBurns id={reel.poster as string} active={active} />}
      </Pressable>
      <LinearGradient pointerEvents="none" colors={['transparent', c.scrim, c.scrim]} locations={[0, 0.6, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.42 }} />
      {heart ? (
        <Animated.View key={heart} entering={ZoomIn.springify().stiffness(500).damping(12)} pointerEvents="none" style={{ position: 'absolute', top: height / 2 - 60, alignSelf: 'center' }}>
          <Icon name="heart" size={120} raw={c.accent} />
        </Animated.View>
      ) : null}

      {/* ≤3 actions on the right (guidebook §3.9) */}
      <View style={{ position: 'absolute', right: space.s, bottom: insets.bottom + 150, gap: space.m, alignItems: 'center' }}>
        <IconButton testID="reels-like" icon={liked ? 'heart' : 'heart-outline'} label="В избранное" tone="glass" onPress={() => {
            toggleLike(dish);
            haptic.tick();
          }} />
        <IconButton testID="reels-sound" icon={muted ? 'volume-off' : 'volume-high'} label="Звук" tone="glass" onPress={onToggleMute} />
        <IconButton testID="reels-ar" icon="cube-scan" label="Смотреть в 3D" tone="glass" onPress={() => (dish.arModel ? nav.navigate('AR', { dishId: dish.id }) : nav.navigate('Dish', { id: dish.id }))} />
      </View>

      <View style={{ position: 'absolute', left: space.l, right: 80, bottom: insets.bottom + 132 }}>
        <Txt v="headline" style={{ color: c.onPhoto }} numberOfLines={2}>
          {reel.title}
        </Txt>
      </View>

      {/* One bound dish card, appears when the dish is on screen */}
      {showTag ? (
        <Animated.View entering={FadeInUp.springify().stiffness(380).damping(33)} style={{ position: 'absolute', left: space.l, right: space.l, bottom: insets.bottom + space.xl }}>
          <View testID="reels-dish-card" style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.s, paddingRight: space.xs, borderRadius: radius.l, backgroundColor: c.scrim, borderWidth: 1, borderColor: c.outline }}>
            <PressableScale testID="reels-dish-open" onPress={() => nav.navigate('Dish', { id: dish.id })} pressedScale={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <FoodImage id={dish.image} small style={{ width: 56, height: 56, borderRadius: radius.m }} />
              <View style={{ flex: 1 }}>
                <Txt v="titleM" style={{ color: c.onPhoto }} numberOfLines={1}>
                  {dish.name}
                </Txt>
                <Txt v="label" style={{ color: c.onPhoto, opacity: 0.8 }}>
                  {rub(dish.price)} · заказали {dish.popularity} раз сегодня
                </Txt>
              </View>
            </PressableScale>
            <View>
                <PressableScale testID="reels-add" onPress={() => addToCart(dish, null)} pressedScale={0.88} accessibilityLabel={`Добавить ${dish.name}`} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={26} raw={c.onAccent} />
                </PressableScale>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Food Reels (B2): TikTok-style vertical feed. One video plays, the next is preloaded,
 * the order is re-ranked by your taste as you watch, like and skip.
 */
export function ReelsScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const api = useApi();
  const byId = useMenu((s) => s.byId);
  const profile = useTaste((s) => s.profile);
  const signal = useTaste((s) => s.signal);
  const diet = useSession((s) => s.user?.diet ?? 'none');
  const ctx = useAppContext();
  const count = useCartCount();
  const [reels, setReels] = useState<Reel[]>([]);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const enteredAt = useRef(Date.now());
  const bump = useSharedValue(1);

  useEffect(() => {
    api.catalog.getReels().then(setReels);
  }, [api]);
  useEffect(() => {
    bump.value = withSequence(withTiming(1.3, { duration: 100 }), withSpring(1, motion.springExpressive));
  }, [count, bump]);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  // Personalised order: first reel stays, the rest ranked by taste (with exploration) once.
  const ordered = useMemo(() => {
    if (!reels.length) return [];
    const [first, ...rest] = reels;
    const scored = rest.map((r, i) => ({ r, s: byId[r.dishId] ? scoreDish(byId[r.dishId], { profile, diet, ctx }) + ((i * 7919) % 10) / 40 : -1 }));
    return [first, ...scored.sort((a, b) => b.s - a.s).map((x) => x.r)];
  }, [reels.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const v = viewableItems[0];
    if (v?.index == null) return;
    setIndex((prev) => {
      if (prev !== v.index) {
        const prevReel = orderedRef.current[prev];
        const d = prevReel ? useMenu.getState().byId[prevReel.dishId] : undefined;
        const watched = Date.now() - enteredAt.current;
        if (d) signal(d, watched > 4000 ? 'longView' : watched < 1500 ? 'skip' : 'view');
        enteredAt.current = Date.now();
      }
      return v.index!;
    });
  }).current;
  const orderedRef = useRef<Reel[]>([]);
  orderedRef.current = ordered;

  const renderItem = useCallback(
    ({ item, index: i }: { item: Reel; index: number }) => {
      const dish = byId[item.dishId];
      if (!dish) return <View style={{ height }} />;
      return <ReelItem reel={item} dish={dish} active={i === index} height={height} muted={muted} onToggleMute={() => setMuted((m) => !m)} />;
    },
    [byId, index, height, muted],
  );

  return (
    <View testID="reels-screen" style={{ flex: 1, backgroundColor: c.island }}>
      {/* Render only with data: an empty list shows just the footer, and the browser's scroll anchoring
          then keeps the footer in view once the reels arrive — the feed would open at «Вы посмотрели всё». */}
      {ordered.length ? (
      <FlatList
        data={ordered}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        style={{ overflowAnchor: 'none' } as object}
        ListFooterComponent={
          <View style={{ height, alignItems: 'center', justifyContent: 'center', gap: space.m, padding: space.xl }}>
            <Icon name="check-circle-outline" size={48} raw={c.onPhoto} />
            <Txt v="headline" style={{ color: c.onPhoto }} align="center">
              Вы посмотрели всё новое
            </Txt>
            <Txt v="bodyM" style={{ color: c.onPhoto, opacity: 0.7 }} align="center">
              Завтра снимем ещё — а пока загляните в меню
            </Txt>
          </View>
        }
      />
      ) : null}
      <View style={{ position: 'absolute', top: insets.top + space.s, left: space.s, right: space.s, flexDirection: 'row', alignItems: 'center' }}>
        <IconButton testID="reels-close" icon="close" label="Закрыть" tone="glass" onPress={() => nav.goBack()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt v="label" style={{ color: c.onPhoto }}>
            Смотреть, как готовим
          </Txt>
        </View>
        <Animated.View style={bumpStyle}>
          <IconButton testID="reels-cart" icon="basket-outline" label="Корзина" tone="glass" badge={count || undefined} onPress={() => nav.navigate('Cart')} />
        </Animated.View>
      </View>
    </View>
  );
}

import { CommonActions, useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMenu } from '@/entities/dish/model/store';
import type { Dish } from '@/entities/dish/model/types';
import { useSession } from '@/features/auth/model/store';
import { TASTE_AXES, TASTE_AXIS_TITLE } from '@/features/recommendations/model/engine';
import { useTaste } from '@/features/recommendations/model/store';
import { haptic } from '@/shared/lib/haptics';
import { motion, radius, space, useTheme } from '@/shared/theme';
import { Button, FoodImage, Icon, PressableScale, Screen, Txt } from '@/shared/ui';
import { TasteRadar } from './TasteRadar';

const DECK = ['pz-pepperoni', 'rl-philadelphia', 'snd-tom-yum', 'bg-double-bacon', 'sal-poke-salmon', 'wk-kung-pao', 'des-cheesecake', 'pz-veggie'];

function Card({ dish, onDecide, top }: { dish: Dish; onDecide: (like: boolean) => void; top: boolean }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const decide = (like: boolean) => {
    haptic.tick();
    onDecide(like);
  };
  const pan = usePanGesture({
    enabled: top,
    onUpdate: (e) => {
      'worklet';
      x.value = e.translationX;
    },
    onDeactivate: (e) => {
      'worklet';
      if (Math.abs(e.translationX) > 110 || Math.abs(e.velocityX) > 900) {
        const like = e.translationX > 0;
        x.value = withTiming(like ? width * 1.4 : -width * 1.4, { duration: 220 }, () => runOnJS(decide)(like));
      } else x.value = withSpring(0, motion.springStandard);
    },
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: `${interpolate(x.value, [-width, width], [-18, 18])}deg` }] }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, 120], [0, 1], Extrapolation.CLAMP) }));
  const nopeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-120, -20], [1, 0], Extrapolation.CLAMP) }));
  const cardW = width - space.xl * 2;
  return (
    <GestureDetector gesture={pan}>
      <Animated.View testID={`onboarding-card-${dish.id}`} style={[{ position: 'absolute', width: cardW, height: cardW * 1.22, borderRadius: radius.l, overflow: 'hidden', backgroundColor: c.surface }, style]}>
        <FoodImage id={dish.image} style={{ width: '100%', height: '100%' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, backgroundColor: c.scrim }}>
          <Txt v="headline" style={{ color: c.onPhoto }}>
            {dish.name}
          </Txt>
          <Txt v="bodyM" style={{ color: c.onPhoto, opacity: 0.8 }} numberOfLines={2}>
            {dish.tagline}
          </Txt>
        </View>
        <Animated.View style={[{ position: 'absolute', top: space.xl, left: space.xl, borderWidth: 3, borderColor: c.success, borderRadius: radius.s, paddingHorizontal: space.m, transform: [{ rotate: '-12deg' }] }, likeStyle]}>
          <Txt v="headline" color="success">
            ХОЧУ
          </Txt>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', top: space.xl, right: space.xl, borderWidth: 3, borderColor: c.error, borderRadius: radius.s, paddingHorizontal: space.m, transform: [{ rotate: '12deg' }] }, nopeStyle]}>
          <Txt v="headline" color="error">
            НЕ МОЁ
          </Txt>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * «Вкусовая ДНК» (C1): 8 swipes → an animated taste profile that immediately reshapes Home.
 * Optional and skippable with equal weight (guidebook §3.1).
 */
export function OnboardingScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const byId = useMenu((s) => s.byId);
  const signal = useTaste((s) => s.signal);
  const setProfile = useTaste((s) => s.setProfile);
  const profile = useTaste((s) => s.profile);
  const setOnboarded = useSession((s) => s.setOnboarded);
  const [stage, setStage] = useState<'intro' | 'swipe' | 'result'>('intro');
  const [index, setIndex] = useState(0);
  const deck = DECK.map((id) => byId[id]).filter(Boolean);
  const cardW = width - space.xl * 2;

  const finish = (withProfile: boolean) => {
    if (withProfile) setProfile({ ...useTaste.getState().profile, onboarded: true });
    setOnboarded(true);
    nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs' }] }));
  };

  const decide = (like: boolean) => {
    const d = deck[index];
    if (d) signal(d, like ? 'like' : 'skip');
    if (index + 1 >= deck.length) {
      haptic.confirm();
      setStage('result');
    } else setIndex(index + 1);
  };

  const top3 = useMemo(() => [...TASTE_AXES].sort((a, b) => profile.vector[b] - profile.vector[a]).slice(0, 2), [profile.vector]);

  return (
    <Screen testID="onboarding-screen" edges={['top', 'bottom']}>
      {stage === 'intro' ? (
        <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1, padding: space.xl, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.xl }}>
            {['pz-pepperoni', 'rl-dragon', 'bg-zhar', 'snd-ramen', 'des-lava', 'sal-poke-salmon'].map((id, i) => (
              <Animated.View key={id} entering={FadeInDown.delay(i * 60).springify()}>
                <FoodImage id={id} small style={{ width: (width - space.xl * 2 - space.s * 2) / 3, aspectRatio: 1, borderRadius: radius.m }} />
              </Animated.View>
            ))}
          </View>
          <View style={{ gap: space.m }}>
            <Txt v="displayL" style={{ fontFamily: 'Unbounded_800ExtraBold' }}>
              ЖАР<Txt v="displayL" color="accent" style={{ fontFamily: 'Unbounded_800ExtraBold' }}>.</Txt>
            </Txt>
            <Txt v="displayM">Горячо. Сочно. Рядом.</Txt>
            <Txt v="bodyL" color="textSecondary">
              8 свайпов — и мы поймём ваш вкус. Главная сразу подстроится под вас.
            </Txt>
          </View>
          <View style={{ gap: space.s }}>
            {/* Wait for the menu: an empty deck would jump straight to the radar on the first swipe. */}
            <Button testID="onboarding-primary-cta" title="Найти мой вкус · 15 секунд" loading={deck.length < DECK.length} disabled={deck.length < DECK.length} onPress={() => setStage('swipe')} />
            <Button testID="onboarding-skip" kind="ghost" title="Сразу в меню" onPress={() => finish(false)} />
          </View>
        </Animated.View>
      ) : stage === 'swipe' ? (
        <View style={{ flex: 1, paddingTop: space.l }}>
          <View testID="onboarding-progress" style={{ flexDirection: 'row', gap: 4, paddingHorizontal: space.xl }}>
            {deck.map((d, i) => (
              <View key={d.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < index ? c.accent : i === index ? c.textPrimary : c.surfaceHigh }} />
            ))}
          </View>
          <Txt v="headline" align="center" style={{ marginTop: space.l }}>
            Хочется или нет?
          </Txt>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: cardW, height: cardW * 1.22, alignItems: 'center', justifyContent: 'center' }}>
              {deck
                .slice(index, index + 2)
                .reverse()
                .map((d) => (
                  <Card key={d.id} dish={d} top={d.id === deck[index].id} onDecide={decide} />
                ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.x4, paddingBottom: space.l }}>
            <PressableScale testID="onboarding-option-no" onPress={() => decide(false)} pressedScale={0.85} accessibilityLabel="Не моё" style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={32} color="error" />
            </PressableScale>
            <PressableScale testID="onboarding-option-like" onPress={() => decide(true)} pressedScale={0.85} accessibilityLabel="Хочу" style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="heart" size={30} raw={c.onAccent} />
            </PressableScale>
          </View>
          <Button testID="onboarding-skip" kind="ghost" size="m" title="Пропустить" onPress={() => finish(false)} />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1, padding: space.xl, alignItems: 'center', justifyContent: 'space-between', paddingBottom: Math.max(insets.bottom, space.xl) }}>
          <View style={{ alignItems: 'center', gap: space.s, marginTop: space.xl }}>
            <Txt v="label" color="accent" upper>
              Ваша вкусовая ДНК
            </Txt>
            <Txt v="displayM" align="center">
              {TASTE_AXIS_TITLE[top3[0]]} + {TASTE_AXIS_TITLE[top3[1]].toLowerCase()}
            </Txt>
          </View>
          <TasteRadar vector={profile.vector} size={Math.min(width - space.xl * 2, 340)} />
          <Txt v="bodyL" color="textSecondary" align="center">
            Подобрали главную под вас. Чем больше заказываете и лайкаете, тем точнее подборка.
          </Txt>
          <Button testID="onboarding-primary-cta" full title="Поехали" onPress={() => finish(true)} />
        </Animated.View>
      )}
    </Screen>
  );
}

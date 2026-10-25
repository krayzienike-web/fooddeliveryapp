import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeInDown, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Promo } from '@/entities/promo/model/types';
import { WHEEL_PRIZES, WHEEL_RULES, type WheelPrize } from '@/entities/user/model/loyalty';
import type { LoyaltyState } from '@/entities/user/model/types';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { nextSpinIn, prizeOdds, targetRotation } from '@/features/loyalty/model/wheel';
import { useApi } from '@/services';
import { plural } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { fonts, radius, space, useTheme } from '@/shared/theme';
import { Button, Icon, IconButton, Screen, Sheet, Txt, toast } from '@/shared/ui';
import { Sparks } from '@/widgets/celebration/Sparks';

const N = WHEEL_PRIZES.length;
const A = 360 / N;
const SPIN_MS = 3800;

function sectorPath(cx: number, r: number, i: number) {
  const a0 = ((i * A - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * A - 90) * Math.PI) / 180;
  return `M ${cx} ${cx} L ${cx + r * Math.cos(a0)} ${cx + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cx + r * Math.sin(a1)} Z`;
}

function WheelFace({ size }: { size: number }) {
  const { c } = useTheme();
  const cx = size / 2;
  const r = cx - 6;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cx} r={cx - 1} fill={c.accent} />
      {WHEEL_PRIZES.map((p, i) => {
        const jackpot = p.id === 'p1000';
        const mid = i * A + A / 2;
        const rad = ((mid - 90) * Math.PI) / 180;
        const lr = r * 0.66;
        return (
          <G key={p.id}>
            <Path d={sectorPath(cx, r, i)} fill={jackpot ? c.gold : i % 2 ? c.surfaceHigh : c.surfaceRaised} stroke={c.bg} strokeWidth={1.5} />
            <SvgText
              x={cx + lr * Math.cos(rad)}
              y={cx + lr * Math.sin(rad)}
              fill={jackpot ? c.onAccent : c.textPrimary}
              fontSize={p.short.length > 5 ? 13 : 17}
              fontFamily={fonts.text700}
              textAnchor="middle"
              alignmentBaseline="middle"
              transform={`rotate(${mid} ${cx + lr * Math.cos(rad)} ${cx + lr * Math.sin(rad)})`}
            >
              {p.short}
            </SvgText>
          </G>
        );
      })}
      <Circle cx={cx} cy={cx} r={size * 0.11} fill={c.bg} stroke={c.accent} strokeWidth={3} />
    </Svg>
  );
}

/**
 * «Колесо недели» (C12, guidebook §3.12): all sectors are real prizes, odds are public, the server decides,
 * the wheel only animates to the result. The one screen where particles and overshoot are allowed.
 */
export function WheelScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const user = useSession((s) => s.user);
  const refreshUser = useSession((s) => s.refreshUser);
  const setPromo = useCart((s) => s.setPromo);
  const [state, setState] = useState<LoyaltyState>();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ prize: WheelPrize; promo?: Promo }>();
  const [rules, setRules] = useState(false);
  const rotation = useSharedValue(0);
  const size = Math.min(width - space.x4 * 2, 340);

  useEffect(() => {
    if (user) api.loyalty.state().then(setState);
  }, [api, user]);

  // A haptic tick each time a sector boundary passes the pointer.
  useAnimatedReaction(
    () => Math.floor((((-rotation.value % 360) + 360) % 360) / A),
    (cur, prev) => {
      if (prev !== null && cur !== prev) runOnJS(haptic.tick)();
    },
  );
  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const finish = (r: { prize: WheelPrize; promo?: Promo }) => {
    haptic.confirm();
    setResult(r);
    setSpinning(false);
    refreshUser();
  };

  const spin = async () => {
    if (spinning || !state?.spins) return;
    setSpinning(true);
    setResult(undefined);
    try {
      const r = await api.loyalty.spin();
      setState(r.state);
      const idx = WHEEL_PRIZES.findIndex((p) => p.id === r.prize.id);
      const target = targetRotation(rotation.value, idx, N, 5, Math.random() * 0.6 - 0.3);
      rotation.value = withTiming(target, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(finish)(r);
      });
    } catch (e) {
      setSpinning(false);
      toast((e as { message?: string }).message ?? 'Не получилось', { icon: 'information-outline' });
    }
  };

  // A confident flick on the wheel spins it too.
  const flick = usePanGesture({
    onDeactivate: (e) => {
      'worklet';
      if (Math.abs(e.velocityX) + Math.abs(e.velocityY) > 700) runOnJS(spin)();
    },
  });

  const apply = () => {
    if (!result?.promo) return nav.goBack();
    setPromo(result.promo);
    toast(`«${result.promo.title}» применён к корзине`, { icon: 'ticket-percent-outline', tone: 'success' });
    nav.goBack();
    nav.navigate('Cart');
  };

  const hint = !user
    ? 'Войдите, чтобы крутить'
    : !state
      ? ' '
      : state.spins > 0
        ? `${state.spins} ${plural(state.spins, 'спин', 'спина', 'спинов')} · раз в неделю и за заказ от ${WHEEL_RULES.orderMin} ₽`
        : `Новый спин ${nextSpinIn(state.nextWeeklySpinAt, Date.now()) ?? 'скоро'} или за заказ от ${WHEEL_RULES.orderMin} ₽`;

  return (
    <Screen testID="wheel-screen" edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.s, minHeight: 56 }}>
        <IconButton testID="wheel-close" icon="close" label="Закрыть" tone="none" onPress={() => nav.goBack()} />
        <Txt v="headline" style={{ flex: 1, textAlign: 'center' }}>
          Колесо недели
        </Txt>
        <IconButton testID="wheel-rules" icon="information-outline" label="Правила и шансы" tone="none" onPress={() => setRules(true)} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
        <View style={{ width: size, height: size + 16, alignItems: 'center' }}>
          <GestureDetector gesture={flick}>
            <Animated.View testID="wheel-face" style={[{ width: size, height: size, marginTop: 16 }, wheelStyle]}>
              <WheelFace size={size} />
            </Animated.View>
          </GestureDetector>
          {/* Pointer */}
          <View style={{ position: 'absolute', top: 0, width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 28, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: c.textPrimary }} />
        </View>
        <Txt v="caption" color="textSecondary" align="center" style={{ paddingHorizontal: space.xl }} testID="wheel-hint">
          {hint}
        </Txt>
      </View>

      {result ? (
        <Animated.View entering={FadeInDown.springify().stiffness(500).damping(18)} testID="wheel-result" style={{ marginHorizontal: space.l, padding: space.l, borderRadius: radius.l, backgroundColor: c.surface, borderWidth: 1, borderColor: c.gold, gap: space.s, alignItems: 'center' }}>
          <Txt v="caption" color="gold" upper>
            Ваш приз
          </Txt>
          <Txt v="displayM" align="center">
            {result.prize.title}
          </Txt>
          <Txt v="bodyM" color="textSecondary" align="center">
            {result.promo ? `Сохранили в «Акции» на ${WHEEL_RULES.prizeTtlDays} дней · код ${result.promo.code}` : 'Баллы уже на балансе'}
          </Txt>
        </Animated.View>
      ) : null}

      <View style={{ padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), gap: space.s }}>
        {!user ? (
          <Button testID="wheel-login" full title="Войти" onPress={() => nav.navigate('Auth')} />
        ) : result && !spinning ? (
          <>
            <Button testID="wheel-apply" full title={result.promo ? 'Применить к заказу' : 'Отлично'} onPress={apply} />
            {state?.spins ? <Button testID="wheel-again" kind="ghost" full title="Крутить ещё раз" onPress={spin} /> : null}
          </>
        ) : (
          <Button testID="wheel-spin" full loading={spinning} disabled={!state?.spins} title={state?.spins ? 'Крутить' : 'Спинов пока нет'} onPress={spin} />
        )}
      </View>

      {result && !spinning ? (
        <Animated.View entering={FadeIn} pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          <Sparks count={48} />
        </Animated.View>
      ) : null}

      <Sheet open={rules} onClose={() => setRules(false)} title="Правила и шансы" testID="wheel-rules-sheet">
        <View style={{ gap: space.m, paddingBottom: space.l }}>
          <Txt v="bodyM" color="textSecondary">
            Один спин в неделю и ещё один за каждый заказ от {WHEEL_RULES.orderMin} ₽. Пустых секторов нет. Баллы начисляются сразу, остальные призы действуют {WHEEL_RULES.prizeTtlDays} дней на один заказ.
          </Txt>
          {prizeOdds(WHEEL_PRIZES).map(({ prize, percent }) => (
            <View key={prize.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
              <Icon name={prize.kind === 'points' ? 'star-four-points-outline' : prize.kind === 'dish' ? 'food-outline' : prize.kind === 'free_delivery' ? 'moped-outline' : 'percent-outline'} size={18} color="textSecondary" />
              <Txt v="bodyM" style={{ flex: 1 }}>
                {prize.title}
              </Txt>
              <Txt v="label" color="textSecondary" tabular>
                {String(percent).replace('.', ',')}%
              </Txt>
            </View>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

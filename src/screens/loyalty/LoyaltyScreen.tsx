import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACHIEVEMENTS } from '@/entities/user/model/achievements';
import { levelFor, nextLevel } from '@/entities/user/model/loyalty';
import type { LoyaltyState } from '@/entities/user/model/types';
import { useSession } from '@/features/auth/model/store';
import { nextSpinIn } from '@/features/loyalty/model/wheel';
import { useApi } from '@/services';
import { dayMonth, plural, points, rub } from '@/shared/lib/format';
import { radius, space, useTheme } from '@/shared/theme';
import { Button, Header, Icon, PressableScale, Screen, Skeleton, Txt } from '@/shared/ui';

function Ring({ progress, size = 96 }: { progress: number; size?: number }) {
  const { c } = useTheme();
  const stroke = 8;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceHigh} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={c.gold}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${len} ${len}`}
        strokeDashoffset={len * (1 - Math.max(0.02, Math.min(1, progress)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** Loyalty (A13, J8): level with plain-language progress, balance and history, weekly wheel, achievements. */
export function LoyaltyScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const refreshUser = useSession((s) => s.refreshUser);
  const [state, setState] = useState<LoyaltyState>();

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      refreshUser();
      api.loyalty.state().then(setState);
    }, [api, refreshUser, user?.id]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!user) {
    return (
      <Screen testID="loyalty-screen">
        <Header title="Бонусы" onBack={() => nav.goBack()} testID="loyalty-header" />
        <View style={{ flex: 1, padding: space.l, justifyContent: 'center', gap: space.m }}>
          <Txt v="displayM">Копите баллы с каждого заказа</Txt>
          <Txt v="bodyL" color="textSecondary">
            3–10% возвращается баллами, 1 балл = 1 ₽.
          </Txt>
          <Button testID="loyalty-login" title="Войти по номеру" onPress={() => nav.navigate('Auth')} />
        </View>
      </Screen>
    );
  }

  const level = levelFor(user.levelSpend);
  const next = nextLevel(user.levelSpend);
  const spinHint = state ? (state.spins > 0 ? `${state.spins} ${plural(state.spins, 'спин доступен', 'спина доступно', 'спинов доступно')}` : `Новый спин ${nextSpinIn(state.nextWeeklySpinAt, Date.now()) ?? 'скоро'}`) : '';

  return (
    <Screen testID="loyalty-screen">
      <Header title="Бонусы" onBack={() => nav.goBack()} testID="loyalty-header" />
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.x4, gap: space.xl }}>
        <Animated.View entering={FadeInDown.springify()} testID="loyalty-level" style={{ padding: space.l, borderRadius: radius.l, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline, gap: space.l }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.l }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ring progress={next ? next.progress : 1} />
              <View style={{ position: 'absolute', alignItems: 'center' }}>
                <Txt v="headline" color="gold">
                  {level.cashback}%
                </Txt>
              </View>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="caption" color="textTertiary" upper>
                Уровень
              </Txt>
              <Txt v="displayM">{level.title}</Txt>
              <Txt v="bodyM" color="textSecondary">
                {next ? `Ещё ${rub(next.remaining)} до «${next.level.title}»: кешбэк ${next.level.cashback}%` : 'Максимальный уровень — спасибо, что вы с нами'}
              </Txt>
            </View>
          </View>
          <View style={{ gap: space.xs }}>
            {level.perks.map((p) => (
              <View key={p} style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
                <Icon name="check" size={16} color="gold" />
                <Txt v="bodyM">{p}</Txt>
              </View>
            ))}
            {next ? (
              <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
                <Icon name="lock-outline" size={16} color="textTertiary" />
                <Txt v="bodyM" color="textTertiary">
                  На «{next.level.title}»: {next.level.perks.filter((p) => !level.perks.includes(p)).slice(1, 3).map((p, i) => (i ? p.charAt(0).toLowerCase() + p.slice(1) : p)).join(', ')}
                </Txt>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: space.m }}>
          <View testID="loyalty-balance" style={{ flex: 1, padding: space.l, borderRadius: radius.l, backgroundColor: c.goldTonal, gap: 2 }}>
            <Txt v="caption" color="textSecondary">
              Баланс
            </Txt>
            <Txt v="headline" color="gold" tabular>
              {points(user.points)}
            </Txt>
            <Txt v="caption" color="textTertiary">
              1 балл = 1 ₽, до 30% заказа
            </Txt>
          </View>
          <PressableScale testID="loyalty-wheel" onPress={() => nav.navigate('Wheel')} style={{ flex: 1, padding: space.l, borderRadius: radius.l, backgroundColor: c.surfaceRaised, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Txt v="caption" color="textSecondary" style={{ flex: 1 }}>
                Колесо недели
              </Txt>
              {state?.spins ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
            </View>
            <Icon name="ferris-wheel" size={28} color="accent" />
            <Txt v="caption" color={state?.spins ? 'accent' : 'textTertiary'}>
              {spinHint}
            </Txt>
          </PressableScale>
        </View>

        <View style={{ gap: space.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Txt v="titleL" style={{ flex: 1 }}>
              Достижения
            </Txt>
            <Txt v="label" color="textSecondary">
              {user.streakWeeks} {plural(user.streakWeeks, 'неделя', 'недели', 'недель')} подряд
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} testID="loyalty-achievements">
            {ACHIEVEMENTS.map((a) => {
              const got = user.achievements.includes(a.id);
              return (
                <View key={a.id} accessibilityLabel={`${a.title}${got ? '' : ', ещё не получено'}: ${a.description}`} style={{ width: '23%', flexGrow: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.m, borderRadius: radius.m, backgroundColor: got ? c.surfaceRaised : c.surface, opacity: got ? 1 : 0.45 }}>
                  <Icon name={a.icon} size={26} color={got ? 'gold' : 'textTertiary'} />
                  <Txt v="caption" align="center" numberOfLines={2} style={{ paddingHorizontal: 4 }}>
                    {a.title}
                  </Txt>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ gap: space.m }}>
          <Txt v="titleL">История баллов</Txt>
          <View testID="loyalty-history" style={{ borderRadius: radius.m, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline }}>
            {!state
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={{ padding: space.m }}>
                    <Skeleton h={20} />
                  </View>
                ))
              : state.history.slice(0, 12).map((h, i) => (
                  <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', padding: space.m, borderTopWidth: i ? 1 : 0, borderTopColor: c.outline }}>
                    <View style={{ flex: 1 }}>
                      <Txt v="bodyM" numberOfLines={1}>
                        {h.title}
                      </Txt>
                      <Txt v="caption" color="textTertiary">
                        {dayMonth(h.at)}
                      </Txt>
                    </View>
                    <Txt v="label" tabular color={h.delta > 0 ? 'success' : 'textSecondary'}>
                      {h.delta > 0 ? '+' : '−'}
                      {points(Math.abs(h.delta))}
                    </Txt>
                  </View>
                ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

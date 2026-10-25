import { CommonActions, useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMenu } from '@/entities/dish/model/store';
import type { DietMode } from '@/entities/user/model/types';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import { fitsDiet } from '@/features/recommendations/model/engine';
import { useTaste } from '@/features/recommendations/model/store';
import { haptic, useHapticsPrefs } from '@/shared/lib/haptics';
import { radius, space, useTheme, useThemeStore, type ThemeMode } from '@/shared/theme';
import { Button, Chip, Header, Screen, Segmented, Sheet, Txt, toast } from '@/shared/ui';

const DIETS: Array<{ id: DietMode; title: string }> = [
  { id: 'none', title: 'Без ограничений' },
  { id: 'pp', title: 'ПП' },
  { id: 'veg', title: 'Вегетарианское' },
  { id: 'gluten_free', title: 'Без глютена' },
  { id: 'halal', title: 'Халяль' },
];

function Toggle({ title, subtitle, value, onChange, testID }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; testID: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 56, paddingVertical: space.s }}>
      <View style={{ flex: 1 }}>
        <Txt v="bodyL">{title}</Txt>
        {subtitle ? (
          <Txt v="caption" color="textTertiary">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={title}
        value={value}
        onValueChange={(v) => {
          haptic.tick();
          onChange(v);
        }}
        trackColor={{ false: c.surfaceHigh, true: c.accent }}
        thumbColor={c.textPrimary}
        {...({ activeThumbColor: c.textPrimary } as object)}
      />
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.s }}>
      <Txt v="label" color="textTertiary" upper style={{ paddingHorizontal: space.xs }}>
        {title}
      </Txt>
      <View style={{ paddingHorizontal: space.l, paddingVertical: space.s, borderRadius: radius.l, backgroundColor: c.surface, gap: space.s }}>{children}</View>
    </View>
  );
}

/** Settings (A12 + C15 diet modes): theme, haptics, notifications by type, diet, personalization, account deletion in 2 steps. */
export function SettingsScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const patchUser = useSession((s) => s.patchUser);
  const logout = useSession((s) => s.logout);
  const clearCart = useCart((s) => s.clear);
  const resetTaste = useTaste((s) => s.reset);
  const dishes = useMenu((s) => s.dishes);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const hapticsOn = useHapticsPrefs((s) => s.enabled);
  const setHaptics = useHapticsPrefs((s) => s.setEnabled);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);

  const notif = user?.notifications ?? { status: true, offers: true, news: false };
  const diet = user?.diet ?? 'none';
  const dietCount = useMemo(() => dishes.filter((d) => fitsDiet(d, diet)).length, [dishes, diet]);

  const setNotif = (patch: Partial<typeof notif>) => patchUser({ notifications: { ...notif, ...patch } });

  return (
    <Screen testID="settings-screen">
      <Header title="Настройки" onBack={() => nav.goBack()} testID="settings-header" />
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + space.x4, gap: space.xl }}>
        <Card title="Оформление">
          <View style={{ paddingVertical: space.s, gap: space.s }}>
            <Txt v="bodyL">Тема</Txt>
            <Segmented<ThemeMode>
              testID="settings-theme"
              items={[
                { id: 'dark', label: 'Тёмная' },
                { id: 'light', label: 'Светлая' },
                { id: 'system', label: 'Как в системе' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </View>
          <Toggle testID="settings-haptics" title="Вибрация" subtitle="Тактильный отклик на кнопки и оплату" value={hapticsOn} onChange={setHaptics} />
        </Card>

        {user ? (
          <>
            <Card title="Питание">
              <View style={{ paddingVertical: space.s, gap: space.s }}>
                <Txt v="bodyL">Режим питания</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                  {DIETS.map((d) => (
                    <Chip key={d.id} testID={`settings-diet-${d.id}`} label={d.title} selected={diet === d.id} onPress={() => patchUser({ diet: d.id })} />
                  ))}
                </View>
                <Txt v="caption" color="textTertiary">
                  {diet === 'none' ? 'Показываем всё меню.' : `Меню и подборки покажут ${dishes.length ? dietCount : ''} подходящих блюд, остальное — по поиску.`}
                </Txt>
              </View>
              <Toggle
                testID="settings-personalization"
                title="Персональные подборки"
                subtitle="Главная, Reels и предложения учитывают ваш вкус и историю"
                value={user.personalization}
                onChange={(v) => patchUser({ personalization: v })}
              />
              <Button
                testID="settings-reset-taste"
                kind="ghost"
                size="s"
                title="Сбросить вкусовой профиль"
                onPress={() => {
                  resetTaste();
                  toast('Вкусовой профиль сброшен', { icon: 'refresh' });
                }}
              />
            </Card>

            <Card title="Уведомления">
              <Toggle testID="settings-notif-status" title="Статус заказа" subtitle="Готовим, курьер в пути, у двери" value={notif.status} onChange={(v) => setNotif({ status: v })} />
              <Toggle testID="settings-notif-offers" title="Персональные предложения" subtitle="Не чаще раза в неделю" value={notif.offers} onChange={(v) => setNotif({ offers: v })} />
              <Toggle testID="settings-notif-news" title="Новинки меню" value={notif.news} onChange={(v) => setNotif({ news: v })} />
            </Card>

            <Card title="Оплата">
              {user.savedCards.map((k) => (
                <View key={k.id} style={{ flexDirection: 'row', minHeight: 48, alignItems: 'center' }}>
                  <Txt v="bodyL" style={{ flex: 1 }}>
                    {k.brand === 'mir' ? 'Мир' : k.brand === 'visa' ? 'Visa' : 'Mastercard'} •• {k.last4}
                  </Txt>
                </View>
              ))}
              <Txt v="caption" color="textTertiary" style={{ paddingBottom: space.s }}>
                Новая карта добавляется при оплате заказа. СБП и оплата при получении — тоже там.
              </Txt>
            </Card>
          </>
        ) : null}

        <Card title="О приложении">
          <View style={{ flexDirection: 'row', minHeight: 48, alignItems: 'center' }}>
            <Txt v="bodyL" style={{ flex: 1 }}>
              Язык
            </Txt>
            <Txt v="bodyM" color="textSecondary">
              Русский
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', minHeight: 48, alignItems: 'center' }}>
            <Txt v="bodyL" style={{ flex: 1 }}>
              Версия
            </Txt>
            <Txt v="bodyM" color="textSecondary">
              Демо 1.0
            </Txt>
          </View>
        </Card>

        {user ? <Button testID="settings-delete" kind="ghost" title="Удалить аккаунт" onPress={() => setDeleteStep(1)} /> : null}
      </ScrollView>

      <Sheet open={deleteStep > 0} onClose={() => setDeleteStep(0)} title={deleteStep === 1 ? 'Удалить аккаунт?' : 'Точно удалить?'} testID="settings-delete-sheet">
        <View style={{ gap: space.m, paddingBottom: space.l }}>
          <Txt v="bodyM" color="textSecondary">
            {deleteStep === 1
              ? `Удалим историю заказов, адреса, ${user?.points ?? 0} баллов и вкусовой профиль. Это нельзя отменить.`
              : 'Последний шаг. После удаления можно зарегистрироваться заново по тому же номеру.'}
          </Txt>
          {deleteStep === 1 ? (
            <Button testID="settings-delete-next" kind="outline" title="Продолжить" onPress={() => setDeleteStep(2)} />
          ) : (
            <Button
              testID="settings-delete-confirm"
              kind="outline"
              title="Удалить навсегда"
              onPress={() => {
                haptic.reject();
                setDeleteStep(0);
                clearCart();
                resetTaste();
                logout();
                toast('Аккаунт удалён', { icon: 'account-remove-outline' });
                nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs' }] }));
              }}
            />
          )}
          <Button testID="settings-delete-cancel" title="Оставить аккаунт" onPress={() => setDeleteStep(0)} />
        </View>
      </Sheet>
    </Screen>
  );
}

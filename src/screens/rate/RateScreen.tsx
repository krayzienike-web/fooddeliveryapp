import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import type { RootStackParamList } from '@/app/navigation/types';
import { useMenu } from '@/entities/dish/model/store';
import { useOrder, useOrders } from '@/entities/order/model/store';
import { useSession } from '@/features/auth/model/store';
import { useTaste } from '@/features/recommendations/model/store';
import { useApi } from '@/services';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Button, Chip, FoodImage, Icon, IconButton, PressableScale, Screen, Txt, toast } from '@/shared/ui';

const GOOD = ['Вкусно', 'Горячее', 'Большая порция', 'Быстро', 'Как на фото', 'Вежливый курьер'];
const BAD = ['Остыло', 'Мало начинки', 'Не хватает позиции', 'Опоздание', 'Курьер', 'Упаковка'];

/** One-tap rating (§3.15). ≤3 stars → reasons + «Решить проблему»; 5 stars → AI photo review (C13), ×2 points. */
export function RateScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Rate'>>();
  const api = useApi();
  const order = useOrder(params.id);
  const upsert = useOrders((s) => s.upsert);
  const refresh = useSession((s) => s.refreshUser);
  const byId = useMenu((s) => s.byId);
  const signal = useTaste((s) => s.signal);
  const [stars, setStars] = useState(params.stars ?? 0);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!order) return <Screen testID="rate-screen" />;
  const main = byId[order.lines[0]?.dishId];

  const aiPhoto = () => {
    // Demo stand-in for camera + vision model: the "photo" is the dish, the AI recognises it and drafts the review.
    setPhoto(main?.image ?? null);
    setRecognizing(true);
    haptic.tick();
    setTimeout(() => {
      setRecognizing(false);
      setTags(['Вкусно', 'Как на фото', 'Горячее']);
      setText(`${main?.name} — как всегда огонь: сочно, горячо и красиво. Возьму ещё!`);
      haptic.confirm();
    }, 1400);
  };

  const submit = async () => {
    setBusy(true);
    const o = await api.orders.rate(order.id, stars, tags, text, photo ?? undefined);
    upsert(o);
    refresh();
    order.lines.forEach((l) => byId[l.dishId] && signal(byId[l.dishId], stars >= 4 ? 'like' : 'dislike'));
    haptic.confirm();
    toast(`Спасибо! +${photo ? 100 : 50} баллов`, { icon: 'star-four-points', tone: 'gold' });
    setBusy(false);
    nav.goBack();
  };

  const low = stars > 0 && stars <= 3;
  return (
    <Screen testID="rate-screen">
      <View style={{ flexDirection: 'row', paddingHorizontal: space.s }}>
        <IconButton icon="close" label="Закрыть" tone="none" onPress={() => nav.goBack()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: 140 }}>
        <Txt v="displayM">Как вам заказ?</Txt>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <PressableScale
              key={n}
              testID={`rate-star-${n}`}
              onPress={() => {
                setStars(n);
                setTags([]);
                haptic.tick();
              }}
              pressedScale={0.8}
              style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={stars >= n ? 'star' : 'star-outline'} size={44} color="gold" />
            </PressableScale>
          ))}
        </View>
        {stars ? (
          <Animated.View entering={FadeIn} style={{ gap: space.l }}>
            <Txt v="titleL">{low ? 'Что пошло не так?' : 'Что понравилось?'}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {(low ? BAD : GOOD).map((t) => (
                <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} />
              ))}
            </View>
            {low ? (
              <Button testID="rate-solve" kind="tonal" icon="lifebuoy" title="Решить проблему сейчас" onPress={() => nav.navigate('Support', { orderId: order.id })} />
            ) : (
              <PressableScale testID="rate-ai-photo" onPress={aiPhoto} pressedScale={0.98}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderRadius: radius.m, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline, borderStyle: 'dashed' }}>
                  {photo ? (
                    <Animated.View entering={ZoomIn}>
                      <FoodImage id={photo} small style={{ width: 64, height: 64, borderRadius: radius.s }} />
                    </Animated.View>
                  ) : (
                    <View style={{ width: 64, height: 64, borderRadius: radius.s, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="camera-outline" size={28} color="accent" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Txt v="titleM">{recognizing ? 'Шеф ИИ смотрит на фото…' : photo ? `Узнали: ${main?.name}` : 'Фото блюда — ×2 баллов'}</Txt>
                    <Txt v="caption" color="textSecondary">
                      {photo ? 'Отзыв заполнен за вас — поправьте, если нужно' : 'ИИ узнает блюдо и сам заполнит отзыв'}
                    </Txt>
                  </View>
                </View>
              </PressableScale>
            )}
            <Animated.View entering={FadeInDown}>
              <TextInput
                testID="rate-text"
                value={text}
                onChangeText={setText}
                multiline
                placeholder="Пара слов шефу (необязательно)"
                placeholderTextColor={c.textTertiary}
                style={[typeScale.bodyL, { minHeight: 96, borderRadius: radius.s, backgroundColor: c.surfaceRaised, padding: space.m, color: c.textPrimary, textAlignVertical: 'top' }]}
              />
            </Animated.View>
          </Animated.View>
        ) : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, backgroundColor: c.bg }}>
        <Button testID="rate-primary-cta" title="Отправить" disabled={!stars} loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}

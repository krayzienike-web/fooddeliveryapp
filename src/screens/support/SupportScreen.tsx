import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { RootStackParamList } from '@/app/navigation/types';
import { linePrice } from '@/entities/cart/model/pricing';
import { useMenu } from '@/entities/dish/model/store';
import { useOrders } from '@/entities/order/model/store';
import { useSession } from '@/features/auth/model/store';
import { points, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Button, Chip, FoodImage, Header, Icon, IconButton, PressableScale, Screen, Txt } from '@/shared/ui';

type Msg = { id: number; from: 'bot' | 'me' | 'operator'; text: string };
type Step = 'topic' | 'items' | 'refund' | 'done' | 'operator';

const TOPICS = [
  { id: 'missing', label: 'Не хватает позиции', items: true },
  { id: 'wrong', label: 'Не то блюдо', items: true },
  { id: 'cold', label: 'Холодное или испорчено', items: true },
  { id: 'late', label: 'Опоздание', items: false },
  { id: 'other', label: 'Другое', items: false },
];

/** Support (A18, §3.14): self-service first, auto-compensation in ≤3 taps, a human always one tap away. */
export function SupportScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Support'>>();
  const orders = useOrders((s) => s.orders);
  const byId = useMenu((s) => s.byId);
  const mods = useMenu((s) => s.modifiers);
  const user = useSession((s) => s.user);
  const patchUser = useSession((s) => s.patchUser);
  const order = orders.find((o) => o.id === params?.orderId) ?? orders[0];
  const [step, setStep] = useState<Step>('topic');
  const [picked, setPicked] = useState<string[]>([]);
  const [topic, setTopic] = useState<string>('');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 1, from: 'bot', text: order ? `Здравствуйте! Вижу ваш заказ №${order.number}. Что случилось?` : 'Здравствуйте! Чем помочь?' },
  ]);
  const scroll = useRef<ScrollViewInstance>(null);
  const say = (from: Msg['from'], text: string) => setMsgs((m) => [...m, { id: Date.now() + Math.random(), from, text }]);
  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs, step]);

  const pickTopic = (t: (typeof TOPICS)[number]) => {
    setTopic(t.id);
    say('me', t.label);
    haptic.tick();
    if (t.id === 'late') {
      const late = order?.incidents.find((i) => i.kind === 'courier_delay' || i.kind === 'kitchen_delay');
      setTimeout(() => {
        say('bot', late ? `Мы уже начислили ${points(late.compensationPoints)} за задержку. Добавлю ещё 150 баллов — простите, что заставили ждать.` : 'Простите за ожидание. Начислил 150 баллов — они уже на счёте.');
        compensate(150);
      }, 500);
      return;
    }
    if (t.id === 'other') {
      setTimeout(() => say('bot', 'Опишите, пожалуйста, что произошло, — или позовите человека.'), 400);
      setStep('operator');
      return;
    }
    setTimeout(() => {
      say('bot', 'Отметьте позиции, с которыми проблема:');
      setStep('items');
    }, 400);
  };

  const sum = order ? order.lines.filter((l) => picked.includes(l.key)).reduce((s, l) => s + linePrice(l, byId, mods), 0) : 0;

  const compensate = async (pts: number) => {
    if (user) await patchUser({ points: user.points + pts });
    haptic.confirm();
    setStep('done');
  };

  const refund = async (how: 'points' | 'card') => {
    say('me', how === 'points' ? 'Вернуть баллами сразу' : 'Вернуть на карту');
    if (how === 'points') {
      const pts = Math.round(sum * 1.2);
      setTimeout(() => say('bot', `Готово: +${points(pts)} — это на 20% больше суммы. Баллы уже на счёте.`), 400);
      await compensate(pts);
    } else {
      setTimeout(() => say('bot', `Вернём ${rub(sum)} на карту в течение 5 дней. Номер обращения — ${Math.floor(Math.random() * 90000 + 10000)}.`), 400);
      haptic.confirm();
      setStep('done');
    }
  };

  const send = () => {
    if (!input.trim()) return;
    say('me', input.trim());
    setInput('');
    setTimeout(() => say(step === 'operator' ? 'operator' : 'bot', step === 'operator' ? 'Поняла, сейчас всё решим.' : 'Передал информацию — если нужно, позову оператора.'), 900);
  };

  const callHuman = () => {
    say('me', 'Позвать человека');
    setStep('operator');
    setTimeout(() => say('bot', 'Подключаю оператора. Обычно отвечаем за ~3 минуты.'), 300);
    setTimeout(() => say('operator', `Анна на связи 👋 Уже вижу заказ №${order?.number ?? ''} и всю переписку — рассказывайте.`), 2600);
  };

  return (
    <Screen testID="support-screen">
      <Header title="Поддержка" subtitle={order ? `Заказ №${order.number}` : undefined} onBack={() => nav.goBack()} testID="support-header" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.l, gap: space.m, paddingBottom: space.xl }}>
          {msgs.map((m) => (
            <Animated.View key={m.id} entering={FadeInUp.springify().stiffness(380).damping(33)} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '84%', gap: 2 }}>
              {m.from === 'operator' ? (
                <Txt v="caption" color="textTertiary">
                  Оператор
                </Txt>
              ) : null}
              <View style={{ padding: space.m, borderRadius: radius.m, borderBottomRightRadius: m.from === 'me' ? 4 : radius.m, borderBottomLeftRadius: m.from === 'me' ? radius.m : 4, backgroundColor: m.from === 'me' ? c.accentTonal : c.surface }}>
                <Txt v="bodyL">{m.text}</Txt>
              </View>
            </Animated.View>
          ))}

          {step === 'topic' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              {TOPICS.map((t) => (
                <Chip key={t.id} testID={`support-topic-${t.id}`} label={t.label} onPress={() => pickTopic(t)} />
              ))}
            </View>
          ) : null}

          {step === 'items' && order ? (
            <View style={{ gap: space.s }}>
              {order.lines.map((l) => {
                const d = byId[l.dishId];
                const on = picked.includes(l.key);
                return (
                  <PressableScale key={l.key} testID={`support-item-${l.dishId}`} onPress={() => setPicked(on ? picked.filter((x) => x !== l.key) : [...picked, l.key])} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.s, borderRadius: radius.m, backgroundColor: c.surface, borderWidth: 1, borderColor: on ? c.accent : 'transparent' }}>
                    <FoodImage id={d?.image ?? ''} small style={{ width: 48, height: 48, borderRadius: radius.s }} />
                    <Txt v="bodyM" style={{ flex: 1 }}>
                      {d?.name} × {l.qty}
                    </Txt>
                    <Icon name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} color={on ? 'accent' : 'textTertiary'} />
                  </PressableScale>
                );
              })}
              <Button
                testID="support-items-next"
                kind="tonal"
                title={picked.length ? `Дальше · ${rub(sum)}` : 'Выберите позиции'}
                disabled={!picked.length}
                onPress={() => {
                  say('me', `${TOPICS.find((t) => t.id === topic)?.label}: ${picked.length} поз.`);
                  setTimeout(() => say('bot', 'Как вернуть? Баллами — сразу и на 20% больше. На карту — до 5 дней.'), 300);
                  setStep('refund');
                }}
              />
            </View>
          ) : null}

          {step === 'refund' ? (
            <View style={{ gap: space.s }}>
              <Button testID="support-refund-points" kind="tonal" icon="star-four-points" title={`Баллами сразу · ${points(Math.round(sum * 1.2))}`} onPress={() => refund('points')} />
              <Button testID="support-refund-card" kind="outline" icon="credit-card-outline" title={`На карту · ${rub(sum)}`} onPress={() => refund('card')} />
            </View>
          ) : null}

          {step === 'done' ? (
            <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
              <Chip icon="check" label="Спасибо, всё" onPress={() => nav.goBack()} />
              <Chip label="Есть ещё вопрос" onPress={() => setStep('topic')} />
            </View>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.m, borderTopWidth: 1, borderTopColor: c.outline }}>
          <PressableScale testID="support-human" onPress={callHuman} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: space.s }}>
            <Txt v="label" color="accent">
              Позвать человека
            </Txt>
          </PressableScale>
          <TextInput
            testID="support-input"
            value={input}
            onChangeText={setInput}
            placeholder="Сообщение"
            placeholderTextColor={c.textTertiary}
            onSubmitEditing={send}
            style={[typeScale.bodyL, { flex: 1, minWidth: 0, height: 48, borderRadius: radius.full, backgroundColor: c.surfaceRaised, paddingHorizontal: space.l, color: c.textPrimary }]}
          />
          <IconButton testID="support-send" icon="send" label="Отправить" tone="accent" size={44} onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

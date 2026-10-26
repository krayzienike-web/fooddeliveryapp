import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabParamList } from '@/app/navigation/types';
import { useActiveOrder } from '@/entities/order/model/store';
import { useAssistant, type ChatMessage } from '@/features/ai-assistant/model/store';
import { useVoiceInput } from '@/features/ai-assistant/model/voice';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Chip, Icon, IconButton, PressableScale, Screen, Txt } from '@/shared/ui';
import { AssistantCardView } from '@/widgets/assistant-cards/AssistantCards';

/** Space taken by the floating tab bar on this screen (no cart bar here). */
const TAB_BAR_HEIGHT = 64;

function Dot({ delay }: { delay: number }) {
  const { c } = useTheme();
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.3, { duration: 380 })), -1));
  }, [delay, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }, s]} />;
}

function Thinking() {
  return (
    <View testID="assistant-thinking" accessibilityLabel="Шеф думает" style={{ flexDirection: 'row', gap: 5, paddingVertical: space.s }}>
      <Dot delay={0} />
      <Dot delay={160} />
      <Dot delay={320} />
    </View>
  );
}

function Bubble({ m, last, onChip }: { m: ChatMessage; last: boolean; onChip: (t: string) => void }) {
  const { c } = useTheme();
  if (m.role === 'user') {
    return (
      <Animated.View entering={FadeInDown.duration(220)} style={{ alignSelf: 'flex-end', maxWidth: '84%', backgroundColor: c.accentTonal, borderRadius: radius.l, borderBottomRightRadius: radius.xs, paddingHorizontal: space.l, paddingVertical: space.m }}>
        <Txt v="bodyL">{m.text}</Txt>
      </Animated.View>
    );
  }
  return (
    <View testID="assistant-reply" style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Icon name="creation" size={14} color="accent" />
        <Txt v="caption" color="textTertiary">
          Шеф ИИ
        </Txt>
      </View>
      {m.status === 'thinking' ? <Thinking /> : m.text ? <Txt v="bodyL" testID="assistant-reply-text">{m.text}</Txt> : null}
      {m.cards.map((card, i) => (
        <AssistantCardView key={`${m.id}-${i}`} card={card} />
      ))}
      {last && m.chips.length ? (
        <Animated.View entering={FadeIn.delay(200)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {m.chips.map((t, i) => (
            <Chip key={t} testID={`assistant-chip-${i}`} label={t} small onPress={() => onChip(t)} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Starters({ onPick }: { onPick: (t: string) => void }) {
  const { c } = useTheme();
  const order = useActiveOrder();
  const starters: Array<{ icon: React.ComponentProps<typeof Icon>['name']; text: string }> = [
    { icon: 'account-group-outline', text: 'Ужин на четверых до 3000 ₽' },
    { icon: 'table-chair', text: 'Столик на завтра в 19:00 на двоих' },
    { icon: 'chili-hot', text: 'Хочу что-то острое и сытное' },
    order ? { icon: 'moped-outline', text: 'Где мой заказ?' } : { icon: 'repeat', text: 'Повтори как обычно' },
  ];
  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ gap: space.xl, paddingTop: space.x3 }}>
      <View style={{ gap: space.s }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.accentTonal, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="creation" size={28} color="accent" />
        </View>
        <Txt v="displayM">Что приготовим?</Txt>
        <Txt v="bodyL" color="textSecondary">
          Соберу заказ под компанию и бюджет, забронирую стол или разберусь с доставкой.
        </Txt>
      </View>
      <View style={{ gap: space.s }}>
        {starters.map((s, i) => (
          <Animated.View key={s.text} entering={FadeInDown.delay(80 + i * 60).springify()}>
            <PressableScale testID={`assistant-starter-${i}`} onPress={() => onPick(s.text)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.l, borderRadius: radius.m, backgroundColor: c.surface, borderWidth: 1, borderColor: c.outline }}>
              <Icon name={s.icon} size={22} color="textSecondary" />
              <Txt v="bodyM" style={{ flex: 1 }}>
                {s.text}
              </Txt>
              <Icon name="arrow-top-right" size={18} color="textTertiary" />
            </PressableScale>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

/**
 * «Шеф ИИ» (B1): conversational ordering with generative cards.
 * Real Claude when the build has it (artifact runtime on web, server proxy on Android), offline brain otherwise.
 */
export function AssistantScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const route = useRoute<RouteProp<TabParamList, 'Assistant'>>();
  const insets = useSafeAreaInsets();
  const { messages, busy, mode, send, stop, reset } = useAssistant();
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);

  const submit = useCallback(
    (t: string) => {
      if (!t.trim() || useAssistant.getState().busy) return;
      haptic.tick();
      setDraft('');
      send(t);
    },
    [send],
  );
  const voice = useVoiceInput(submit);

  // A question handed over from Search ("Спросить у Шефа ИИ").
  useFocusEffect(
    useCallback(() => {
      const p = route.params?.prompt;
      if (p) {
        nav.setParams({ prompt: undefined } as never);
        submit(p);
      }
    }, [route.params?.prompt, nav, submit]),
  );

  const bottom = TAB_BAR_HEIGHT + Math.max(insets.bottom, space.s);
  const subtitle = mode === 'claude' ? 'Отвечает Claude' : mode === 'scripted' ? 'Быстрые ответы' : 'Готов помочь';

  return (
    <Screen testID="assistant-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingLeft: space.l, paddingRight: space.s }}>
        <View style={{ flex: 1 }}>
          <Txt v="headline">Шеф ИИ</Txt>
          <Txt v="caption" color="textTertiary" testID="assistant-mode">
            {subtitle}
          </Txt>
        </View>
        {messages.length ? <IconButton testID="assistant-reset" icon="square-edit-outline" label="Новый диалог" tone="none" onPress={reset} /> : null}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          testID="assistant-messages"
          contentContainerStyle={{ paddingHorizontal: space.l, paddingBottom: space.xl, gap: space.xl }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? <Starters onPick={submit} /> : messages.map((m, i) => <Bubble key={m.id} m={m} last={i === messages.length - 1} onChip={submit} />)}
        </ScrollView>
        <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: bottom + space.s }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s, backgroundColor: c.surfaceRaised, borderRadius: radius.l, paddingLeft: space.l, paddingRight: space.xs, paddingVertical: space.xs, borderWidth: 1, borderColor: voice.listening ? c.accent : c.outline }}>
            <TextInput
              testID="assistant-input"
              value={voice.listening ? voice.partial : draft}
              onChangeText={setDraft}
              placeholder={voice.listening ? 'Слушаю…' : 'Спросите Шефа'}
              placeholderTextColor={c.textTertiary}
              multiline
              numberOfLines={1}
              maxLength={500}
              onSubmitEditing={() => submit(draft)}
              blurOnSubmit
              returnKeyType="send"
              style={[typeScale.bodyL, { flex: 1, minWidth: 0, color: c.textPrimary, maxHeight: 120, paddingVertical: space.s, outlineStyle: 'none' } as object]}
            />
            {voice.supported && !draft && !busy ? (
              <IconButton testID="assistant-voice" icon={voice.listening ? 'stop' : 'microphone-outline'} label={voice.listening ? 'Остановить запись' : 'Сказать голосом'} tone="none" onPress={voice.listening ? voice.stop : voice.start} />
            ) : null}
            {busy ? (
              <IconButton testID="assistant-stop" icon="stop" label="Остановить ответ" tone="none" onPress={stop} />
            ) : (
              <PressableScale testID="assistant-send" onPress={() => submit(draft)} disabled={!draft.trim()} accessibilityLabel="Отправить" pressedScale={0.88} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: draft.trim() ? c.accent : c.surfaceHigh }}>
                <Icon name="arrow-up" size={22} raw={draft.trim() ? c.onAccent : c.textTertiary} />
              </PressableScale>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

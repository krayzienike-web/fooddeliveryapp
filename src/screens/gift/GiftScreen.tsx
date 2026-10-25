import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Gift } from '@/entities/table/model/types';
import { useSession } from '@/features/auth/model/store';
import { dateOptions } from '@/features/booking/model/booking';
import { directorNow, useDirector } from '@/features/director/model/store';
import { useApi } from '@/services';
import { maskPhone, phoneDigits, rub } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, type as typeScale, useTheme, type Palette } from '@/shared/theme';
import { Button, Chip, Header, Icon, PressableScale, Screen, Txt, toast, type IconName } from '@/shared/ui';

const AMOUNTS = [1000, 2000, 3000, 5000];
const MESSAGES = ['С днём рождения!', 'Спасибо за всё', 'Просто так — вкусного вечера'];

type Design = Gift['design'];
const DESIGNS: Array<{ id: Design; title: string; icon: IconName; colors: (c: Palette) => [string, string, string] }> = [
  { id: 'fire', title: 'Огонь', icon: 'fire', colors: (c) => [c.accent, c.accentBright, c.gold] },
  { id: 'party', title: 'Праздник', icon: 'party-popper', colors: (c) => [c.gold, c.accent, c.surfaceHigh] },
  { id: 'thanks', title: 'Спасибо', icon: 'heart-outline', colors: (c) => [c.surfaceHigh, c.surfaceRaised, c.accent] },
];

function Certificate({ design, amount, name, message }: { design: Design; amount: number; name: string; message: string }) {
  const { c } = useTheme();
  const d = DESIGNS.find((x) => x.id === design)!;
  return (
    <Animated.View key={design} entering={FadeIn.duration(250)} testID="gift-preview" style={{ borderRadius: radius.l, overflow: 'hidden', aspectRatio: 1.6 }}>
      <LinearGradient colors={d.colors(c)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: space.l, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt v="headline" style={{ color: c.onPhoto, flex: 1, fontFamily: 'Unbounded_800ExtraBold' }}>
            ЖАР
          </Txt>
          <Icon name={d.icon} size={28} raw={c.onPhoto} />
        </View>
        <View>
          <Txt v="displayL" style={{ color: c.onPhoto }} tabular>
            {rub(amount)}
          </Txt>
          <Txt v="bodyM" style={{ color: c.onPhoto, opacity: 0.9 }} numberOfLines={2}>
            {name ? `${name}, ${message.charAt(0).toLowerCase()}${message.slice(1)}` : message}
          </Txt>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

/** Gift certificate (C18): live preview, amount, recipient, message, when — one primary «Подарить». */
export function GiftScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const director = useDirector();
  const dates = useMemo(() => dateOptions(new Date(directorNow(director)), 14), [director.weekday, director.hour]); // eslint-disable-line react-hooks/exhaustive-deps
  const [design, setDesign] = useState<Design>('fire');
  const [amount, setAmount] = useState(3000);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(MESSAGES[0]);
  const [sendAt, setSendAt] = useState('now');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Gift>();

  const digits = phoneDigits(phone);
  const ready = name.trim().length > 0 && digits.length === 10;

  const send = async () => {
    if (!ready) return;
    if (!user) {
      nav.navigate('Auth');
      return;
    }
    setSending(true);
    try {
      const g = await api.gifts.send({ amount, design, recipientName: name.trim(), recipientPhone: `+7${digits}`, message, sendAt });
      haptic.confirm();
      setSent(g);
    } catch (e) {
      haptic.reject();
      toast((e as { message?: string }).message ?? 'Не получилось отправить', { icon: 'alert-circle-outline', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Screen testID="gift-screen" edges={['top', 'bottom']}>
        <Animated.View entering={FadeIn} testID="gift-sent" style={{ flex: 1, padding: space.l, justifyContent: 'space-between' }}>
          <View style={{ gap: space.xl, marginTop: space.xl }}>
            <Animated.View entering={ZoomIn.springify().stiffness(400).damping(16)}>
              <Certificate design={sent.design} amount={sent.amount} name={sent.recipientName} message={sent.message} />
            </Animated.View>
            <View style={{ gap: space.s, alignItems: 'center' }}>
              <Txt v="displayM" align="center">
                Подарок {sent.sendAt === 'now' ? 'отправлен' : 'запланирован'}
              </Txt>
              <Txt v="bodyL" color="textSecondary" align="center">
                {sent.recipientName} получит SMS со ссылкой{sent.sendAt === 'now' ? ' прямо сейчас' : ` ${dates.find((d) => d.date === sent.sendAt)?.label.toLowerCase()} утром`}. Код пригодится, если SMS потеряется:
              </Txt>
              <PressableScale
                testID="gift-code"
                onPress={async () => {
                  await Clipboard.setStringAsync(sent.code).catch(() => undefined);
                  haptic.tick();
                  toast('Код скопирован', { icon: 'content-copy' });
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.l, paddingVertical: space.m, borderRadius: radius.m, borderWidth: 1, borderStyle: 'dashed', borderColor: c.accent }}
              >
                <Txt v="headline" color="accent" tabular>
                  {sent.code}
                </Txt>
                <Icon name="content-copy" size={18} color="accent" />
              </PressableScale>
            </View>
          </View>
          <Button testID="gift-finish" full title="Готово" onPress={() => nav.goBack()} />
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen testID="gift-screen">
      <Header title="Подарок" subtitle="Сертификат на любые блюда ЖАР" onBack={() => nav.goBack()} testID="gift-header" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.l, paddingBottom: insets.bottom + 120, gap: space.xl }}>
          <Certificate design={design} amount={amount} name={name.trim()} message={message} />

          <View style={{ flexDirection: 'row', gap: space.s }}>
            {DESIGNS.map((d) => (
              <Chip key={d.id} testID={`gift-design-${d.id}`} icon={d.icon} label={d.title} selected={design === d.id} onPress={() => setDesign(d.id)} />
            ))}
          </View>

          <View style={{ gap: space.s }}>
            <Txt v="titleL">Сумма</Txt>
            <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
              {AMOUNTS.map((a) => (
                <Chip key={a} testID={`gift-amount-${a}`} label={rub(a)} selected={amount === a} onPress={() => setAmount(a)} />
              ))}
            </View>
          </View>

          <View style={{ gap: space.s }}>
            <Txt v="titleL">Кому</Txt>
            <TextInput
              testID="gift-name"
              value={name}
              onChangeText={setName}
              placeholder="Имя"
              placeholderTextColor={c.textTertiary}
              maxLength={30}
              style={[typeScale.bodyL, { height: 52, paddingHorizontal: space.l, borderRadius: radius.m, backgroundColor: c.surfaceRaised, color: c.textPrimary, outlineStyle: 'none' } as object]}
            />
            <TextInput
              testID="gift-phone"
              value={phone}
              onChangeText={(t) => {
                // Backspace over a mask character («)», «-») must remove the digit before it.
                let d = phoneDigits(t);
                if (t.length < phone.length && d === phoneDigits(phone)) d = d.slice(0, -1);
                setPhone(d ? maskPhone(d) : '');
              }}
              placeholder="+7 (___) ___-__-__"
              placeholderTextColor={c.textTertiary}
              keyboardType="phone-pad"
              style={[typeScale.bodyL, { height: 52, paddingHorizontal: space.l, borderRadius: radius.m, backgroundColor: c.surfaceRaised, color: c.textPrimary, outlineStyle: 'none' } as object]}
            />
          </View>

          <View style={{ gap: space.s }}>
            <Txt v="titleL">Пожелание</Txt>
            <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
              {MESSAGES.map((m, i) => (
                <Chip key={m} testID={`gift-message-${i}`} small label={m} selected={message === m} onPress={() => setMessage(m)} />
              ))}
            </View>
          </View>

          <View style={{ gap: space.s }}>
            <Txt v="titleL">Когда отправить</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
              <Chip testID="gift-when-now" label="Сейчас" selected={sendAt === 'now'} onPress={() => setSendAt('now')} />
              {dates.slice(1).map((d, i) => (
                <Chip key={d.date} testID={`gift-when-${i}`} label={d.label} selected={sendAt === d.date} onPress={() => setSendAt(d.date)} />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, paddingBottom: Math.max(insets.bottom, space.l), backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline }}>
        <Button testID="gift-send" full loading={sending} disabled={!ready} title={ready ? `Подарить · ${rub(amount)}` : 'Укажите имя и телефон'} onPress={send} />
      </View>
    </Screen>
  );
}

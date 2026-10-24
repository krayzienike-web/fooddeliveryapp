import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { RootStackParamList } from '@/app/navigation/types';
import { useSession } from '@/features/auth/model/store';
import { useApi } from '@/services';
import { TEST_SMS_CODE } from '@/shared/config/env';
import { maskPhone, phoneDigits } from '@/shared/lib/format';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Button, IconButton, Screen, Txt, toast } from '@/shared/ui';

export function AuthScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Auth'>>();
  const api = useApi();
  const setSession = useSession((s) => s.setSession);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<TextInputInstance>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const digits = phoneDigits(phone);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.auth.requestCode(`+7${digits}`);
      setResendIn(r.resendInSec);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 250);
    } catch (e) {
      setError((e as { message: string }).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (v: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.auth.verifyCode(`+7${digits}`, v);
      setSession(r.token, r.user);
      haptic.confirm();
      toast(r.isNew ? 'Добро пожаловать в ЖАР! Дарим 300 ₽ на первый заказ' : `С возвращением, ${r.user.name}!`, { icon: 'fire', tone: 'success' });
      if (params?.then === 'Checkout') nav.navigate('Checkout');
      else nav.goBack();
    } catch (e) {
      haptic.reject();
      shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
      setError((e as { message: string }).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="auth-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: space.s }}>
          <IconButton testID="auth-close" icon={step === 'code' ? 'arrow-left' : 'close'} label="Назад" tone="none" onPress={() => (step === 'code' ? setStep('phone') : nav.goBack())} />
        </View>
        <View style={{ flex: 1, paddingHorizontal: space.xl, paddingTop: space.l, gap: space.l }}>
          {step === 'phone' ? (
            <Animated.View entering={FadeIn} style={{ gap: space.l }}>
              <Txt v="displayM">Вход по номеру</Txt>
              <Txt v="bodyL" color="textSecondary">
                Пришлём код в SMS. Нужен, чтобы оформить заказ и копить баллы.
              </Txt>
              <TextInput
                testID="auth-phone-input"
                value={phone}
                onChangeText={(t) => setPhone(maskPhone(t))}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="+7 (___) ___-__-__"
                placeholderTextColor={c.textTertiary}
                autoFocus
                style={[typeScale.titleL, { height: 60, borderRadius: radius.s, borderWidth: 1, borderColor: error ? c.error : c.outline, backgroundColor: c.surfaceRaised, paddingHorizontal: space.l, color: c.textPrimary, fontSize: 22 }]}
              />
              {error ? (
                <Txt v="caption" color="error">
                  {error}
                </Txt>
              ) : (
                <Txt v="caption" color="textTertiary">
                  Демо: любой номер, код — {TEST_SMS_CODE}
                </Txt>
              )}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} style={{ gap: space.l }}>
              <Txt v="displayM">Код из SMS</Txt>
              <Txt v="bodyL" color="textSecondary">
                Отправили на {maskPhone(digits)}
              </Txt>
              <Animated.View style={[{ flexDirection: 'row', gap: space.m }, shakeStyle]}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={{ flex: 1, height: 68, borderRadius: radius.m, borderWidth: 2, borderColor: error ? c.error : code.length === i ? c.accent : c.outline, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt v="displayM" tabular>
                      {code[i] ?? ''}
                    </Txt>
                  </View>
                ))}
                <TextInput
                  ref={codeRef}
                  testID="auth-code-input"
                  value={code}
                  onChangeText={(t) => {
                    const v = t.replace(/\D/g, '').slice(0, 4);
                    setCode(v);
                    setError(null);
                    if (v.length === 4) verify(v);
                  }}
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  maxLength={4}
                  caretHidden
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' }}
                />
              </Animated.View>
              {error ? (
                <Txt testID="auth-code-error" v="caption" color="error">
                  {error}
                </Txt>
              ) : null}
              <Button
                testID="auth-resend"
                kind="ghost"
                size="m"
                title={resendIn > 0 ? `Отправить снова через 0:${String(resendIn).padStart(2, '0')}` : 'Отправить код снова'}
                disabled={resendIn > 0}
                onPress={send}
              />
              <Txt v="caption" color="textTertiary" align="center">
                Для демо введите {TEST_SMS_CODE}
              </Txt>
            </Animated.View>
          )}
        </View>
        {step === 'phone' ? (
          <View style={{ padding: space.xl }}>
            <Button testID="auth-primary-cta" title="Получить код" disabled={digits.length !== 10} loading={busy} onPress={send} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

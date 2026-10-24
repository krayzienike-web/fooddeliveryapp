import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { GeoPoint } from '@/entities/order/model/types';
import { useSession } from '@/features/auth/model/store';
import { useCart } from '@/features/cart/model/store';
import type { ZoneCheck } from '@/services/contracts';
import { useApi } from '@/services';
import { MAP_IMAGES, MAP_META } from '@/shared/assets/mapMeta';
import { haptic } from '@/shared/lib/haptics';
import { rub } from '@/shared/lib/format';
import { elevation, motion, radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Button, Chip, Icon, IconButton, PressableScale, Screen, Txt, toast } from '@/shared/ui';
import { project } from '@/widgets/courier-map/CourierMap';

const SCALE = 0.9;
const unproject = (x: number, y: number): GeoPoint => {
  const wx = x + MAP_META.originX;
  const wy = y + MAP_META.originY;
  const n = 256 * 2 ** MAP_META.zoom;
  const lng = (wx / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * wy) / n))) * 180) / Math.PI;
  return { lat, lng };
};

export function AddressScreen() {
  const { c, isDark } = useTheme();
  const nav = useNavigation();
  const api = useApi();
  const { width } = useWindowDimensions();
  const user = useSession((s) => s.user);
  const refreshUser = useSession((s) => s.refreshUser);
  const setAddress = useCart((s) => s.setAddress);
  const mapH = 300;
  const start = project({ lat: 59.9311, lng: 30.3609 });
  // map offset = where the map's (0,0) sits relative to the viewport, so the pin (viewport centre) points at `centre`
  const ox = useSharedValue(width / 2 - start.x * SCALE);
  const oy = useSharedValue(mapH / 2 - start.y * SCALE);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const pinLift = useSharedValue(0);
  const [center, setCenter] = useState<GeoPoint>({ lat: 59.9311, lng: 30.3609 });
  const [street, setStreet] = useState<{ street: string; house: string } | null>(null);
  const [zone, setZone] = useState<ZoneCheck | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof api.geo.suggest>>>([]);
  const [form, setForm] = useState({ apartment: '', entrance: '', floor: '', intercom: '', comment: '', label: 'Дом' });

  const resolve = async (p: GeoPoint) => {
    setCenter(p);
    const [r, z] = await Promise.all([api.geo.reverse(p), api.geo.checkZone(p)]);
    setStreet(r);
    setZone(z);
  };
  useEffect(() => {
    resolve(center);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => api.geo.suggest(query).then(setSuggestions), 150);
    return () => clearTimeout(t);
  }, [query, api]);

  const settle = (x: number, y: number) => {
    haptic.tick();
    resolve(unproject((width / 2 - x) / SCALE, (mapH / 2 - y) / SCALE));
  };

  const pan = usePanGesture({
    onBegin: () => {
      'worklet';
      pinLift.value = withSpring(-14, motion.springExpressive);
      baseX.value = ox.value;
      baseY.value = oy.value;
    },
    onUpdate: (e) => {
      'worklet';
      ox.value = baseX.value + e.translationX;
      oy.value = baseY.value + e.translationY;
    },
    onDeactivate: () => {
      'worklet';
      pinLift.value = withSequence(withTiming(4, { duration: 120 }), withSpring(0, motion.springExpressive));
      runOnJS(settle)(ox.value, oy.value);
    },
  });

  const mapStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ox.value }, { translateY: oy.value }] }));
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pinLift.value }] }));

  const goTo = (p: GeoPoint) => {
    const q = project(p);
    ox.value = withSpring(width / 2 - q.x * SCALE, motion.springCalm);
    oy.value = withSpring(mapH / 2 - q.y * SCALE, motion.springCalm);
    resolve(p);
  };

  const save = async () => {
    if (!street) return;
    if (!user) {
      toast('Войдите, чтобы сохранить адрес', { icon: 'account-outline', action: { label: 'Войти', onPress: () => nav.navigate('Auth') } });
      return;
    }
    await api.user.addAddress({ label: form.label, street: street.street, house: street.house, apartment: form.apartment, entrance: form.entrance, floor: form.floor, intercom: form.intercom, comment: form.comment, point: center });
    await refreshUser();
    const u = useSession.getState().user;
    const added = u?.addresses[u.addresses.length - 1];
    if (added) setAddress(added.id);
    haptic.confirm();
    toast('Адрес сохранён', { icon: 'map-marker-check', tone: 'success' });
    nav.goBack();
  };

  const field = (key: keyof typeof form, placeholder: string, flex = 1, keyboard: 'default' | 'number-pad' = 'default') => (
    <TextInput
      testID={`address-${key}`}
      value={form[key]}
      onChangeText={(t) => setForm({ ...form, [key]: t })}
      placeholder={placeholder}
      placeholderTextColor={c.textTertiary}
      keyboardType={keyboard}
      style={[typeScale.bodyL, { flex, height: 52, borderRadius: radius.s, backgroundColor: c.surfaceRaised, paddingHorizontal: space.m, color: c.textPrimary }]}
    />
  );

  return (
    <Screen testID="address-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ height: mapH, overflow: 'hidden', backgroundColor: c.map.land }}>
          <GestureDetector gesture={pan}>
            <Animated.View style={[{ position: 'absolute', width: MAP_META.width * SCALE, height: MAP_META.height * SCALE }, mapStyle]}>
              <Image source={isDark ? MAP_IMAGES.dark : MAP_IMAGES.light} style={{ width: '100%', height: '100%' }} contentFit="fill" />
            </Animated.View>
          </GestureDetector>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: width / 2 - 20, top: mapH / 2 - 46, alignItems: 'center' }, pinStyle]}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg }}>
              <Icon name="home" size={20} raw={c.onAccent} />
            </View>
            <View style={{ width: 3, height: 10, backgroundColor: c.accent }} />
          </Animated.View>
          <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - 4, top: mapH / 2 - 2, width: 8, height: 4, borderRadius: 4, backgroundColor: c.overlay }} />
          <View style={{ position: 'absolute', top: space.s, left: space.s }}>
            <IconButton testID="address-back" icon="arrow-left" label="Назад" tone="glass" onPress={() => nav.goBack()} />
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.l, gap: space.m, paddingBottom: 140 }}>
          <View style={[{ marginTop: -space.x4, borderRadius: radius.l, backgroundColor: c.surface, padding: space.l, gap: space.s }, elevation.float]}>
            <Txt v="caption" color="textTertiary">
              Передвиньте карту или найдите адрес
            </Txt>
            <Txt testID="address-current" v="titleL">
              {street ? `${street.street}, ${street.house}` : 'Уточните точку на карте'}
            </Txt>
            {zone ? (
              <Txt testID="address-zone" v="caption" color={zone.inZone ? 'success' : 'error'}>
                {zone.inZone ? `В зоне доставки · ${zone.etaMinutes[0]}–${zone.etaMinutes[1]} мин · от ${rub(zone.minOrder)}` : 'Сюда пока не доставляем — можно забрать самовывозом'}
              </Txt>
            ) : null}
          </View>

          <TextInput
            testID="address-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Улица и дом, например «Марата 25»"
            placeholderTextColor={c.textTertiary}
            style={[typeScale.bodyL, { height: 52, borderRadius: radius.full, backgroundColor: c.surfaceRaised, paddingHorizontal: space.l, color: c.textPrimary }]}
          />
          {suggestions.map((s) => (
            <PressableScale
              key={s.title}
              testID={`address-suggestion-${s.house}`}
              onPress={() => {
                setQuery('');
                setSuggestions([]);
                goTo(s.point);
              }}
              style={{ flexDirection: 'row', gap: space.m, alignItems: 'center', minHeight: 52 }}
            >
              <Icon name="map-marker-outline" color="textSecondary" />
              <View style={{ flex: 1 }}>
                <Txt v="bodyL">{s.title}</Txt>
                <Txt v="caption" color="textTertiary">
                  {s.subtitle}
                </Txt>
              </View>
            </PressableScale>
          ))}

          <View style={{ flexDirection: 'row', gap: space.s }}>
            {['Дом', 'Работа', 'Друзья'].map((l) => (
              <Chip key={l} small label={l} selected={form.label === l} onPress={() => setForm({ ...form, label: l })} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            {field('apartment', 'Кв./офис', 1, 'number-pad')}
            {field('entrance', 'Подъезд', 1, 'number-pad')}
            {field('floor', 'Этаж', 1, 'number-pad')}
          </View>
          {field('intercom', 'Домофон / код двери')}
          {field('comment', 'Как пройти: арка, двор-колодец, ворота')}
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.l, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.outline }}>
          <Button testID="address-primary-cta" title={zone && !zone.inZone ? 'Сохранить для самовывоза' : 'Доставить сюда'} disabled={!street} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

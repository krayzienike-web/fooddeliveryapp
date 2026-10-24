import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Platform, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartBar } from '@/widgets/cart-bar/CartBar';
import { motion, radius, space, useTheme } from '@/shared/theme';
import { Icon, type IconName, PressableScale, Txt } from '@/shared/ui';

const ITEMS: Record<string, { label: string; icon: IconName; iconActive: IconName; testID: string }> = {
  Home: { label: 'Главная', icon: 'home-outline', iconActive: 'home', testID: 'tabbar-home' },
  Menu: { label: 'Меню', icon: 'silverware-fork-knife', iconActive: 'silverware-fork-knife', testID: 'tabbar-menu' },
  Assistant: { label: 'Шеф ИИ', icon: 'creation', iconActive: 'creation', testID: 'tabbar-assistant' },
  Restaurants: { label: 'Рестораны', icon: 'map-marker-outline', iconActive: 'map-marker', testID: 'tabbar-restaurants' },
  Profile: { label: 'Профиль', icon: 'account-outline', iconActive: 'account', testID: 'tabbar-profile' },
};

function TabItem({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const it = ITEMS[name];
  const dot = useAnimatedStyle(() => ({ transform: [{ scaleX: withSpring(focused ? 1 : 0, motion.springStandard) }] }), [focused]);
  if (name === 'Assistant') {
    return (
      <PressableScale testID={it.testID} onPress={onPress} accessibilityLabel="ИИ-ассистент Шеф" accessibilityState={{ selected: focused }} pressedScale={0.9} hapticOnPress="tick" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: focused ? c.accent : c.surfaceHigh, alignItems: 'center', justifyContent: 'center', marginTop: -14, borderWidth: 3, borderColor: c.bg }}>
          <Icon name="creation" size={24} raw={focused ? c.onAccent : c.accent} />
        </View>
        <Txt v="caption" color={focused ? 'textPrimary' : 'textTertiary'} style={{ fontSize: 11, lineHeight: 14 }}>
          {it.label}
        </Txt>
      </PressableScale>
    );
  }
  return (
    <PressableScale testID={it.testID} onPress={onPress} accessibilityLabel={it.label} accessibilityState={{ selected: focused }} pressedScale={0.9} hapticOnPress="tick" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 2 }}>
      <Icon name={focused ? it.iconActive : it.icon} size={24} color={focused ? 'textPrimary' : 'textTertiary'} />
      <Txt v="caption" color={focused ? 'textPrimary' : 'textTertiary'} style={{ fontSize: 11, lineHeight: 14 }}>
        {it.label}
      </Txt>
      <Animated.View style={[{ position: 'absolute', bottom: 4, width: 16, height: 3, borderRadius: 2, backgroundColor: c.accent }, dot]} />
    </PressableScale>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
      {current !== 'Assistant' ? <CartBar /> : null}
      <View style={{ overflow: 'hidden', borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l }}>
        {Platform.OS === 'web' ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.surface, opacity: 0.97 }} />
        ) : (
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }} />
        )}
        <View style={{ flexDirection: 'row', paddingBottom: Math.max(insets.bottom, space.s), paddingTop: space.xs, borderTopWidth: 1, borderTopColor: c.outline }}>
          {state.routes.map((r, i) => (
            <TabItem
              key={r.key}
              name={r.name}
              focused={state.index === i}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
                if (state.index !== i && !e.defaultPrevented) navigation.navigate(r.name);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Content padding so lists scroll above the floating tab bar + cart bar. */
export const TAB_BAR_SPACE = 150;

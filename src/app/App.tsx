import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold } from '@expo-google-fonts/onest';
import { Unbounded_600SemiBold, Unbounded_700Bold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMenu } from '@/entities/dish/model/store';
import { useOrders } from '@/entities/order/model/store';
import { bootstrapE2ESession } from '@/features/auth/model/store';
import { ApiProvider } from '@/services';
import { useTheme } from '@/shared/theme';
import { ToastHost } from '@/shared/ui';
import { FlyLayer } from '@/features/add-to-cart/ui/FlyLayer';
import { DirectorPanel } from '@/widgets/director/DirectorPanel';
import { FeedbackLayer } from '@/widgets/feedback/FeedbackLayer';
import { OrderCapsule } from '@/widgets/order-capsule/OrderCapsule';
import { RootNavigator } from './navigation/RootNavigator';
import { navigationRef } from './navigation/ref';

export default function App() {
  const { c, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
  });
  const loadMenu = useMenu((s) => s.load);
  const loadOrders = useOrders((s) => s.load);

  useEffect(() => {
    loadMenu();
    loadOrders();
    bootstrapE2ESession();
  }, [loadMenu, loadOrders]);

  const navTheme = isDark ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <ApiProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {fontsLoaded ? (
            <NavigationContainer ref={navigationRef} theme={{ ...navTheme, colors: { ...navTheme.colors, background: c.bg, card: c.surface, text: c.textPrimary, primary: c.accent, border: c.outline } }}>
              <RootNavigator />
              <FlyLayer />
              <OrderCapsule />
              <DirectorPanel />
              <FeedbackLayer />
              <ToastHost />
            </NavigationContainer>
          ) : (
            <View style={{ flex: 1, backgroundColor: c.bg }} />
          )}
        </ApiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

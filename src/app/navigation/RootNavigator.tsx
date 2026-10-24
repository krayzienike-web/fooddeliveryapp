import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CardStyleInterpolators, createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { Platform } from 'react-native';
import { useSession } from '@/features/auth/model/store';
import { useTheme } from '@/shared/theme';
import { AddressScreen } from '@/screens/address/AddressScreen';
import { ARScreen } from '@/screens/ar/ARScreen';
import { AssistantScreen } from '@/screens/assistant/AssistantScreen';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import { BanquetScreen } from '@/screens/banquet/BanquetScreen';
import { BookingScreen } from '@/screens/booking/BookingScreen';
import { CartScreen } from '@/screens/cart/CartScreen';
import { CheckoutScreen } from '@/screens/checkout/CheckoutScreen';
import { DishScreen } from '@/screens/dish/DishScreen';
import { GiftScreen } from '@/screens/gift/GiftScreen';
import { GroupCartScreen } from '@/screens/group-cart/GroupCartScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { LoyaltyScreen } from '@/screens/loyalty/LoyaltyScreen';
import { MenuScreen } from '@/screens/menu/MenuScreen';
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { OrderScreen } from '@/screens/order/OrderScreen';
import { OrdersScreen } from '@/screens/orders/OrdersScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { PromoScreen } from '@/screens/promo/PromoScreen';
import { PromosScreen } from '@/screens/promos/PromosScreen';
import { QrMenuScreen } from '@/screens/qr-menu/QrMenuScreen';
import { RateScreen } from '@/screens/rate/RateScreen';
import { ReelsScreen } from '@/screens/reels/ReelsScreen';
import { RestaurantScreen } from '@/screens/restaurant/RestaurantScreen';
import { RestaurantsScreen } from '@/screens/restaurants/RestaurantsScreen';
import { SearchScreen } from '@/screens/search/SearchScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { SupportScreen } from '@/screens/support/SupportScreen';
import { WheelScreen } from '@/screens/wheel/WheelScreen';
import { TabBar } from './TabBar';
import type { RootStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
/** iOS-style modal sheets offset the card on web; use a fade-up there instead. */
const MODAL = Platform.OS === 'web' ? TransitionPresets.FadeFromBottomAndroid : TransitionPresets.ModalSlideFromBottomIOS;
const Stack = createStackNavigator<RootStackParamList>();

function Tabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Assistant" component={AssistantScreen} />
      <Tab.Screen name="Restaurants" component={RestaurantsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { c } = useTheme();
  const onboarded = useSession((s) => s.onboarded);
  return (
    <Stack.Navigator
      initialRouteName={onboarded ? 'Tabs' : 'Onboarding'}
      screenOptions={{ headerShown: false, cardStyle: { backgroundColor: c.bg }, ...TransitionPresets.SlideFromRightIOS, gestureEnabled: true }}
    >
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ ...TransitionPresets.FadeFromBottomAndroid }} />
      <Stack.Screen
        name="Dish"
        component={DishScreen}
        options={{ presentation: 'transparentModal', cardStyle: { backgroundColor: 'transparent' }, cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter, gestureEnabled: false }}
      />
      <Stack.Screen name="Search" component={SearchScreen} options={{ ...TransitionPresets.FadeFromBottomAndroid }} />
      <Stack.Screen name="Reels" component={ReelsScreen} options={{ ...MODAL }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ ...MODAL }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ ...MODAL }} />
      <Stack.Screen name="Address" component={AddressScreen} />
      <Stack.Screen name="Order" component={OrderScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="Rate" component={RateScreen} options={{ ...MODAL }} />
      <Stack.Screen name="Promos" component={PromosScreen} />
      <Stack.Screen name="Promo" component={PromoScreen} options={{ ...MODAL }} />
      <Stack.Screen name="Restaurant" component={RestaurantScreen} />
      <Stack.Screen name="Booking" component={BookingScreen} />
      <Stack.Screen name="Banquet" component={BanquetScreen} />
      <Stack.Screen name="Loyalty" component={LoyaltyScreen} />
      <Stack.Screen name="Wheel" component={WheelScreen} options={{ ...MODAL }} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="AR" component={ARScreen} options={{ ...MODAL }} />
      <Stack.Screen name="GroupCart" component={GroupCartScreen} />
      <Stack.Screen name="Gift" component={GiftScreen} />
      <Stack.Screen name="QrMenu" component={QrMenuScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

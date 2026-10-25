import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Menu: { categoryId?: string } | undefined;
  Assistant: { prompt?: string } | undefined;
  Restaurants: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Onboarding: undefined;
  Dish: { id: string };
  Search: undefined;
  Reels: { startDishId?: string } | undefined;
  Cart: undefined;
  Checkout: undefined;
  Auth: { then?: 'Checkout' | 'Profile' | 'Booking' } | undefined;
  Address: undefined;
  Order: { id: string; celebrate?: boolean };
  Orders: undefined;
  Rate: { id: string; stars?: number };
  Promos: undefined;
  Promo: { id: string };
  Restaurant: { id: string };
  Booking: { restaurantId: string; date?: string; time?: string; guests?: number };
  Banquet: { restaurantId?: string; guests?: number; budgetPerGuest?: number } | undefined;
  Loyalty: undefined;
  Wheel: { orderId?: string } | undefined;
  Support: { orderId?: string; topic?: string } | undefined;
  AR: { dishId: string };
  GroupCart: undefined;
  Gift: undefined;
  QrMenu: undefined;
  Settings: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

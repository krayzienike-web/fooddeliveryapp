import { Screen, Txt } from '@/shared/ui';

export function RestaurantScreen() {
  return (
    <Screen testID="restaurant-screen">
      <Txt v="headline" style={{ padding: 16 }}>Restaurant</Txt>
    </Screen>
  );
}

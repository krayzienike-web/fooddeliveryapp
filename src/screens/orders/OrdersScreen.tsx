import { Screen, Txt } from '@/shared/ui';

export function OrdersScreen() {
  return (
    <Screen testID="orders-screen">
      <Txt v="headline" style={{ padding: 16 }}>Orders</Txt>
    </Screen>
  );
}

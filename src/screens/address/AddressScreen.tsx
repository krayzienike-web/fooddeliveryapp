import { Screen, Txt } from '@/shared/ui';

export function AddressScreen() {
  return (
    <Screen testID="address-screen">
      <Txt v="headline" style={{ padding: 16 }}>Address</Txt>
    </Screen>
  );
}

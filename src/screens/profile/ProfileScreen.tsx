import { Screen, Txt } from '@/shared/ui';

export function ProfileScreen() {
  return (
    <Screen testID="profile-screen">
      <Txt v="headline" style={{ padding: 16 }}>Profile</Txt>
    </Screen>
  );
}

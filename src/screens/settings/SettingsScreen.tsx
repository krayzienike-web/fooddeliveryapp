import { Screen, Txt } from '@/shared/ui';

export function SettingsScreen() {
  return (
    <Screen testID="settings-screen">
      <Txt v="headline" style={{ padding: 16 }}>Settings</Txt>
    </Screen>
  );
}

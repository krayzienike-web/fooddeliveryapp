import { Screen, Txt } from '@/shared/ui';

export function OnboardingScreen() {
  return (
    <Screen testID="onboarding-screen">
      <Txt v="headline" style={{ padding: 16 }}>Onboarding</Txt>
    </Screen>
  );
}

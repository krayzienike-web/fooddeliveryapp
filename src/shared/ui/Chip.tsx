import { View } from 'react-native';
import { radius, space, useTheme } from '@/shared/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  testID,
  tone = 'default',
  small,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  testID?: string;
  tone?: 'default' | 'gold';
  small?: boolean;
}) {
  const { c } = useTheme();
  const activeBg = tone === 'gold' ? c.goldTonal : c.accentTonal;
  const activeFg = tone === 'gold' ? c.gold : c.accent;
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      pressedScale={0.94}
      hapticOnPress="tick"
      accessibilityState={{ selected: !!selected }}
      accessibilityRole="button"
      style={{ minHeight: 48, justifyContent: 'center' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          height: small ? 32 : 36,
          paddingHorizontal: space.m,
          borderRadius: radius.full,
          backgroundColor: selected ? activeBg : c.surfaceRaised,
          borderWidth: 1,
          borderColor: selected ? activeFg : 'transparent',
        }}
      >
        {icon ? <Icon name={icon} size={16} raw={selected ? activeFg : c.textSecondary} /> : null}
        <Txt v="label" style={{ color: selected ? activeFg : c.textSecondary }} numberOfLines={1}>
          {label}
        </Txt>
      </View>
    </PressableScale>
  );
}

import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/shared/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function IconButton({
  icon,
  onPress,
  testID,
  label,
  tone = 'surface',
  size = 48,
  badge,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  testID?: string;
  label: string;
  tone?: 'surface' | 'glass' | 'accent' | 'none';
  size?: number;
  badge?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = { surface: c.surfaceRaised, glass: c.scrim, accent: c.accent, none: 'transparent' }[tone];
  const fg = tone === 'accent' ? c.onAccent : tone === 'glass' ? '#F7EFE8' : c.textPrimary;
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.9}
      hapticOnPress="tick"
      style={[{ width: Math.max(48, size), height: Math.max(48, size), alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <View style={{ width: size, height: size, borderRadius: radius.full, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={Math.round(size * 0.5)} raw={fg} />
      </View>
      {badge ? (
        <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="caption" style={{ color: c.onAccent, fontSize: 11, lineHeight: 14 }}>
            {badge}
          </Txt>
        </View>
      ) : null}
    </PressableScale>
  );
}

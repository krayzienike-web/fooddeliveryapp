import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, space, useTheme } from '@/shared/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export type ButtonKind = 'primary' | 'tonal' | 'ghost' | 'outline' | 'gold';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  size?: 'l' | 'm' | 's';
  icon?: IconName;
  trailing?: string;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}

/**
 * One primary (filled accent) button per screen — always at the bottom (guidebook rule #1).
 * Use `tonal` for everything else.
 */
export function Button({ title, onPress, kind = 'primary', size = 'l', icon, trailing, loading, disabled, testID, style, full }: ButtonProps) {
  const { c } = useTheme();
  const h = size === 'l' ? 56 : size === 'm' ? 48 : 40;
  const bg = { primary: c.accent, tonal: c.accentTonal, ghost: 'transparent', outline: 'transparent', gold: c.gold }[kind];
  const fg = { primary: c.onAccent, tonal: c.accent, ghost: c.textPrimary, outline: c.textPrimary, gold: c.onAccent }[kind];
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || loading}
      pressedScale={0.96}
      hapticOnPress={kind === 'primary' ? 'tick' : undefined}
      style={[
        styles.base,
        { height: h, minHeight: 48, backgroundColor: bg, paddingHorizontal: size === 's' ? space.l : space.xxl },
        kind === 'outline' ? { borderWidth: 1, borderColor: c.outline } : null,
        full ? { alignSelf: 'stretch' } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} raw={fg} /> : null}
          <Txt v={size === 's' ? 'label' : 'titleM'} style={{ color: fg }} numberOfLines={1}>
            {title}
          </Txt>
          {trailing ? (
            <Txt v={size === 's' ? 'label' : 'titleM'} style={{ color: fg, opacity: 0.85, marginLeft: 'auto' }} tabular>
              {trailing}
            </Txt>
          ) : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, alignSelf: 'stretch', justifyContent: 'center' },
});

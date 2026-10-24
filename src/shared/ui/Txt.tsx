import { Text, type TextProps, type TextStyle } from 'react-native';
import { type Palette, type TypeToken, type as typeScale, useTheme } from '@/shared/theme';

type ColorToken = keyof Omit<Palette, 'map'>;

export interface TxtProps extends TextProps {
  v?: TypeToken;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
  upper?: boolean;
}

export function Txt({ v = 'bodyM', color = 'textPrimary', align, tabular, upper, style, ...rest }: TxtProps) {
  const { c } = useTheme();
  const t = typeScale[v];
  const isDisplay = v === 'displayL' || v === 'displayM' || v === 'headline';
  return (
    <Text
      maxFontSizeMultiplier={isDisplay ? 1.3 : 2}
      {...rest}
      style={[
        t,
        { color: c[color] },
        align ? { textAlign: align } : null,
        tabular || v === 'priceL' || v === 'priceM' ? { fontVariant: ['tabular-nums'] } : null,
        upper ? { textTransform: 'uppercase', letterSpacing: 0.5 } : null,
        style,
      ]}
    />
  );
}

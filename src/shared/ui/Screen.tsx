import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '@/shared/theme';
import { IconButton } from './IconButton';
import { Txt } from './Txt';

export function Screen({ children, testID, style, edges = ['top'] }: { children: ReactNode; testID?: string; style?: StyleProp<ViewStyle>; edges?: Array<'top' | 'bottom'> }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      style={[{ flex: 1, backgroundColor: c.bg, paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 }, style]}
    >
      {children}
    </View>
  );
}

export function Header({ title, onBack, right, testID, subtitle }: { title?: string; onBack?: () => void; right?: ReactNode; testID?: string; subtitle?: string }) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.s, gap: space.xs }}>
      {onBack ? <IconButton icon="arrow-left" label="Назад" onPress={onBack} tone="none" testID={testID ? `${testID}-back` : 'header-back'} /> : <View style={{ width: space.s }} />}
      <View style={{ flex: 1 }}>
        {title ? (
          <Txt v="headline" numberOfLines={1}>
            {title}
          </Txt>
        ) : null}
        {subtitle ? (
          <Txt v="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: space.l, marginTop: space.xxl, marginBottom: space.m }}>
      <Txt v="headline" style={{ flex: 1 }}>
        {title}
      </Txt>
      {action ? (
        <Txt testID={testID} v="label" color="accent" onPress={onAction} style={{ paddingVertical: space.s, paddingLeft: space.m }}>
          {action}
        </Txt>
      ) : null}
    </View>
  );
}

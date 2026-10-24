import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { type Palette, useTheme } from '@/shared/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 24, color = 'textPrimary', raw }: { name: IconName; size?: number; color?: keyof Omit<Palette, 'map'>; raw?: string }) {
  const { c } = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={raw ?? c[color]} />;
}

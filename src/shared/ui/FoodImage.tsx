import { Image, type ImageProps } from 'expo-image';
import { MEDIA } from '@/shared/assets/media';

/**
 * Food photo with an instant tinted placeholder (the photo's average color),
 * so cards never flash empty. `small` picks the 320px variant for lists.
 */
export function FoodImage({ id, small, style, ...rest }: { id: string; small?: boolean } & Omit<ImageProps, 'source'>) {
  const m = MEDIA[id];
  if (!m) return null;
  return (
    <Image
      source={small && m.small ? m.small : m.full}
      style={[{ backgroundColor: m.tint }, style]}
      contentFit="cover"
      transition={180}
      cachePolicy="memory-disk"
      recyclingKey={id}
      {...rest}
    />
  );
}

export function mediaTint(id: string): string | undefined {
  return MEDIA[id]?.tint;
}

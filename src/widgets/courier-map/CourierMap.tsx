import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { pointAlong } from '@/entities/order/model/lifecycle';
import type { GeoPoint } from '@/entities/order/model/types';
import { MAP_IMAGES, MAP_META } from '@/shared/assets/mapMeta';
import { radius, useTheme } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

const lon2x = (lon: number) => ((lon + 180) / 360) * 256 * 2 ** MAP_META.zoom - MAP_META.originX;
const lat2y = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * 2 ** MAP_META.zoom - MAP_META.originY;
};
export const project = (p: GeoPoint) => ({ x: lon2x(p.lng), y: lat2y(p.lat) });

export interface MapPin {
  id: string;
  point: GeoPoint;
  icon: IconName;
  tone: 'accent' | 'neutral' | 'gold';
  label?: string;
}

/**
 * Branded map (our own render of OSM data — no external tiles), fitted to the given points.
 * Shows a route, pins and a smoothly moving courier.
 */
export function BrandMap({
  height,
  width,
  fit,
  route,
  pins = [],
  courier,
  heading = 0,
  testID,
  padding = 60,
}: {
  height: number;
  width: number;
  fit: GeoPoint[];
  route?: GeoPoint[];
  pins?: MapPin[];
  courier?: GeoPoint;
  heading?: number;
  testID?: string;
  padding?: number;
}) {
  const { c, isDark } = useTheme();
  const view = useMemo(() => {
    const pts = fit.map(project);
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const scale = Math.min(2.2, Math.max(0.35, Math.min((width - padding * 2) / Math.max(1, maxX - minX), (height - padding * 2) / Math.max(1, maxY - minY))));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { scale, tx: width / 2 - cx * scale, ty: height / 2 - cy * scale };
  }, [fit, width, height, padding]);

  const toScreen = (p: GeoPoint) => {
    const q = project(p);
    return { x: q.x * view.scale + view.tx, y: q.y * view.scale + view.ty };
  };

  const d = route?.length
    ? route
        .map(toScreen)
        .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ')
    : '';

  // Smooth courier movement: interpolate between updates instead of jumping.
  const cx = useSharedValue(0);
  const cy = useSharedValue(0);
  const target = courier ? toScreen(courier) : null;
  useEffect(() => {
    if (!target) return;
    if (cx.value === 0 && cy.value === 0) {
      cx.value = target.x;
      cy.value = target.y;
    } else {
      cx.value = withTiming(target.x, { duration: 1000, easing: Easing.linear });
      cy.value = withTiming(target.y, { duration: 1000, easing: Easing.linear });
    }
  }, [target?.x, target?.y]); // eslint-disable-line react-hooks/exhaustive-deps
  const courierStyle = useAnimatedStyle(() => ({ transform: [{ translateX: cx.value - 22 }, { translateY: cy.value - 22 }] }));

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - pulse.value), transform: [{ scale: 0.6 + pulse.value * 1.6 }] }));

  return (
    <View testID={testID} style={{ width, height, overflow: 'hidden', backgroundColor: c.map.land, borderRadius: radius.l }}>
      <Image
        source={isDark ? MAP_IMAGES.dark : MAP_IMAGES.light}
        style={{ position: 'absolute', left: view.tx, top: view.ty, width: MAP_META.width * view.scale, height: MAP_META.height * view.scale }}
        contentFit="fill"
        cachePolicy="memory-disk"
      />
      {d ? (
        <Svg width={width} height={height} style={{ position: 'absolute' }}>
          <Path d={d} stroke={c.accent} strokeOpacity={0.25} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d={d} stroke={c.accent} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
      {pins.map((p) => {
        const s = toScreen(p.point);
        const bg = p.tone === 'accent' ? c.accent : p.tone === 'gold' ? c.gold : c.textPrimary;
        return (
          <View key={p.id} style={{ position: 'absolute', left: s.x - 18, top: s.y - 18, width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg }}>
            <Icon name={p.icon} size={18} raw={c.bg} />
          </View>
        );
      })}
      {target ? (
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, courierStyle]}>
          <Animated.View style={[{ position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent }, pulseStyle]} />
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg, transform: [{ rotate: `${heading > 90 || heading < -90 ? 180 : 0}deg` }] }}>
            <Icon name="bike-fast" size={18} raw={c.onAccent} />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function CourierMap({ route, progress, home, restaurant, width, height }: { route: GeoPoint[]; progress: number; home: GeoPoint; restaurant: GeoPoint; width: number; height: number }) {
  const { point, heading } = pointAlong(route, progress);
  return (
    <BrandMap
      testID="order-courier-map-live"
      width={width}
      height={height}
      fit={[...route, home, restaurant]}
      route={route}
      courier={point}
      heading={heading}
      pins={[
        { id: 'rest', point: restaurant, icon: 'fire', tone: 'neutral' },
        { id: 'home', point: home, icon: 'home', tone: 'gold' },
      ]}
    />
  );
}

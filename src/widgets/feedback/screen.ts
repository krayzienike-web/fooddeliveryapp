import { navigationRef } from '@/app/navigation/ref';
import { routeKey } from '@/features/feedback/model/anchors';

/** The screen on top right now, as an anchor prefix: route + its identifying param. */
export function currentScreen(): { route: string; key?: string } | null {
  if (!navigationRef.isReady()) return null;
  const r = navigationRef.getCurrentRoute();
  if (!r) return null;
  return { route: r.name, key: routeKey(r.name, r.params) };
}

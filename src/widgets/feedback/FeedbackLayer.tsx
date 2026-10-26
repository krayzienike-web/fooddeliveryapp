import { useEffect } from 'react';
import { Platform } from 'react-native';
import { navigationRef } from '@/app/navigation/ref';
import { anchorLabel, anchorName, parseAnchor, routeFor, routeKey } from '@/features/feedback/model/anchors';
import { IS_E2E } from '@/shared/config/env';
import { useTheme } from '@/shared/theme';

/**
 * Review mode for the web build published as a claude.ai Artifact (D0): reviewers turn on the shell's
 * comment mode and tap any element of any screen; the thread is anchored to «Screen(id) › testID», its pin
 * shows only on that screen, and opening it from the shell's list navigates there. Nothing here runs on
 * Android, in e2e, or outside a claude.ai viewer.
 */

interface ThreadRef {
  id: string;
  anchor: string;
}
interface Controller {
  compose(anchor: string, at: Element | { x: number; y: number }, opts?: { label?: string }): Promise<{ opened: boolean }>;
  placed(map: Record<string, { x: number; y: number }>): void;
  release(): void;
}
interface CommentsNs {
  customAnchors(cb: {
    mode: (on: boolean) => void;
    threads: (list: ThreadRef[]) => void;
    reveal: (id: string) => void;
    composing?: (open: boolean) => void;
  }): Promise<Controller>;
}
interface ClaudeRuntime {
  use(name: 'comments'): Promise<CommentsNs | null>;
}

function currentScreen(): { route: string; key?: string } | null {
  if (!navigationRef.isReady()) return null;
  const r = navigationRef.getCurrentRoute();
  if (!r) return null;
  return { route: r.name, key: routeKey(r.name, r.params) };
}

const sameScreen = (a: { route: string; key?: string }, b: { route: string; key?: string }) => a.route === b.route && (a.key ?? '') === (b.key ?? '');

function centerOf(el: Element): { x: number; y: number } | null {
  const b = el.getBoundingClientRect();
  if (b.width === 0 && b.height === 0) return null;
  if (b.bottom < 0 || b.top > window.innerHeight) return null;
  return { x: b.left + b.width / 2 + window.scrollX, y: b.top + Math.min(b.height / 2, 24) + window.scrollY };
}

export function FeedbackLayer() {
  const { c } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || IS_E2E || typeof window === 'undefined') return;
    const runtime = (globalThis as { claude?: ClaudeRuntime }).claude;
    if (!runtime?.use) return;

    let ctl: Controller | null = null;
    let threads: ThreadRef[] = [];
    let modeOn = false;
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastReport = '';
    let unsubNav: (() => void) | undefined;

    // A thin ring that follows the pointer in comment mode, so reviewers see what they're about to tag.
    const ring = document.createElement('div');
    Object.assign(ring.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483646', border: `2px solid ${c.accent}`, borderRadius: '10px', display: 'none', transition: 'all 80ms ease-out' });
    document.body.appendChild(ring);

    const report = () => {
      if (!ctl) return;
      const here = currentScreen();
      const map: Record<string, { x: number; y: number }> = {};
      if (here) {
        for (const t of threads) {
          const a = parseAnchor(t.anchor);
          if (!a || !sameScreen(a, here)) continue;
          if (a.target === 'screen') {
            map[t.id] = { x: 32 + window.scrollX, y: 96 + window.scrollY };
            continue;
          }
          const el = document.querySelector(`[data-testid="${CSS.escape(a.target)}"]`);
          const p = el ? centerOf(el) : null;
          if (p) map[t.id] = p;
        }
      }
      const sig = JSON.stringify(map);
      if (sig !== lastReport) {
        lastReport = sig;
        ctl.placed(map);
      }
    };

    const targetOf = (ev: Event): Element | null => {
      const t = ev.target as Element | null;
      return t?.closest?.('[data-testid]') ?? null;
    };

    // While comment mode is on, a tap tags the element instead of pressing it.
    const block = (ev: Event) => {
      if (!modeOn) return;
      ev.stopPropagation();
      if (ev.type !== 'touchstart' && ev.type !== 'wheel') ev.preventDefault();
    };
    const onUp = (ev: PointerEvent) => {
      if (!modeOn || !ctl) return;
      ev.stopPropagation();
      ev.preventDefault();
      const here = currentScreen();
      if (!here) return;
      const el = targetOf(ev);
      const testId = el?.getAttribute('data-testid');
      const name = anchorName({ ...here, target: testId ?? 'screen' });
      const text = el ? el.getAttribute('aria-label') || (el as HTMLElement).innerText : null;
      ctl.compose(name, el ?? { x: ev.pageX, y: ev.pageY }, { label: anchorLabel(here.route, text) }).catch(() => undefined);
    };
    const onMove = (ev: PointerEvent) => {
      if (!modeOn) return;
      const el = targetOf(ev);
      if (!el) {
        ring.style.display = 'none';
        return;
      }
      const b = el.getBoundingClientRect();
      Object.assign(ring.style, { display: 'block', left: `${b.left - 3}px`, top: `${b.top - 3}px`, width: `${b.width + 6}px`, height: `${b.height + 6}px` });
    };
    const BLOCKED = ['pointerdown', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click'] as const;

    const setMode = (on: boolean) => {
      if (on === modeOn) return;
      modeOn = on;
      if (on) {
        BLOCKED.forEach((t) => window.addEventListener(t, block, { capture: true }));
        window.addEventListener('pointerup', onUp, { capture: true });
        window.addEventListener('pointermove', onMove, { capture: true });
        timer = setInterval(report, 500);
        report();
      } else {
        BLOCKED.forEach((t) => window.removeEventListener(t, block, { capture: true }));
        window.removeEventListener('pointerup', onUp, { capture: true });
        window.removeEventListener('pointermove', onMove, { capture: true });
        if (timer) clearInterval(timer);
        ring.style.display = 'none';
        threads = [];
      }
    };

    runtime
      .use('comments')
      .then(async (comments) => {
        if (!comments || disposed) return;
        ctl = await comments.customAnchors({
          mode: setMode,
          threads: (list) => {
            threads = list;
            lastReport = '';
            report();
          },
          reveal: (id) => {
            const t = threads.find((x) => x.id === id);
            const a = t ? parseAnchor(t.anchor) : null;
            if (!a || !navigationRef.isReady()) return;
            const here = currentScreen();
            if (here && sameScreen(a, here)) return;
            const to = routeFor(a);
            (navigationRef.navigate as (name: string, params?: object) => void)(to.name, to.params);
            setTimeout(report, 400);
          },
        });
        if (disposed) ctl.release();
        else unsubNav = navigationRef.addListener('state', () => setTimeout(report, 350));
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      setMode(false);
      unsubNav?.();
      ctl?.release();
      ring.remove();
    };
  }, [c.accent]);

  return null;
}

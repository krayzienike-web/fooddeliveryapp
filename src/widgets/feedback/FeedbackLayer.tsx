import { useEffect } from 'react';
import { Platform } from 'react-native';
import { navigationRef } from '@/app/navigation/ref';
import { anchorLabel, anchorName, parseAnchor, routeFor } from '@/features/feedback/model/anchors';
import { IS_E2E } from '@/shared/config/env';
import { useTheme } from '@/shared/theme';
import { currentScreen } from './screen';
import { startTapPicker, type PickTarget } from './tapPicker';

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

    let stopPicker: (() => void) | undefined;
    // While comment mode is on, a tap tags the element instead of pressing it.
    const onPick = (t: PickTarget) => {
      const here = currentScreen();
      if (!ctl || !here) return;
      const name = anchorName({ ...here, target: t.testId ?? 'screen' });
      ctl.compose(name, t.el ?? { x: t.pageX, y: t.pageY }, { label: anchorLabel(here.route, t.text) }).catch(() => undefined);
    };

    const setMode = (on: boolean) => {
      if (on === modeOn) return;
      modeOn = on;
      if (on) {
        stopPicker = startTapPicker(onPick, c.accent);
        timer = setInterval(report, 500);
        report();
      } else {
        stopPicker?.();
        stopPicker = undefined;
        if (timer) clearInterval(timer);
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
    };
  }, [c.accent]);

  return null;
}

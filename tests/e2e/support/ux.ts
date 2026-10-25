/**
 * Pragmatic UX heuristics for a rendered screen (mobile web export, CSS px ≈ dp).
 *
 *   await expectGoodUx(page, { screen: 'cart' });
 *
 * Checks:
 *  1. primaryCta  — at most ONE visible element whose data-testid ends with "-primary-cta".
 *  2. tapTargets  — every visible tappable element is ≥ 48×48 dp (Material / Android guideline).
 *  3. overflow    — no horizontal page overflow; no element sticks out of the viewport unless it is
 *                   inside a horizontal scroller (overflow-x: auto|scroll|hidden).
 *  4. contrast    — WCAG contrast for tagged text (selector below): ≥ 4.5 normal, ≥ 3 large (≥24px or ≥18.66px bold).
 *                   Background = first non-transparent ancestor background-color (images/gradients are not analysed).
 *  5. testIds     — every visible tappable element has a data-testid (project rule: every interactive element gets a testID).
 *
 * Opt-outs on the app side: `dataSet={{ uxIgnore: 'tap' }}` → data-ux-ignore="tap" (comma-separated check names).
 */
import { expect, type Page } from '@playwright/test';

export type UxCheck = 'primaryCta' | 'tapTargets' | 'overflow' | 'contrast' | 'testIds';

export interface UxOptions {
  /** Label used in messages. */
  screen?: string;
  /** Checks to run (default: all). */
  checks?: UxCheck[];
  minTapSize?: number;
  /** Text elements subject to the contrast check. */
  contrastSelector?: string;
  /** Extra CSS selectors excluded from all checks (e.g. third-party map widgets). */
  ignore?: string[];
  /**
   * Only check elements inside this root, plus global chrome that lives outside any `[data-testid$="-screen"]`
   * (tab bar, cart bar, status capsule, toasts, sheets). Default: `[data-testid="<screen>-screen"]` when `screen` is set
   * and that root is rendered. Needed because RN keeps other tabs (off-screen) and screens under transparent modals mounted.
   */
  scope?: string | null;
}

export interface UxViolation {
  check: UxCheck;
  testId: string | null;
  detail: string;
}

export const TAPPABLE_SELECTOR = [
  'button', 'a[href]', '[role="button"]', '[role="link"]', '[role="tab"]', '[role="switch"]', '[role="checkbox"]',
  '[role="radio"]', '[role="menuitem"]', '[role="slider"]', 'input:not([type="hidden"])', 'select', 'textarea', '[tabindex="0"]',
].join(',');

export const DEFAULT_CONTRAST_SELECTOR = [
  '[data-ux-contrast]', '[data-testid$="-title"]', '[data-testid$="-price"]', '[data-testid$="-total"]', '[data-testid$="-text"]',
  '[data-testid$="-primary-cta"]',
].join(',');

export async function collectUxViolations(page: Page, opts: UxOptions = {}): Promise<UxViolation[]> {
  const args = {
    checks: opts.checks ?? (['primaryCta', 'tapTargets', 'overflow', 'contrast', 'testIds'] as UxCheck[]),
    minTap: opts.minTapSize ?? 48,
    tappable: TAPPABLE_SELECTOR,
    contrastSel: opts.contrastSelector ?? DEFAULT_CONTRAST_SELECTOR,
    ignore: opts.ignore ?? [],
    scope: opts.scope === undefined ? (opts.screen ? `[data-testid="${opts.screen}-screen"]` : null) : opts.scope,
  };
  return page.evaluate((a) => {
    const out: { check: string; testId: string | null; detail: string }[] = [];
    const vw = document.documentElement.clientWidth;
    const scopeRoots = a.scope ? [...document.querySelectorAll(a.scope)].filter((r) => getComputedStyle(r).display !== 'none') : [];
    const outOfScope = (el: Element) => scopeRoots.length > 0 && !scopeRoots.some((r) => r.contains(el)) && !!el.closest('[data-testid$="-screen"]');
    const ignored = (el: Element, check: string) => {
      if (outOfScope(el)) return true;
      if (a.ignore.some((s) => el.closest(s))) return true;
      const host = el.closest('[data-ux-ignore]');
      return !!host && (host.getAttribute('data-ux-ignore') ?? '').split(',').map((x) => x.trim()).some((x) => x === check || x === 'all');
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
      for (let p: Element | null = el; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.display === 'none' || Number(s.opacity) === 0) return false;
      }
      return true;
    };
    const tid = (el: Element) => el.getAttribute('data-testid') ?? el.closest('[data-testid]')?.getAttribute('data-testid') ?? null;
    const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`;

    // Outermost tappable only: RN-web nests focusable nodes inside Pressables.
    const tappables = [...document.querySelectorAll(a.tappable)].filter(
      (el) => visible(el) && !(el.parentElement && el.parentElement.closest(a.tappable)),
    );

    if (a.checks.includes('primaryCta')) {
      const ctas = [...document.querySelectorAll('[data-testid$="-primary-cta"]')].filter((el) => visible(el) && !ignored(el, 'primaryCta'));
      if (ctas.length > 1) out.push({ check: 'primaryCta', testId: null, detail: `${ctas.length} primary CTAs visible: ${ctas.map((c) => c.getAttribute('data-testid')).join(', ')}` });
    }

    if (a.checks.includes('tapTargets')) {
      for (const el of tappables) {
        if (ignored(el, 'tap')) continue;
        const r = el.getBoundingClientRect();
        if (r.width + 0.5 < a.minTap || r.height + 0.5 < a.minTap) {
          out.push({ check: 'tapTargets', testId: tid(el), detail: `${describe(el)} is ${Math.round(r.width)}×${Math.round(r.height)} (< ${a.minTap})` });
        }
      }
    }

    if (a.checks.includes('testIds')) {
      for (const el of tappables) {
        if (ignored(el, 'testIds')) continue;
        if (!el.getAttribute('data-testid') && !el.querySelector('[data-testid]')) out.push({ check: 'testIds', testId: null, detail: `${describe(el)} has no data-testid` });
      }
    }

    if (a.checks.includes('overflow')) {
      const se = document.scrollingElement ?? document.documentElement;
      if (se.scrollWidth > se.clientWidth + 1) out.push({ check: 'overflow', testId: null, detail: `page scrollWidth ${se.scrollWidth} > ${se.clientWidth}` });
      const inScroller = (el: Element) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
        }
        return false;
      };
      let n = 0;
      for (const el of document.body.querySelectorAll('*')) {
        if (n >= 5) break;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || (r.right <= vw + 1 && r.left >= -1)) continue;
        if (!visible(el) || inScroller(el) || ignored(el, 'overflow')) continue;
        out.push({ check: 'overflow', testId: tid(el), detail: `${describe(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} beyond viewport ${vw}` });
        n++;
      }
    }

    if (a.checks.includes('contrast')) {
      const parse = (c: string) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const [r, g, b, al = '1'] = m[1].split(/[ ,/]+/).filter(Boolean);
        return { r: +r, g: +g, b: +b, a: +al };
      };
      const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
        const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgOf = (el: Element) => {
        for (let p: Element | null = el; p; p = p.parentElement) {
          const c = parse(getComputedStyle(p).backgroundColor);
          if (c && c.a > 0.5) return c;
        }
        return parse(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
      };
      for (const host of document.querySelectorAll(a.contrastSel)) {
        if (!visible(host) || ignored(host, 'contrast')) continue;
        // the element itself or its text-bearing descendants
        const texts = [host, ...host.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()));
        for (const el of texts) {
          const cs = getComputedStyle(el);
          const fg = parse(cs.color);
          if (!fg) continue;
          const bg = bgOf(el);
          const L1 = lum(fg), L2 = lum(bg);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const size = parseFloat(cs.fontSize);
          const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
          const min = large ? 3 : 4.5;
          if (ratio < min) out.push({ check: 'contrast', testId: tid(el), detail: `"${(el.textContent ?? '').trim().slice(0, 30)}" contrast ${ratio.toFixed(2)} < ${min} (${cs.color} on rgb(${bg.r},${bg.g},${bg.b}))` });
        }
      }
    }
    return out;
  }, args) as Promise<UxViolation[]>;
}

/** Fails the test (softly, so all screens in a flow are reported) when UX heuristics are violated. */
export async function expectGoodUx(page: Page, opts: UxOptions = {}): Promise<void> {
  const v = await collectUxViolations(page, opts);
  const msg = v.map((x) => `  [${x.check}] ${x.testId ?? '-'}: ${x.detail}`).join('\n');
  expect.soft(v, `UX heuristics on "${opts.screen ?? 'screen'}":\n${msg}`).toEqual([]);
}

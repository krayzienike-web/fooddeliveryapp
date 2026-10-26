/**
 * Web-only «tap tags an element» mode shared by the shell's comment mode (FeedbackLayer) and the review
 * panel (ReviewLayer): while on, taps don't press anything; the closest element with a testID is handed to
 * `onPick`, and a ring follows the pointer. Elements inside `[data-review-ui]` keep working normally.
 */
export interface PickTarget {
  /** The closest element with a testID, or null for empty space. */
  el: Element | null;
  testId: string | null;
  /** Accessible label or visible text, for a human-readable anchor label. */
  text: string | null;
  pageX: number;
  pageY: number;
}

const BLOCKED = ['pointerdown', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click'] as const;

const ownUi = (ev: Event) => !!(ev.target as Element | null)?.closest?.('[data-review-ui]');

export function startTapPicker(onPick: (t: PickTarget) => void, ringColor: string): () => void {
  const ring = document.createElement('div');
  Object.assign(ring.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483646', border: `2px solid ${ringColor}`, borderRadius: '10px', display: 'none', transition: 'all 80ms ease-out' });
  document.body.appendChild(ring);

  const targetOf = (ev: Event): Element | null => (ev.target as Element | null)?.closest?.('[data-testid]') ?? null;

  const block = (ev: Event) => {
    if (ownUi(ev)) return;
    ev.stopPropagation();
    if (ev.type !== 'touchstart') ev.preventDefault();
  };
  const onUp = (ev: PointerEvent) => {
    if (ownUi(ev)) return;
    ev.stopPropagation();
    ev.preventDefault();
    const el = targetOf(ev);
    const text = el ? el.getAttribute('aria-label') || (el as HTMLElement).innerText : null;
    const t = { el, testId: el?.getAttribute('data-testid') ?? null, text, pageX: ev.pageX, pageY: ev.pageY };
    // Hand over after the trailing mouseup/click: onPick may end picking, and a click that lands after the
    // listeners are gone would press the element (open the dish) instead of tagging it.
    setTimeout(() => onPick(t), 60);
  };
  const onMove = (ev: PointerEvent) => {
    const el = ownUi(ev) ? null : targetOf(ev);
    if (!el) {
      ring.style.display = 'none';
      return;
    }
    const b = el.getBoundingClientRect();
    Object.assign(ring.style, { display: 'block', left: `${b.left - 3}px`, top: `${b.top - 3}px`, width: `${b.width + 6}px`, height: `${b.height + 6}px` });
  };

  BLOCKED.forEach((t) => window.addEventListener(t, block, { capture: true }));
  window.addEventListener('pointerup', onUp, { capture: true });
  window.addEventListener('pointermove', onMove, { capture: true });
  return () => {
    BLOCKED.forEach((t) => window.removeEventListener(t, block, { capture: true }));
    window.removeEventListener('pointerup', onUp, { capture: true });
    window.removeEventListener('pointermove', onMove, { capture: true });
    ring.remove();
  };
}

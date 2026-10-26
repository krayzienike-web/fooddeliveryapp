import { ROUTE_TITLE } from '@/features/feedback/model/anchors';

/**
 * Review batches (D0): a reviewer collects notes on elements of the demo, then sends them to work in one go.
 * The batch arrives as a comment thread «sent to Claude»; each part stays within the platform's 4 KiB.
 */

export type ReviewKind = 'bug' | 'change' | 'idea';

export const KIND_TITLE: Record<ReviewKind, string> = { bug: 'Баг', change: 'Правка', idea: 'Идея' };

export interface ReviewDraft {
  id: string;
  /** «Dish(bg-zhar) › dish-add» — the element's durable name (see feedback/model/anchors). */
  anchor: string;
  route: string;
  /** «Блюдо · В корзину · 590 ₽» — what the reviewer saw. */
  label: string;
  kind: ReviewKind;
  text: string;
  createdAt: number;
}

export interface BatchPart {
  text: string;
  /** Drafts carried by this part: marked sent only once the part goes through. */
  ids: string[];
}

export const MAX_NOTE = 1500;
const MAX_BYTES = 4000; // 4 KiB minus headroom

const bytes = (s: string) => new TextEncoder().encode(s).length;

export function formatItem(d: ReviewDraft, n: number): string {
  const label = d.label && d.label !== (ROUTE_TITLE[d.route] ?? d.route) ? ` — «${d.label}»` : '';
  const body = d.text.trim().slice(0, MAX_NOTE).replace(/\n/g, '\n   ');
  return `${n}. [${KIND_TITLE[d.kind]}] ${d.anchor}${label}\n   ${body}`;
}

const header = (total: number, part: number, parts: number) =>
  `Пачка правок из ревью демо ЖАР: ${total} шт.${parts > 1 ? ` Часть ${part}/${parts}.` : ''} Возьми в работу.\n` +
  'Формат: [тип] Экран(id) › testID — что видел ревьюер.\n';

/** Orders drafts by screen (in order of first note), keeps numbering across parts, packs parts up to 4 KiB. */
export function batchParts(drafts: ReviewDraft[]): BatchPart[] {
  const screens: string[] = [];
  for (const d of drafts) if (!screens.includes(d.anchor.split(' › ')[0])) screens.push(d.anchor.split(' › ')[0]);
  const ordered = [...drafts].sort((a, b) => screens.indexOf(a.anchor.split(' › ')[0]) - screens.indexOf(b.anchor.split(' › ')[0]) || a.createdAt - b.createdAt);
  const items = ordered.map((d, i) => ({ id: d.id, text: formatItem(d, i + 1) }));

  // Pack with a worst-case header, then stamp the real part numbers.
  const room = MAX_BYTES - bytes(header(999, 99, 99));
  const groups: Array<typeof items> = [];
  let cur: typeof items = [];
  let size = 0;
  for (const it of items) {
    const b = bytes(it.text) + 2;
    if (cur.length && size + b > room) {
      groups.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(it);
    size += b;
  }
  if (cur.length) groups.push(cur);
  return groups.map((g, i) => ({ text: header(items.length, i + 1, groups.length) + '\n' + g.map((x) => x.text).join('\n\n'), ids: g.map((x) => x.id) }));
}

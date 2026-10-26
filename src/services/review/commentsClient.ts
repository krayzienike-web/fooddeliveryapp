import type { BatchPart } from '@/features/review/model/batch';

/**
 * Delivers a review batch through the claude.ai artifact runtime (`comments` capability): each part becomes
 * a comment thread «sent to Claude», so the session that builds the demo picks it up as one task.
 * Where no Claude session is listening, the batch is posted as a plain comment to be picked up later;
 * outside claude.ai it goes to the clipboard.
 */

type Anchor = { path: string; x: number; y: number };
interface CommentsNs {
  anchorFor(el: Element): Promise<Anchor>;
  create(o: { anchor: Anchor; text: string }): Promise<{ threadId: string }>;
  sendToClaude?(o: { anchor: Anchor; text: string }): Promise<{ threadId: string }>;
  canSendToClaude?(): Promise<string>;
}
interface Runtime {
  use(name: 'comments'): Promise<CommentsNs | null>;
}

export type Channel = 'claude' | 'comment' | 'clipboard' | 'none';

export interface SendOutcome {
  /** Ids of drafts that went through (whole parts only). */
  sentIds: string[];
  via: Exclude<Channel, 'none'> | null;
  /** Error code of the part that stopped the batch, if any. */
  error?: string;
}

const runtime = () => (globalThis as { claude?: Runtime }).claude;

/** Cheap check for the panel: where would «Отправить» deliver right now. Posts nothing. */
export async function deliveryChannel(): Promise<Channel> {
  const rt = runtime();
  if (!rt?.use) return typeof navigator !== 'undefined' && navigator.clipboard ? 'clipboard' : 'none';
  const c = await rt.use('comments').catch(() => null);
  if (!c) return 'none';
  const can = await c.canSendToClaude?.().catch(() => 'off');
  return can === 'available' ? 'claude' : 'comment';
}

export async function sendBatch(parts: BatchPart[], anchorEl: Element, channel: Channel): Promise<SendOutcome> {
  if (channel === 'none' || !parts.length) return { sentIds: [], via: null, error: 'unavailable' };
  if (channel === 'clipboard') {
    try {
      await navigator.clipboard.writeText(parts.map((p) => p.text).join('\n\n---\n\n'));
      return { sentIds: parts.flatMap((p) => p.ids), via: 'clipboard' };
    } catch {
      return { sentIds: [], via: null, error: 'clipboard' };
    }
  }
  const c = await runtime()?.use('comments').catch(() => null);
  if (!c) return { sentIds: [], via: null, error: 'unavailable' };
  const sentIds: string[] = [];
  // Parts go one by one: a part that fails stops the batch, its drafts stay for the next try.
  for (const p of parts) {
    try {
      const anchor = await c.anchorFor(anchorEl);
      if (channel === 'claude' && c.sendToClaude) await c.sendToClaude({ anchor, text: p.text });
      else await c.create({ anchor, text: p.text });
      sentIds.push(...p.ids);
    } catch (e) {
      return { sentIds, via: sentIds.length ? channel : null, error: (e as { code?: string })?.code ?? 'upstream_error' };
    }
  }
  return { sentIds, via: channel };
}

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/shared/lib/storage';
import type { ReviewDraft, ReviewKind } from './batch';

export interface ReviewTarget {
  anchor: string;
  route: string;
  label: string;
}

export interface SentBatch {
  at: number;
  count: number;
  /** 'claude' — sent to work; 'comment' — saved as a plain comment (no Claude session was listening). */
  via: 'claude' | 'comment' | 'clipboard';
}

interface ReviewState {
  drafts: ReviewDraft[];
  sent: SentBatch[];
  /** UI: panel open, element picking, composer target/draft. Not persisted. */
  panel: boolean;
  picking: boolean;
  composing?: { target: ReviewTarget; draftId?: string };
  setPanel: (v: boolean) => void;
  setPicking: (v: boolean) => void;
  compose: (target: ReviewTarget, draftId?: string) => void;
  closeComposer: () => void;
  save: (input: { target: ReviewTarget; kind: ReviewKind; text: string; draftId?: string }) => void;
  remove: (id: string) => void;
  markSent: (ids: string[], via: SentBatch['via']) => void;
}

let seq = 0;

/**
 * Reviewer's notes waiting to be sent (D0). Drafts survive a reload of the artifact — a review session
 * can take a while — so they're persisted next to session/cart, under their own key.
 */
export const useReview = create<ReviewState>()(
  persist(
    (set) => ({
      drafts: [],
      sent: [],
      panel: false,
      picking: false,
      setPanel: (panel) => set({ panel }),
      setPicking: (picking) => set({ picking, panel: false }),
      compose: (target, draftId) => set({ composing: { target, draftId }, picking: false, panel: false }),
      closeComposer: () => set({ composing: undefined }),
      save: ({ target, kind, text, draftId }) =>
        set((s) => ({
          composing: undefined,
          drafts: draftId
            ? s.drafts.map((d) => (d.id === draftId ? { ...d, kind, text } : d))
            : [...s.drafts, { id: `r${Date.now().toString(36)}${(seq++).toString(36)}`, ...target, kind, text, createdAt: Date.now() }],
        })),
      remove: (id) => set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id), composing: undefined })),
      markSent: (ids, via) =>
        set((s) => ({
          drafts: s.drafts.filter((d) => !ids.includes(d.id)),
          sent: [{ at: Date.now(), count: ids.length, via }, ...s.sent].slice(0, 10),
        })),
    }),
    { name: 'zhar-review', storage: createJSONStorage(() => safeStorage), partialize: (s) => ({ drafts: s.drafts, sent: s.sent }) },
  ),
);

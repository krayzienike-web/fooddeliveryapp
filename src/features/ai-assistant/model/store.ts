import { create } from 'zustand';
import type { Restaurant } from '@/entities/restaurant/model/types';
import { api } from '@/services';
import { AiError, getAiClient, type AiTurn } from '@/services/ai';
import { snapshotContext } from './context';
import { CARDS_SEPARATOR, buildInstructions, parseReply, visibleText, type AssistantCard } from './protocol';
import { scriptedTurn, type ScriptedMemory } from './scripted';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards: AssistantCard[];
  chips: string[];
  status: 'thinking' | 'streaming' | 'done';
  /** Who answered: real Claude or the offline fallback. */
  source?: 'claude' | 'scripted';
}

interface AssistantState {
  messages: ChatMessage[];
  busy: boolean;
  /** Real Claude is reachable in this build (decided lazily on first send). */
  mode: 'unknown' | 'claude' | 'scripted';
  /** Offline brain's memory of the last request/set/booking, for follow-ups. */
  memory: ScriptedMemory;
  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/** Keep the prompt small: only the latest turns go to Claude, instructions are always resent. */
const HISTORY_TURNS = 10;

let ctl: AbortController | null = null;
let restaurants: Restaurant[] | null = null;
let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export const useAssistant = create<AssistantState>((set, get) => {
  const patch = (id: string, p: Partial<ChatMessage>) => set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...p } : m)) });

  return {
    messages: [],
    busy: false,
    mode: 'unknown',
    memory: {},

    async send(raw) {
      const text = raw.trim();
      if (!text || get().busy) return;
      const userMsg: ChatMessage = { id: nextId(), role: 'user', text, cards: [], chips: [], status: 'done' };
      const reply: ChatMessage = { id: nextId(), role: 'assistant', text: '', cards: [], chips: [], status: 'thinking' };
      const history = get().messages;
      set({ messages: [...history, userMsg, reply], busy: true });

      restaurants ??= await api.booking.restaurants();
      const ctx = snapshotContext(restaurants);
      const known = { dishIds: new Set(ctx.dishes.map((d) => d.id)), restaurantIds: new Set(ctx.restaurants.map((r) => r.id)) };

      const client = get().mode === 'scripted' ? null : await getAiClient();
      if (client) {
        ctl = new AbortController();
        const turns: AiTurn[] = [...history, userMsg]
          .filter((m) => m.status === 'done' && m.text)
          .slice(-HISTORY_TURNS)
          .map((m) => ({ role: m.role, content: m.cards.length ? `${m.text}\n${CARDS_SEPARATOR}\n${JSON.stringify({ cards: m.cards })}` : m.text }));
        // The list must start on a user turn.
        while (turns[0]?.role === 'assistant') turns.shift();
        try {
          const out = await client.complete(buildInstructions(ctx), turns, {
            signal: ctl.signal,
            onText: (t) => patch(reply.id, { text: visibleText(t), status: 'streaming' }),
          });
          const parsed = parseReply(out, known);
          patch(reply.id, { ...parsed, text: parsed.text || 'Готово.', status: 'done', source: 'claude' });
          set({ busy: false, mode: 'claude' });
          return;
        } catch (e) {
          const err = e instanceof AiError ? e : new AiError('failed', String(e));
          if (err.code === 'cancelled') {
            patch(reply.id, { text: visibleText(err.partial ?? '') || 'Остановил.', status: 'done', source: 'claude' });
            set({ busy: false });
            return;
          }
          // Consent declined or Claude unavailable → keep helping with the offline brain for the rest of the session.
          if (err.code === 'not_granted' || err.code === 'unavailable') set({ mode: 'scripted' });
        } finally {
          ctl = null;
        }
      }

      // Offline brain: a short "typing" beat so it feels like a conversation, not a lookup.
      await new Promise((r) => setTimeout(r, 450));
      const turn = scriptedTurn(text, ctx, get().memory);
      patch(reply.id, { ...turn.reply, status: 'done', source: 'scripted' });
      set({ busy: false, memory: turn.memory, mode: get().mode === 'unknown' ? 'scripted' : get().mode });
    },

    stop() {
      ctl?.abort();
    },

    reset() {
      ctl?.abort();
      set({ messages: [], busy: false, memory: {} });
    },
  };
});

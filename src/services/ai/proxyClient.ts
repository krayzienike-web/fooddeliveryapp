import { AiError, type AiClient } from './types';

/**
 * Android build: the API key never ships in the app. The app calls our proxy
 * (server/ai-proxy, a Cloudflare Worker) which holds the key and calls the Claude API.
 */
export function createProxyClient(url: string, appKey?: string): AiClient {
  return {
    kind: 'proxy',
    async complete(instructions, turns, opts) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(appKey ? { 'x-app-key': appKey } : {}) },
          body: JSON.stringify({ system: instructions.stable, context: instructions.dynamic, messages: turns }),
          signal: opts?.signal,
        });
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw new AiError('cancelled', 'aborted');
        throw new AiError('unavailable', String(e));
      }
      if (res.status === 429) throw new AiError('rate_limited', 'rate limited');
      if (!res.ok) throw new AiError('failed', `proxy ${res.status}`);
      const data = (await res.json()) as { text?: string; stopReason?: string };
      if (data.stopReason === 'refusal') throw new AiError('refused', 'refused');
      const text = data.text ?? '';
      opts?.onText?.(text);
      return text;
    },
  };
}

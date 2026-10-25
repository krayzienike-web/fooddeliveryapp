import { AiError, type AiClient, type AiErrorCode } from './types';

/**
 * Web build published as a claude.ai Artifact: Claude answers on the viewer's own account
 * through the runtime's `sample` capability. Absent anywhere else (local dev, e2e).
 */

interface SampleFn {
  (input: Array<{ role: 'user' | 'assistant'; content: string }>, opts: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
}
interface ClaudeRuntime {
  use(name: 'sample'): Promise<SampleFn | null>;
}

const MAP: Record<string, AiErrorCode> = {
  not_granted: 'not_granted',
  sampling_disabled: 'not_granted',
  not_declared: 'unavailable',
  capability_disabled: 'unavailable',
  capability_removed: 'unavailable',
  rate_limited: 'rate_limited',
  cancelled: 'cancelled',
  refused: 'refused',
};

export async function createArtifactClient(): Promise<AiClient | null> {
  const runtime = (globalThis as { claude?: ClaudeRuntime }).claude;
  if (!runtime?.use) return null;
  const sample = await runtime.use('sample').catch(() => null);
  if (!sample) return null;
  return {
    kind: 'artifact',
    async complete(instructions, turns, opts) {
      try {
        const res = await sample([{ role: 'user', content: `${instructions.stable}\n\n${instructions.dynamic}` }, ...turns], {
          modelTier: 'quick',
          cache: false,
          signal: opts?.signal,
          onText: ({ text }: { text: string }) => opts?.onText?.(text),
        });
        return res.text;
      } catch (e) {
        const err = e as { code?: string; message?: string; text?: string };
        throw new AiError(MAP[err.code ?? ''] ?? 'failed', err.message ?? 'sample failed', err.text);
      }
    },
  };
}

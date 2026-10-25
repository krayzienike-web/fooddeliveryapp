/** A chat turn as the AI backend sees it. Standing instructions travel as the first user turn. */
export interface AiTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRunOptions {
  /** Whole answer so far (assign, don't append). */
  onText?: (text: string) => void;
  signal?: AbortSignal;
}

export type AiErrorCode = 'unavailable' | 'not_granted' | 'rate_limited' | 'cancelled' | 'refused' | 'failed';

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
    /** Partial answer that may stay on screen. */
    public partial?: string,
  ) {
    super(message);
  }
}

/** Real Claude behind a transport: the artifact runtime on web, our server proxy on Android. */
export interface AiClient {
  readonly kind: 'artifact' | 'proxy';
  complete(instructions: { stable: string; dynamic: string }, turns: AiTurn[], opts?: AiRunOptions): Promise<string>;
}

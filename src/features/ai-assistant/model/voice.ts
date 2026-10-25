import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Voice input (C11). Web Speech API where the browser has it (Chrome/Android WebView);
 * the button is hidden elsewhere instead of pretending.
 */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const rec = useRef<RecognitionLike | null>(null);
  const supported = recognitionCtor() !== null;
  const final = useRef(onFinal);
  final.current = onFinal;

  const stop = useCallback(() => rec.current?.stop(), []);
  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = 'ru-RU';
    r.interimResults = true;
    r.continuous = false;
    let text = '';
    r.onresult = (e) => {
      text = Array.from(e.results).map((x) => x[0].transcript).join(' ');
      setPartial(text);
    };
    r.onerror = () => undefined;
    r.onend = () => {
      rec.current = null;
      setListening(false);
      setPartial('');
      if (text.trim()) final.current(text.trim());
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
    }
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, partial, start, stop };
}

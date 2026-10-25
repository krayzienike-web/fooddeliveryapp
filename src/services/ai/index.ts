import { Platform } from 'react-native';
import { IS_E2E } from '@/shared/config/env';
import { createArtifactClient } from './artifactClient';
import { createProxyClient } from './proxyClient';
import type { AiClient } from './types';

let pending: Promise<AiClient | null> | null = null;

/**
 * Resolves the real-Claude transport for this build, or null → the scripted brain answers.
 * e2e always runs scripted so tests are deterministic and free.
 */
export function getAiClient(): Promise<AiClient | null> {
  if (!pending) {
    pending = (async () => {
      if (IS_E2E) return null;
      const proxy = process.env.EXPO_PUBLIC_AI_PROXY_URL;
      if (proxy) return createProxyClient(proxy, process.env.EXPO_PUBLIC_AI_APP_KEY);
      if (Platform.OS === 'web') return createArtifactClient();
      return null;
    })();
  }
  return pending;
}

export * from './types';

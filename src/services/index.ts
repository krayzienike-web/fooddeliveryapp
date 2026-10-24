import { createContext, createElement, useContext, type ReactNode } from 'react';
import { E2E } from '@/shared/config/env';
import type { Api } from './contracts';
import { createApi } from './mock';

/**
 * The single place that decides which backend implementation the app talks to.
 * Swap `createApi()` for a real BFF client here; nothing else changes.
 */
export const api: Api = createApi({ seed: E2E.seed, latencyMs: E2E.speed && E2E.speed > 1 ? 60 : undefined });
if (E2E.speed) api.director.setSpeed(E2E.speed);

const ApiContext = createContext<Api>(api);

export function ApiProvider({ children }: { children: ReactNode }) {
  return createElement(ApiContext.Provider, { value: api }, children);
}

export const useApi = () => useContext(ApiContext);

export type { Api } from './contracts';

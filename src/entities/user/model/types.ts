import type { Address } from '@/entities/order/model/types';
import type { TasteVector } from '@/entities/dish/model/types';

export type LoyaltyLevel = 'bronze' | 'silver' | 'gold' | 'black';

export type DietMode = 'none' | 'pp' | 'gluten_free' | 'halal' | 'veg';

export interface User {
  id: string;
  phone: string;
  name: string;
  birthday?: string;
  avatar?: string;
  addresses: Address[];
  defaultAddressId?: string;
  points: number;
  /** Sum of orders within the current level window, ₽. */
  levelSpend: number;
  level: LoyaltyLevel;
  streakWeeks: number;
  achievements: string[];
  favorites: string[];
  diet: DietMode;
  personalization: boolean;
  savedCards: Array<{ id: string; brand: 'mir' | 'visa' | 'mc'; last4: string }>;
}

export interface TasteProfile {
  vector: TasteVector;
  /** Per-dish implicit signals (likes, views, dwell, orders). */
  dishAffinity: Record<string, number>;
  dislikedDishIds: string[];
  /** Suggestion kinds the user asked not to show again. */
  mutedSuggestionKinds: string[];
  onboarded: boolean;
}

export interface LoyaltyLevelInfo {
  id: LoyaltyLevel;
  title: string;
  threshold: number;
  cashback: number;
  perks: string[];
}

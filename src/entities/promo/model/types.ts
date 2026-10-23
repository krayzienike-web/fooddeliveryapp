import type { CategoryId } from '@/entities/dish/model/types';

export type PromoMechanic =
  | { kind: 'percent'; percent: number; categoryId?: CategoryId; minTotal?: number }
  | { kind: 'fixed'; amount: number; minTotal: number }
  | { kind: 'n_plus_one'; n: number; categoryId: CategoryId }
  | { kind: 'gift'; dishId: string; minTotal: number }
  | { kind: 'free_delivery'; minTotal: number };

export interface Promo {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  /** Hex of the promo card background. */
  tint: string;
  mechanic: PromoMechanic;
  validUntil: string;
  personal?: boolean;
  conditions: string[];
}

export interface Review {
  id: string;
  dishId?: string;
  orderId?: string;
  author: string;
  avatar?: string;
  stars: number;
  text: string;
  tags: string[];
  photo?: string;
  createdAt: number;
  helpful: number;
}

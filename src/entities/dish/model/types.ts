export type CategoryId =
  | 'combo'
  | 'pizza'
  | 'rolls'
  | 'sets'
  | 'burgers'
  | 'wok'
  | 'soups'
  | 'salads'
  | 'hot'
  | 'pasta'
  | 'breakfast'
  | 'snacks'
  | 'desserts'
  | 'drinks';

export interface Category {
  id: CategoryId;
  title: string;
  emoji: string;
}

export type DishTag =
  | 'hit'
  | 'new'
  | 'chef'
  | 'spicy'
  | 'veg'
  | 'vegan'
  | 'gluten_free'
  | 'halal'
  | 'pp'
  | 'kids';

export type Allergen = 'gluten' | 'lactose' | 'nuts' | 'fish' | 'shellfish' | 'egg' | 'soy' | 'sesame' | 'celery' | 'mustard';

/** Taste axes used by the recommendation engine and the "Taste DNA" onboarding. Values 0..1. */
export interface TasteVector {
  spicy: number;
  sweet: number;
  meat: number;
  seafood: number;
  cheesy: number;
  fresh: number;
  hearty: number;
  asian: number;
}

export type TasteAxis = keyof TasteVector;

export interface ModifierOption {
  id: string;
  title: string;
  priceDelta: number;
  /** For size options: physical diameter in cm, used by AR size switching. */
  sizeCm?: number;
  weightDelta?: number;
}

export interface ModifierGroup {
  id: string;
  title: string;
  kind: 'single' | 'multi';
  required: boolean;
  options: ModifierOption[];
  defaultOptionId?: string;
}

export interface Ingredient {
  id: string;
  title: string;
  grams?: number;
  /** Removable by the guest ("без лука"). */
  removable?: boolean;
}

export interface Nutrition {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Dish {
  id: string;
  categoryId: CategoryId;
  name: string;
  /** One-line hook shown on cards. */
  tagline: string;
  description: string;
  price: number;
  oldPrice?: number;
  weight: number;
  unit: 'г' | 'мл' | 'шт';
  nutrition: Nutrition;
  tags: DishTag[];
  allergens: Allergen[];
  ingredients: Ingredient[];
  modifierGroupIds: string[];
  taste: TasteVector;
  /** Orders per day — drives "🔥 заказали N раз сегодня" social proof. */
  popularity: number;
  rating: number;
  reviewsCount: number;
  cookMinutes: number;
  /** Key in the media manifest. */
  image: string;
  /** Present for flagship dishes that have a 3D/AR model. */
  arModel?: string;
  /** Present for dishes featured in Reels. */
  video?: string;
  pairsWith: string[];
}

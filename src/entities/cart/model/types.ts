export interface CartLine {
  /** Stable key: dishId + sorted modifier option ids + removed ingredients. */
  key: string;
  dishId: string;
  qty: number;
  optionIds: string[];
  removedIngredientIds: string[];
  /** Group cart: who added the line. Undefined = current user. */
  addedBy?: string;
}

export type FulfillmentMode = 'delivery' | 'pickup';

export interface PromoApplication {
  code: string;
  title: string;
  discount: number;
}

export interface CartTotals {
  itemsTotal: number;
  discount: number;
  deliveryFee: number;
  serviceFee: number;
  pointsSpent: number;
  tips: number;
  total: number;
  /** Amount left to reach free delivery; 0 when reached. */
  toFreeDelivery: number;
  /** Amount left to reach the gift threshold; 0 when reached. */
  toGift: number;
  pointsEarned: number;
  itemsCount: number;
}

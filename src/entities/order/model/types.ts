import type { CartLine, FulfillmentMode } from '@/entities/cart/model/types';

export type OrderStatus =
  | 'created'
  | 'accepted'
  | 'cooking'
  | 'packing'
  | 'courier_assigned'
  | 'on_the_way'
  | 'arriving'
  | 'delivered'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'cancelled';

export type PaymentMethod = 'card' | 'sbp' | 'gpay' | 'cash' | 'card_courier' | 'split';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  house: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  intercom?: string;
  comment?: string;
  point: GeoPoint;
}

export interface Courier {
  id: string;
  name: string;
  rating: number;
  vehicle: 'bike' | 'car' | 'foot' | 'scooter';
  avatar: string;
  maskedPhone: string;
}

export interface Chef {
  id: string;
  name: string;
  rating: number;
  avatar: string;
  specialty: string;
}

export type IncidentKind =
  | 'stop_list'
  | 'kitchen_delay'
  | 'courier_delay'
  | 'weather_load'
  | 'payment_failed'
  | 'cold_risk'
  | 'restaurant_overload'
  | 'not_confirmed';

export interface IncidentResolution {
  id: string;
  title: string;
  kind: 'wait' | 'cancel' | 'replace' | 'refund_item' | 'retry_payment' | 'switch_method' | 'switch_pickup' | 'confirm' | 'support';
  payload?: Record<string, unknown>;
}

export interface Incident {
  id: string;
  kind: IncidentKind;
  createdAt: number;
  title: string;
  message: string;
  compensationPoints: number;
  resolutions: IncidentResolution[];
  resolvedWith?: string;
  /** For stop_list: dish that went out of stock and replacement suggestions. */
  dishId?: string;
  replacementDishIds?: string[];
  delayMinutes?: number;
}

export interface StatusEvent {
  status: OrderStatus;
  at: number;
}

export interface Order {
  id: string;
  number: string;
  createdAt: number;
  mode: FulfillmentMode;
  lines: CartLine[];
  total: number;
  pointsEarned: number;
  pointsSpent: number;
  payment: PaymentMethod;
  address?: Address;
  restaurantId: string;
  status: OrderStatus;
  history: StatusEvent[];
  /** ETA window, epoch ms. */
  etaFrom: number;
  etaTo: number;
  promisedBy: number;
  chef: Chef;
  courier?: Courier;
  /** Route polyline for the courier, from restaurant to address. */
  route?: GeoPoint[];
  /** 0..1 progress along the route. */
  courierProgress: number;
  incidents: Incident[];
  rated?: { stars: number; tags: string[]; comment?: string };
  scheduledFor?: number;
  pickupShelf?: string;
}

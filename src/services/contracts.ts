/**
 * Backend contracts. Screens and features depend ONLY on these interfaces.
 * `src/services/mock/*` implements them with realistic latency and state machines;
 * a real BFF client can replace the mock without touching UI code.
 */
import type { Category, Dish, ModifierGroup, Reel } from '@/entities/dish/model/types';
import type { CartLine, FulfillmentMode } from '@/entities/cart/model/types';
import type { Address, GeoPoint, Incident, IncidentKind, Order, PaymentMethod } from '@/entities/order/model/types';
import type { BanquetRequest, Booking, FloorPlan, Restaurant } from '@/entities/restaurant/model/types';
import type { Promo, Review } from '@/entities/promo/model/types';
import type { LoyaltyState, User } from '@/entities/user/model/types';
import type { WheelPrize } from '@/entities/user/model/loyalty';
import type { Gift, TableSession } from '@/entities/table/model/types';

export interface ApiError {
  code: 'network' | 'validation' | 'not_found' | 'unauthorized' | 'conflict' | 'payment_declined' | 'out_of_zone' | 'rate_limited';
  message: string;
}

export interface MenuSnapshot {
  categories: Category[];
  dishes: Dish[];
  modifiers: ModifierGroup[];
  stopList: string[];
}

export interface CatalogApi {
  getMenu(): Promise<MenuSnapshot>;
  getReviews(dishId: string): Promise<Review[]>;
  getPromos(): Promise<Promo[]>;
  getReels(): Promise<Reel[]>;
  validatePromo(code: string, itemsTotal: number): Promise<Promo>;
}

export interface AuthApi {
  /** Sends an SMS code. Test code is always 0000. */
  requestCode(phone: string): Promise<{ resendInSec: number }>;
  verifyCode(phone: string, code: string): Promise<{ token: string; user: User; isNew: boolean }>;
}

export interface ZoneCheck {
  inZone: boolean;
  zoneName: string;
  minOrder: number;
  deliveryFee: number;
  etaMinutes: [number, number];
  restaurantId: string;
}

export interface GeoApi {
  suggest(query: string): Promise<Array<{ title: string; subtitle: string; point: GeoPoint; street: string; house: string }>>;
  reverse(point: GeoPoint): Promise<{ street: string; house: string } | null>;
  checkZone(point: GeoPoint): Promise<ZoneCheck>;
  route(from: GeoPoint, to: GeoPoint): Promise<GeoPoint[]>;
}

export interface PlaceOrderInput {
  lines: CartLine[];
  mode: FulfillmentMode;
  address?: Address;
  restaurantId: string;
  payment: PaymentMethod;
  promoCode?: string;
  pointsToSpend: number;
  tips: number;
  comment?: string;
  cutlery: number;
  scheduledFor?: number;
}

export interface OrdersApi {
  place(input: PlaceOrderInput): Promise<Order>;
  list(): Promise<Order[]>;
  get(id: string): Promise<Order>;
  cancel(id: string): Promise<Order>;
  rate(id: string, stars: number, tags: string[], comment?: string, photo?: string): Promise<Order>;
  resolveIncident(orderId: string, incidentId: string, resolutionId: string): Promise<Order>;
  /** Live updates: status changes, courier movement, incidents. Returns unsubscribe. */
  subscribe(id: string, cb: (order: Order) => void): () => void;
  /** Pickup: "Я подхожу" (C14). */
  arriving(id: string): Promise<Order>;
}

export interface BookingApi {
  restaurants(): Promise<Restaurant[]>;
  floorPlan(id: string): Promise<FloorPlan>;
  availability(restaurantId: string, date: string, time: string, guests: number): Promise<{ busyTableIds: string[]; slots: string[] }>;
  book(input: Omit<Booking, 'id' | 'status' | 'createdAt'>): Promise<Booking>;
  myBookings(): Promise<Booking[]>;
  sendBanquet(req: Omit<BanquetRequest, 'id' | 'status' | 'createdAt'>): Promise<BanquetRequest>;
}

export interface UserApi {
  me(): Promise<User>;
  update(patch: Partial<User>): Promise<User>;
  addAddress(a: Omit<Address, 'id'>): Promise<User>;
}

/** Loyalty: points history and the wheel (C12). The server decides the prize; the client only animates to it. */
export interface LoyaltyApi {
  state(): Promise<LoyaltyState>;
  /** Points prizes are credited at once; other prizes become a personal promo code (see CatalogApi.getPromos). */
  spin(): Promise<{ prize: WheelPrize; promo?: Promo; state: LoyaltyState }>;
}

/** Dine-in by QR on the table (C17). */
export interface TableApi {
  /** Opens (or joins) the session for the table encoded in the QR code. */
  join(qr: string): Promise<TableSession>;
  callWaiter(sessionId: string): Promise<{ etaMinutes: number }>;
  addItems(sessionId: string, items: Array<{ dishId: string; qty: number }>): Promise<TableSession>;
  pay(sessionId: string, amount: number, itemIds?: string[]): Promise<{ session: TableSession; pointsEarned: number }>;
}

export interface GiftApi {
  send(input: Omit<Gift, 'id' | 'code' | 'createdAt'>): Promise<Gift>;
}

/** Demo-only controls ("панель режиссёра", D0). Never shipped to production. */
export interface DirectorApi {
  triggerIncident(orderId: string, kind: IncidentKind): Promise<Incident | null>;
  setSpeed(multiplier: number): void;
  reset(): Promise<void>;
}

export interface Api {
  catalog: CatalogApi;
  auth: AuthApi;
  geo: GeoApi;
  orders: OrdersApi;
  booking: BookingApi;
  user: UserApi;
  loyalty: LoyaltyApi;
  table: TableApi;
  gifts: GiftApi;
  director: DirectorApi;
}

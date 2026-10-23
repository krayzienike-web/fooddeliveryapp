import type { GeoPoint } from '@/entities/order/model/types';

export interface Restaurant {
  id: string;
  name: string;
  district: string;
  address: string;
  metro: string;
  point: GeoPoint;
  hours: string;
  openFrom: number;
  openTo: number;
  rating: number;
  reviewsCount: number;
  image: string;
  gallery: string[];
  features: string[];
  /** 0..1 current hall load. */
  load: number;
  avgCheck: number;
  phone: string;
  pickupMinutes: number;
  hasBanquetHall: boolean;
  floorPlanId: string;
}

export type TableShape = 'round' | 'square' | 'rect' | 'booth' | 'bar';
export type TableZone = 'window' | 'hall' | 'terrace' | 'vip' | 'bar';

export interface FloorTable {
  id: string;
  label: string;
  seats: number;
  shape: TableShape;
  zone: TableZone;
  /** Position/size on a 100x140 plan grid. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  view?: string;
}

export interface FloorPlan {
  id: string;
  width: number;
  height: number;
  tables: FloorTable[];
  decor: Array<{ kind: 'window' | 'bar' | 'kitchen' | 'entrance' | 'plant' | 'stage'; x: number; y: number; w: number; h: number; label?: string }>;
}

export interface Booking {
  id: string;
  restaurantId: string;
  tableId: string;
  date: string;
  time: string;
  guests: number;
  occasion?: string;
  comment?: string;
  preorder: Array<{ dishId: string; qty: number }>;
  status: 'confirmed' | 'cancelled' | 'completed';
  createdAt: number;
}

export type BanquetFormat = 'banquet' | 'buffet' | 'catering';

export interface BanquetRequest {
  id: string;
  restaurantId: string;
  date: string;
  guests: number;
  budgetPerGuest: number;
  format: BanquetFormat;
  occasion: string;
  menu: Array<{ dishId: string; qty: number }>;
  total: number;
  gramsPerGuest: number;
  status: 'draft' | 'sent' | 'confirmed';
  createdAt: number;
}

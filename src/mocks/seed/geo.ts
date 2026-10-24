import type { GeoPoint } from '@/entities/order/model/types';

/** Address book for the mock geocoder (real streets in central Saint Petersburg). */
export interface KnownAddress {
  id: string;
  street: string;
  house: string;
  district: string;
  point: GeoPoint;
}

export const KNOWN_ADDRESSES: KnownAddress[] = [
  { id: 'a-marata-25', street: 'ул. Марата', house: '25', district: 'Центральный', point: { lat: 59.9255, lng: 30.3517 } },
  { id: 'a-bmorskaya-14', street: 'ул. Большая Морская', house: '14', district: 'Адмиралтейский', point: { lat: 59.9358, lng: 30.3141 } },
  { id: 'a-nevsky-100', street: 'Невский пр.', house: '100', district: 'Центральный', point: { lat: 59.9318, lng: 30.3564 } },
  { id: 'a-kamennoostrovsky-42', street: 'Каменноостровский пр.', house: '42', district: 'Петроградский', point: { lat: 59.9661, lng: 30.3112 } },
  { id: 'a-sredny-vo-36', street: 'Средний пр. В.О.', house: '36', district: 'Василеостровский', point: { lat: 59.9407, lng: 30.2732 } },
  { id: 'a-liteyny-40', street: 'Литейный пр.', house: '40', district: 'Центральный', point: { lat: 59.9406, lng: 30.3482 } },
  { id: 'a-fontanka-90', street: 'наб. реки Фонтанки', house: '90', district: 'Центральный', point: { lat: 59.9273, lng: 30.3283 } },
  { id: 'a-zagorodny-14', street: 'Загородный пр.', house: '14', district: 'Центральный', point: { lat: 59.9268, lng: 30.3433 } },
  { id: 'a-chaykovskogo-60', street: 'ул. Чайковского', house: '60', district: 'Центральный', point: { lat: 59.9466, lng: 30.3627 } },
  { id: 'a-sadovaya-32', street: 'Садовая ул.', house: '32', district: 'Адмиралтейский', point: { lat: 59.9274, lng: 30.3157 } },
  { id: 'a-bolshaya-konyushennaya-27', street: 'ул. Большая Конюшенная', house: '27', district: 'Центральный', point: { lat: 59.9381, lng: 30.3235 } },
  { id: 'a-kronverksky-49', street: 'Кронверкский пр.', house: '49', district: 'Петроградский', point: { lat: 59.9574, lng: 30.3083 } },
  { id: 'a-ligovsky-74', street: 'Лиговский пр.', house: '74', district: 'Центральный', point: { lat: 59.9197, lng: 30.3555 } },
  { id: 'a-moskovsky-7', street: 'Московский пр.', house: '7', district: 'Адмиралтейский', point: { lat: 59.9239, lng: 30.3176 } },
  { id: 'a-vosstaniya-35', street: 'ул. Восстания', house: '35', district: 'Центральный', point: { lat: 59.9389, lng: 30.3613 } },
  { id: 'a-bolshoy-pso-80', street: 'Большой пр. П.С.', house: '80', district: 'Петроградский', point: { lat: 59.9646, lng: 30.3118 } },
];

/** Delivery zone polygon (simplified central SPb). */
export const DELIVERY_ZONE: GeoPoint[] = [
  { lat: 59.982, lng: 30.25 },
  { lat: 59.982, lng: 30.41 },
  { lat: 59.908, lng: 30.41 },
  { lat: 59.908, lng: 30.25 },
];

export function pointInPolygon(p: GeoPoint, poly: GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.lat > p.lat !== b.lat > p.lat && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

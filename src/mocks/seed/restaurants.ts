import type { FloorPlan, FloorTable, Restaurant } from '@/entities/restaurant/model/types';

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'r-rubinshteyna', name: 'ЖАР на Рубинштейна', district: 'Центральный', address: 'ул. Рубинштейна, 15', metro: 'Достоевская',
    point: { lat: 59.9298, lng: 30.3449 }, hours: '10:00–02:00', openFrom: 10, openTo: 26, rating: 4.9, reviewsCount: 3120,
    image: 'rest-1', gallery: ['rest-1', 'kitchen-1', 'rest-6'], features: ['Открытая кухня', 'Бар', 'До 2 ночи', 'Веранда летом'],
    load: 0.82, avgCheck: 1600, phone: '+7 (812) 407-15-15', pickupMinutes: 15, hasBanquetHall: true, floorPlanId: 'plan-a',
  },
  {
    id: 'r-nevsky', name: 'ЖАР на Невском', district: 'Центральный', address: 'Невский пр., 74', metro: 'Маяковская',
    point: { lat: 59.9326, lng: 30.3479 }, hours: '09:00–00:00', openFrom: 9, openTo: 24, rating: 4.8, reviewsCount: 4410,
    image: 'rest-2', gallery: ['rest-2', 'rest-4', 'kitchen-2'], features: ['Завтраки с 9:00', 'Окна на Невский', 'Детская комната'],
    load: 0.64, avgCheck: 1400, phone: '+7 (812) 407-74-74', pickupMinutes: 12, hasBanquetHall: true, floorPlanId: 'plan-b',
  },
  {
    id: 'r-petrogradka', name: 'ЖАР Петроградка', district: 'Петроградский', address: 'Большой пр. П.С., 51', metro: 'Петроградская',
    point: { lat: 59.9619, lng: 30.3009 }, hours: '10:00–00:00', openFrom: 10, openTo: 24, rating: 4.8, reviewsCount: 2210,
    image: 'rest-3', gallery: ['rest-3', 'kitchen-3'], features: ['Панорамные окна', 'Самовывоз за 10 минут'],
    load: 0.45, avgCheck: 1350, phone: '+7 (812) 407-51-51', pickupMinutes: 10, hasBanquetHall: false, floorPlanId: 'plan-b',
  },
  {
    id: 'r-vasileostrovsky', name: 'ЖАР Васильевский', district: 'Василеостровский', address: '7-я линия В.О., 34', metro: 'Василеостровская',
    point: { lat: 59.9417, lng: 30.2791 }, hours: '10:00–23:00', openFrom: 10, openTo: 23, rating: 4.7, reviewsCount: 1870,
    image: 'rest-5', gallery: ['rest-5', 'kitchen-4'], features: ['Студенческая скидка', 'Настолки'],
    load: 0.38, avgCheck: 1150, phone: '+7 (812) 407-34-34', pickupMinutes: 12, hasBanquetHall: false, floorPlanId: 'plan-a',
  },
  {
    id: 'r-novaya-gollandiya', name: 'ЖАР Новая Голландия', district: 'Адмиралтейский', address: 'наб. Адмиралтейского канала, 2', metro: 'Адмиралтейская',
    point: { lat: 59.9295, lng: 30.2896 }, hours: '11:00–00:00', openFrom: 11, openTo: 24, rating: 4.9, reviewsCount: 2650,
    image: 'rest-4', gallery: ['rest-4', 'banquet-1', 'kitchen-5'], features: ['Банкетный зал на 80 гостей', 'Вид на остров', 'Живая музыка по пятницам'],
    load: 0.71, avgCheck: 1900, phone: '+7 (812) 407-02-02', pickupMinutes: 15, hasBanquetHall: true, floorPlanId: 'plan-c',
  },
  {
    id: 'r-gorokhovaya', name: 'ЖАР на Гороховой', district: 'Адмиралтейский', address: 'Гороховая ул., 38', metro: 'Сенная площадь',
    point: { lat: 59.9277, lng: 30.3215 }, hours: '10:00–01:00', openFrom: 10, openTo: 25, rating: 4.7, reviewsCount: 1980,
    image: 'rest-6', gallery: ['rest-6', 'kitchen-1'], features: ['Бизнес-ланч 12–16', 'Wi-Fi и розетки'],
    load: 0.56, avgCheck: 1200, phone: '+7 (812) 407-38-38', pickupMinutes: 12, hasBanquetHall: false, floorPlanId: 'plan-b',
  },
  {
    id: 'r-smolny', name: 'ЖАР Смольный', district: 'Центральный', address: 'Суворовский пр., 34', metro: 'Чернышевская',
    point: { lat: 59.9408, lng: 30.3787 }, hours: '10:00–23:00', openFrom: 10, openTo: 23, rating: 4.8, reviewsCount: 1540,
    image: 'rest-7', gallery: ['rest-7', 'banquet-2'], features: ['Тихий зал', 'Парковка'],
    load: 0.29, avgCheck: 1500, phone: '+7 (812) 407-34-00', pickupMinutes: 10, hasBanquetHall: true, floorPlanId: 'plan-c',
  },
  {
    id: 'r-ligovsky', name: 'ЖАР Лиговский', district: 'Центральный', address: 'Лиговский пр., 50', metro: 'Лиговский проспект',
    point: { lat: 59.9232, lng: 30.3584 }, hours: 'круглосуточно', openFrom: 0, openTo: 24, rating: 4.6, reviewsCount: 3330,
    image: 'rest-8', gallery: ['rest-8', 'kitchen-2'], features: ['24/7', 'Ночное меню', 'Окно выдачи для курьеров'],
    load: 0.9, avgCheck: 1100, phone: '+7 (812) 407-50-50', pickupMinutes: 8, hasBanquetHall: false, floorPlanId: 'plan-a',
  },
];

const t = (id: string, label: string, seats: number, shape: FloorTable['shape'], zone: FloorTable['zone'], x: number, y: number, w: number, h: number, view?: string): FloorTable => ({ id, label, seats, shape, zone, x, y, w, h, view });

/** Plans on a 100×140 grid. */
export const FLOOR_PLANS: FloorPlan[] = [
  {
    id: 'plan-a', width: 100, height: 140,
    decor: [
      { kind: 'window', x: 0, y: 8, w: 3, h: 90, label: 'Окна на улицу' },
      { kind: 'bar', x: 62, y: 8, w: 34, h: 12, label: 'Бар' },
      { kind: 'kitchen', x: 56, y: 104, w: 44, h: 32, label: 'Открытая кухня' },
      { kind: 'entrance', x: 6, y: 130, w: 20, h: 8, label: 'Вход' },
      { kind: 'plant', x: 46, y: 60, w: 6, h: 6 },
    ],
    tables: [
      t('A1', '1', 2, 'square', 'window', 8, 10, 14, 14, 'Вид на улицу Рубинштейна'),
      t('A2', '2', 2, 'square', 'window', 8, 32, 14, 14, 'Вид на улицу'),
      t('A3', '3', 4, 'rect', 'window', 8, 54, 14, 24, 'Вид на улицу'),
      t('A4', '4', 4, 'rect', 'window', 8, 86, 14, 24, 'Вид на улицу'),
      t('A5', '5', 4, 'round', 'hall', 30, 24, 16, 16),
      t('A6', '6', 4, 'round', 'hall', 30, 54, 16, 16),
      t('A7', '7', 6, 'booth', 'hall', 30, 84, 22, 18, 'Уютный диван'),
      t('A8', '8', 2, 'bar', 'bar', 64, 24, 8, 8, 'У барной стойки'),
      t('A9', '9', 2, 'bar', 'bar', 76, 24, 8, 8, 'У барной стойки'),
      t('A10', '10', 2, 'bar', 'bar', 88, 24, 8, 8, 'У барной стойки'),
      t('A11', '11', 4, 'square', 'hall', 66, 46, 16, 16),
      t('A12', '12', 8, 'rect', 'vip', 64, 72, 30, 22, 'Шеф-стол у кухни'),
    ],
  },
  {
    id: 'plan-b', width: 100, height: 140,
    decor: [
      { kind: 'window', x: 0, y: 0, w: 100, h: 3, label: 'Панорамные окна' },
      { kind: 'bar', x: 70, y: 60, w: 26, h: 14, label: 'Бар' },
      { kind: 'kitchen', x: 0, y: 112, w: 50, h: 28, label: 'Кухня' },
      { kind: 'entrance', x: 74, y: 130, w: 20, h: 8, label: 'Вход' },
      { kind: 'plant', x: 48, y: 50, w: 6, h: 6 },
    ],
    tables: [
      t('B1', '1', 2, 'round', 'window', 6, 8, 12, 12, 'У окна на проспект'),
      t('B2', '2', 2, 'round', 'window', 26, 8, 12, 12, 'У окна на проспект'),
      t('B3', '3', 4, 'square', 'window', 46, 8, 16, 16, 'У окна на проспект'),
      t('B4', '4', 4, 'square', 'window', 70, 8, 16, 16, 'У окна на проспект'),
      t('B5', '5', 6, 'booth', 'hall', 6, 38, 24, 18, 'Диван'),
      t('B6', '6', 6, 'booth', 'hall', 6, 66, 24, 18, 'Диван'),
      t('B7', '7', 4, 'round', 'hall', 40, 70, 16, 16),
      t('B8', '8', 4, 'round', 'hall', 40, 92, 16, 16),
      t('B9', '9', 2, 'bar', 'bar', 72, 80, 8, 8),
      t('B10', '10', 2, 'bar', 'bar', 86, 80, 8, 8),
      t('B11', '11', 10, 'rect', 'vip', 62, 98, 34, 24, 'Большой стол для компании'),
    ],
  },
  {
    id: 'plan-c', width: 100, height: 140,
    decor: [
      { kind: 'window', x: 97, y: 10, w: 3, h: 120, label: 'Вид на канал' },
      { kind: 'stage', x: 8, y: 6, w: 40, h: 14, label: 'Сцена' },
      { kind: 'bar', x: 56, y: 6, w: 34, h: 12, label: 'Бар' },
      { kind: 'entrance', x: 6, y: 130, w: 20, h: 8, label: 'Вход' },
      { kind: 'plant', x: 50, y: 70, w: 6, h: 6 },
    ],
    tables: [
      t('C1', '1', 4, 'round', 'hall', 10, 30, 16, 16),
      t('C2', '2', 4, 'round', 'hall', 32, 30, 16, 16),
      t('C3', '3', 6, 'round', 'hall', 10, 56, 20, 20),
      t('C4', '4', 6, 'round', 'hall', 34, 56, 20, 20),
      t('C5', '5', 2, 'square', 'window', 78, 28, 14, 14, 'Вид на канал'),
      t('C6', '6', 2, 'square', 'window', 78, 50, 14, 14, 'Вид на канал'),
      t('C7', '7', 4, 'rect', 'window', 78, 72, 14, 22, 'Вид на канал'),
      t('C8', '8', 4, 'rect', 'window', 78, 100, 14, 22, 'Вид на канал'),
      t('C9', '9', 12, 'rect', 'vip', 10, 88, 50, 30, 'Банкетный стол'),
      t('C10', '10', 2, 'bar', 'bar', 60, 24, 8, 8),
    ],
  },
];

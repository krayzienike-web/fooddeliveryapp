import type { Promo } from '@/entities/promo/model/types';

export const PROMOS: Promo[] = [
  {
    id: 'p-friday', code: 'ПЯТНИЦА', title: 'Пятничный разнос −20%', subtitle: 'Пицца и сеты по пятницам с 17:00',
    description: 'Скидка 20% на все пиццы в пятницу вечером. Действует на доставку и самовывоз.',
    image: 'pz-pepperoni', tint: '#3A1408', mechanic: { kind: 'percent', percent: 20, categoryId: 'pizza' }, validUntil: '2026-12-31',
    conditions: ['Пятница, 17:00–23:59', 'Только категория «Пицца»', 'Не суммируется с другими акциями'],
  },
  {
    id: 'p-2plus1', code: 'РОЛЛЫ3', title: '2 + 1 на роллы', subtitle: 'Третий ролл — в подарок',
    description: 'Каждый третий ролл (самый дешёвый) бесплатно. Собирайте сеты под себя.',
    image: 'rl-philadelphia', tint: '#0E2A2E', mechanic: { kind: 'n_plus_one', n: 2, categoryId: 'rolls' }, validUntil: '2026-11-30',
    conditions: ['Категория «Роллы»', 'Бесплатна самая дешёвая позиция'],
  },
  {
    id: 'p-first', code: 'ЖАР300', title: '−300 ₽ на первый заказ', subtitle: 'При заказе от 1200 ₽',
    description: 'Приветственная скидка новым гостям. Просто введите промокод в корзине.',
    image: 'bg-zhar', tint: '#2B1A0A', mechanic: { kind: 'fixed', amount: 300, minTotal: 1200 }, validUntil: '2026-12-31', personal: true,
    conditions: ['Только первый заказ', 'Минимальная сумма 1200 ₽'],
  },
  {
    id: 'p-dessert', code: 'СЛАДКО', title: 'Чизкейк в подарок', subtitle: 'К заказу от 2000 ₽',
    description: 'Добавим чизкейк Нью-Йорк к любому заказу от 2000 ₽.',
    image: 'des-cheesecake', tint: '#2A1020', mechanic: { kind: 'gift', dishId: 'des-cheesecake', minTotal: 2000 }, validUntil: '2026-11-15',
    conditions: ['Один подарок на заказ'],
  },
  {
    id: 'p-freedel', code: 'ДОСТАВКА0', title: 'Бесплатная доставка', subtitle: 'От 700 ₽ в будни до 16:00',
    description: 'Обеденная доставка бесплатно от 700 ₽. Привезём за 30 минут в центре.',
    image: 'snd-tom-yum', tint: '#2E1E08', mechanic: { kind: 'free_delivery', minTotal: 700 }, validUntil: '2026-12-31',
    conditions: ['Пн–пт, 11:00–16:00'],
  },
  {
    id: 'p-burger', code: 'БУРГЕР15', title: '−15% на бургеры', subtitle: 'Персонально для вас',
    description: 'Вы любите сочное и мясное — держите скидку на все бургеры до конца недели.',
    image: 'bg-double-bacon', tint: '#241208', mechanic: { kind: 'percent', percent: 15, categoryId: 'burgers' }, validUntil: '2026-10-31', personal: true,
    conditions: ['Категория «Бургеры»', 'До воскресенья'],
  },
];

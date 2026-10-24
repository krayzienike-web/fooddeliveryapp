import type { CartLine } from '@/entities/cart/model/types';
import type { Address, Order } from '@/entities/order/model/types';
import type { User } from '@/entities/user/model/types';
import { CHEFS, COURIERS } from './people';

export const DEMO_PHONE = '9215551234';

export const DEMO_ADDRESSES: Address[] = [
  { id: 'addr-home', label: 'Дом', street: 'ул. Марата', house: '25', apartment: '14', entrance: '2', floor: '4', intercom: '14В', point: { lat: 59.9255, lng: 30.3517 } },
  { id: 'addr-work', label: 'Работа', street: 'ул. Большая Морская', house: '14', entrance: '1', floor: '3', comment: 'Офис 305, на ресепшене скажите «ЖАР»', point: { lat: 59.9358, lng: 30.3141 } },
];

export function demoUser(now: number): User {
  const bd = new Date(now + 4 * 86400000);
  return {
    id: 'u-demo',
    phone: DEMO_PHONE,
    name: 'Алекс',
    birthday: `1994-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`,
    addresses: DEMO_ADDRESSES,
    defaultAddressId: 'addr-home',
    points: 1840,
    levelSpend: 26400,
    level: 'silver',
    streakWeeks: 3,
    achievements: ['first-order', 'pizza-lover', 'night-owl', 'soup-season'],
    favorites: ['pz-pepperoni', 'snd-tom-yum', 'rl-philadelphia', 'bg-zhar'],
    diet: 'none',
    personalization: true,
    savedCards: [
      { id: 'card-1', brand: 'mir', last4: '4417' },
      { id: 'card-2', brand: 'visa', last4: '0932' },
    ],
  };
}

const line = (dishId: string, qty = 1, optionIds: string[] = []): CartLine => ({ key: `${dishId}|${optionIds.join(',')}|`, dishId, qty, optionIds, removedIngredientIds: [] });

function lastWeekday(now: number, weekday: number, weeksAgo: number, hour: number, minute: number): number {
  const d = new Date(now);
  const diff = (d.getDay() - weekday + 7) % 7 || 7;
  d.setDate(d.getDate() - diff - (weeksAgo - 1) * 7);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function delivered(id: string, createdAt: number, lines: CartLine[], total: number, address: Address, restaurantId: string): Order {
  return {
    id,
    number: id.replace('o-', '').toUpperCase(),
    createdAt,
    mode: 'delivery',
    lines,
    total,
    pointsEarned: Math.floor(total * 0.05),
    pointsSpent: 0,
    payment: 'card',
    address,
    restaurantId,
    status: 'delivered',
    history: [
      { status: 'created', at: createdAt },
      { status: 'delivered', at: createdAt + 34 * 60000 },
    ],
    etaFrom: createdAt + 30 * 60000,
    etaTo: createdAt + 40 * 60000,
    promisedBy: createdAt + 40 * 60000,
    chef: CHEFS[0],
    courier: COURIERS[0],
    courierProgress: 1,
    incidents: [],
    rated: { stars: 5, tags: ['Вкусно', 'Горячее'] },
  };
}

/**
 * Three months of orders with clear patterns so that predictions (D2) light up:
 * - Friday ~19:00: Pepperoni + wings + cola (ritual)
 * - Tuesday lunch at work: Tom yum + Philadelphia
 * - Saturday: big company orders
 */
export function demoOrderHistory(now: number): Order[] {
  const [home, work] = DEMO_ADDRESSES;
  const out: Order[] = [];
  for (let w = 1; w <= 10; w++) {
    if (w !== 3 && w !== 7) {
      out.push(delivered(`o-fri${w}`, lastWeekday(now, 5, w, 19, 5 + w * 2), [line('pz-pepperoni', 1, ['pz-35']), line('snk-wings'), line('drk-cola', 2)], 1830, home, 'r-rubinshteyna'));
    }
    if (w % 2 === 1) {
      out.push(delivered(`o-tue${w}`, lastWeekday(now, 2, w, 13, 10), [line('snd-tom-yum'), line('rl-philadelphia')], 1280, work, 'r-gorokhovaya'));
    }
    if (w % 3 === 0) {
      out.push(delivered(`o-sat${w}`, lastWeekday(now, 6, w, 18, 40), [line('set-big-philly'), line('cmb-friday'), line('drk-lemonade-mango', 3), line('des-cheesecake', 2)], 6450, home, 'r-nevsky'));
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Dishes the guest looked at several times but never ordered (D2 "viewed_not_ordered"). */
export const DEMO_VIEW_COUNTS: Record<string, number> = { 'hot-ribeye': 4, 'pa-truffle': 2 };

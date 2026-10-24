import type { Order } from '@/entities/order/model/types';
import type { Context } from '@/features/recommendations/model/engine';

/**
 * Preventive request (D2): infer what the guest most likely wants right now from order history,
 * show at most ONE suggestion in one place, explain why, and respect "не предлагать такое".
 */

export type PredictionKind = 'ritual' | 'reorder_cycle' | 'abandoned_cart' | 'viewed_not_ordered' | 'near_restaurant' | 'company_weekend' | 'birthday' | 'weather';

export interface Prediction {
  kind: PredictionKind;
  title: string;
  subtitle: string;
  why: string;
  confidence: number;
  /** Dish ids to show / add; for ritual & reorder this is the previous order. */
  dishIds: string[];
  orderId?: string;
  cta: string;
}

export interface PredictInput {
  orders: Order[];
  now: number;
  ctx: Context;
  cartDishIds: string[];
  cartUpdatedAt?: number;
  viewCounts: Record<string, number>;
  orderedDishIds: string[];
  nearRestaurantName?: string;
  birthdayInDays?: number;
  muted: string[];
}

export const CONFIDENCE_THRESHOLD = 0.6;

/** Russian plural: 1 раз, 2 раза, 5 раз. */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const WEEKDAY_TITLE = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
const WEEKDAY_PLURAL = ['по воскресеньям', 'по понедельникам', 'по вторникам', 'по средам', 'по четвергам', 'по пятницам', 'по субботам'];

/** Orders that happened on the same weekday within ±90 minutes of the current time. */
export function ritualMatches(orders: Order[], now: number): Order[] {
  const d = new Date(now);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return orders.filter((o) => {
    const od = new Date(o.createdAt);
    const om = od.getHours() * 60 + od.getMinutes();
    return od.getDay() === d.getDay() && Math.abs(om - minutes) <= 90;
  });
}

function mostFrequentOrder(orders: Order[]): Order | undefined {
  const sig = (o: Order) => o.lines.map((l) => l.dishId).sort().join(',');
  const counts = new Map<string, { n: number; o: Order }>();
  for (const o of orders) {
    const k = sig(o);
    const c = counts.get(k);
    counts.set(k, { n: (c?.n ?? 0) + 1, o: c && c.o.createdAt > o.createdAt ? c.o : o });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.o;
}

export function averageCycleDays(orders: Order[]): number | null {
  if (orders.length < 3) return null;
  const ts = orders.map((o) => o.createdAt).sort((a, b) => a - b);
  let sum = 0;
  for (let i = 1; i < ts.length; i++) sum += ts[i] - ts[i - 1];
  return sum / (ts.length - 1) / 86400000;
}

export function predict(input: PredictInput): Prediction[] {
  const out: Prediction[] = [];
  const { orders, now, ctx } = input;
  const weekday = new Date(now).getDay();

  const ritual = ritualMatches(orders, now);
  if (ritual.length >= 3) {
    const o = mostFrequentOrder(ritual)!;
    out.push({
      kind: 'ritual',
      title: `Как обычно в ${WEEKDAY_TITLE[weekday]}?`,
      subtitle: 'Соберём тот же заказ в один тап',
      why: `Вы заказываете это ${WEEKDAY_PLURAL[weekday]} около ${new Date(o.createdAt).getHours()}:00 — ${ritual.length} ${plural(ritual.length, 'раз', 'раза', 'раз')} за последние недели`,
      confidence: Math.min(0.95, 0.55 + ritual.length * 0.1),
      dishIds: o.lines.map((l) => l.dishId),
      orderId: o.id,
      cta: 'Повторить',
    });
  }

  if (input.cartDishIds.length && input.cartUpdatedAt && now - input.cartUpdatedAt > 60 * 60000) {
    out.push({
      kind: 'abandoned_cart',
      title: 'Ваша корзина на месте',
      subtitle: `${input.cartDishIds.length} поз. ждут оформления`,
      why: 'Вы собрали корзину, но не оформили заказ',
      confidence: 0.7,
      dishIds: input.cartDishIds,
      cta: 'Перейти в корзину',
    });
  }

  const cycle = averageCycleDays(orders);
  const last = orders.length ? Math.max(...orders.map((o) => o.createdAt)) : 0;
  if (cycle && last) {
    const since = (now - last) / 86400000;
    if (since >= cycle * 0.95) {
      const o = mostFrequentOrder(orders)!;
      out.push({
        kind: 'reorder_cycle',
        title: 'Соскучились?',
        subtitle: 'Ваш любимый заказ',
        why: `Обычно вы заказываете раз в ${Math.round(cycle)} дн., прошло ${Math.floor(since)}`,
        confidence: Math.min(0.85, 0.5 + (since / cycle - 0.95) * 0.5 + 0.15),
        dishIds: o.lines.map((l) => l.dishId),
        orderId: o.id,
        cta: 'Повторить',
      });
    }
  }

  const viewed = Object.entries(input.viewCounts)
    .filter(([id, n]) => n >= 3 && !input.orderedDishIds.includes(id))
    .sort((a, b) => b[1] - a[1]);
  if (viewed.length) {
    out.push({
      kind: 'viewed_not_ordered',
      title: 'Всё ещё думаете?',
      subtitle: 'Попробуйте — если не понравится, вернём баллами',
      why: `Вы смотрели это блюдо ${viewed[0][1]} ${plural(viewed[0][1], 'раз', 'раза', 'раз')}`,
      confidence: 0.62,
      dishIds: [viewed[0][0]],
      cta: 'Попробовать',
    });
  }

  if (ctx.weather !== 'clear') {
    out.push({
      kind: 'weather',
      title: ctx.weather === 'snow' ? 'Снег — время супа' : 'Дождь — время супа',
      subtitle: 'Горячее, наваристое, согревает',
      why: 'Подбираем меню под погоду в Петербурге',
      confidence: 0.61,
      dishIds: [],
      cta: 'Смотреть супы',
    });
  }

  if (input.nearRestaurantName) {
    out.push({
      kind: 'near_restaurant',
      title: `Вы рядом с «${input.nearRestaurantName}»`,
      subtitle: 'Заберите за 10 минут, без доставки и на 10% дешевле',
      why: 'Вы в 300 м от ресторана',
      confidence: 0.75,
      dishIds: [],
      cta: 'Самовывоз',
    });
  }

  if (input.birthdayInDays !== undefined && input.birthdayInDays >= 0 && input.birthdayInDays <= 7) {
    out.push({
      kind: 'birthday',
      title: input.birthdayInDays === 0 ? 'С днём рождения! 🎉' : `День рождения через ${input.birthdayInDays} ${plural(input.birthdayInDays, 'день', 'дня', 'дней')}`,
      subtitle: 'Забронируйте стол — в ДР скидка 20%',
      why: 'Мы помним о вашем празднике',
      confidence: 0.8,
      dishIds: [],
      cta: 'Забронировать',
    });
  }

  if ((weekday === 6 || weekday === 0) && ctx.hour >= 12) {
    const bigOrders = orders.filter((o) => o.lines.reduce((s, l) => s + l.qty, 0) >= 5);
    if (bigOrders.length >= 2) {
      out.push({
        kind: 'company_weekend',
        title: 'Выходные с компанией?',
        subtitle: 'Сеты на 3–5 человек',
        why: 'По выходным вы часто заказываете на нескольких человек',
        confidence: 0.64,
        dishIds: [],
        cta: 'Смотреть сеты',
      });
    }
  }

  return out
    .filter((p) => p.confidence >= CONFIDENCE_THRESHOLD && !input.muted.includes(p.kind))
    .sort((a, b) => b.confidence - a.confidence);
}

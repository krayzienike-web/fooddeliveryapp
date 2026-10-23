import type { Incident, IncidentKind, Order } from './types';

/**
 * Preventive support (D1). Pure rules: given an order and live signals, decide whether
 * we must proactively tell the guest about a problem, and how to compensate.
 */

export interface LiveSignals {
  now: number;
  /** Predicted ready/delivery time from the kitchen/courier models, epoch ms. */
  predictedEta: number;
  outOfStockDishIds: string[];
  paymentFailed: boolean;
  weather: 'clear' | 'rain' | 'snow' | 'storm';
  courierStuckMinutes: number;
  minutesSinceHandoffUnconfirmed: number;
}

export const MAX_PROACTIVE_MESSAGES_PER_ORDER = 2;

/** Compensation ladder: bigger problem → bigger gesture, decided by the system, not an operator. */
export function compensationFor(kind: IncidentKind, delayMinutes = 0): number {
  switch (kind) {
    case 'stop_list':
      return 100;
    case 'kitchen_delay':
    case 'courier_delay':
      if (delayMinutes >= 30) return 500;
      if (delayMinutes >= 20) return 300;
      if (delayMinutes >= 10) return 150;
      return 0;
    case 'cold_risk':
      return 200;
    case 'weather_load':
    case 'payment_failed':
    case 'restaurant_overload':
    case 'not_confirmed':
      return 0;
  }
}

export function lateMinutes(order: Pick<Order, 'etaTo'>, predictedEta: number): number {
  return Math.max(0, Math.round((predictedEta - order.etaTo) / 60000));
}

export function detectIncidents(order: Order, s: LiveSignals): IncidentKind[] {
  const out: IncidentKind[] = [];
  const known = new Set(order.incidents.map((i) => i.kind));
  const push = (k: IncidentKind) => {
    if (!known.has(k)) out.push(k);
  };
  if (s.paymentFailed) push('payment_failed');
  if (order.lines.some((l) => s.outOfStockDishIds.includes(l.dishId))) push('stop_list');
  const late = lateMinutes(order, s.predictedEta);
  if (late >= 10) {
    const kitchenPhase = ['created', 'accepted', 'cooking', 'packing'].includes(order.status);
    push(kitchenPhase ? 'kitchen_delay' : 'courier_delay');
  }
  if (s.courierStuckMinutes >= 8 && order.status === 'on_the_way') push('courier_delay');
  if (late >= 25 && order.status === 'on_the_way') push('cold_risk');
  if (s.minutesSinceHandoffUnconfirmed >= 5) push('not_confirmed');
  return out;
}

/** Respect the frequency cap: at most N proactive messages per order. Payment problems always pass. */
export function shouldNotify(order: Order, kind: IncidentKind): boolean {
  if (kind === 'payment_failed') return true;
  return order.incidents.filter((i) => i.kind !== 'payment_failed').length < MAX_PROACTIVE_MESSAGES_PER_ORDER;
}

export function buildIncident(kind: IncidentKind, now: number, extra: Partial<Incident> = {}): Incident {
  const delay = extra.delayMinutes ?? 0;
  const points = compensationFor(kind, delay);
  const base = { id: `inc_${kind}_${now}`, kind, createdAt: now, compensationPoints: points };
  switch (kind) {
    case 'stop_list':
      return {
        ...base,
        title: 'Одно блюдо закончилось',
        message: `Простите, оно только что ушло в стоп-лист. Подобрали похожие — замена за наш счёт, плюс ${points} баллов.`,
        resolutions: [
          { id: 'replace', title: 'Заменить', kind: 'replace' },
          { id: 'refund', title: 'Вернуть деньги за позицию', kind: 'refund_item' },
        ],
        ...extra,
      };
    case 'kitchen_delay':
      return {
        ...base,
        title: `Кухня задерживается на ${delay} мин`,
        message: points
          ? `Много заказов — повар доделывает ваш. Уже начислили ${points} баллов за ожидание.`
          : 'Много заказов — повар доделывает ваш. Держим в курсе.',
        resolutions: [
          { id: 'wait', title: 'Подожду', kind: 'wait' },
          { id: 'cancel', title: 'Отменить без штрафа', kind: 'cancel' },
        ],
        ...extra,
      };
    case 'courier_delay':
      return {
        ...base,
        title: `Курьер задерживается на ${delay} мин`,
        message: points ? `Плотная пробка на маршруте. ${points} баллов уже на вашем счёте.` : 'Плотная пробка на маршруте. Курьер едет к вам.',
        resolutions: [
          { id: 'wait', title: 'Хорошо, жду', kind: 'wait' },
          { id: 'support', title: 'Написать в поддержку', kind: 'support' },
        ],
        ...extra,
      };
    case 'cold_risk':
      return {
        ...base,
        title: 'Заказ мог немного остыть',
        message: `Курьер в пути дольше обычного. Начислили ${points} баллов, а следующую доставку сделаем приоритетной.`,
        resolutions: [{ id: 'ok', title: 'Спасибо', kind: 'wait' }],
        ...extra,
      };
    case 'weather_load':
      return {
        ...base,
        title: 'Сейчас ливень — доставка дольше',
        message: 'Курьеры едут 60–70 минут. Самовывоз будет готов через 20 минут и на 10% дешевле.',
        resolutions: [
          { id: 'pickup', title: 'Заберу сам', kind: 'switch_pickup' },
          { id: 'wait', title: 'Оставить доставку', kind: 'wait' },
        ],
        ...extra,
      };
    case 'payment_failed':
      return {
        ...base,
        title: 'Оплата не прошла',
        message: 'Банк не подтвердил платёж. Заказ ждёт — попробуйте ещё раз или выберите другой способ.',
        resolutions: [
          { id: 'retry', title: 'Повторить', kind: 'retry_payment' },
          { id: 'sbp', title: 'Оплатить через СБП', kind: 'switch_method', payload: { method: 'sbp' } },
        ],
        ...extra,
      };
    case 'restaurant_overload':
      return {
        ...base,
        title: 'Ресторан перегружен',
        message: 'Ближайший ресторан на Петроградской приготовит быстрее — на 15 минут.',
        resolutions: [
          { id: 'switch', title: 'Переключить', kind: 'switch_pickup' },
          { id: 'wait', title: 'Оставить как есть', kind: 'wait' },
        ],
        ...extra,
      };
    case 'not_confirmed':
      return {
        ...base,
        title: 'Всё получили?',
        message: 'Курьер отметил передачу заказа. Если что-то не так — решим за минуту.',
        resolutions: [
          { id: 'yes', title: 'Да, всё отлично', kind: 'confirm' },
          { id: 'no', title: 'Нет, проблема', kind: 'support' },
        ],
        ...extra,
      };
  }
}

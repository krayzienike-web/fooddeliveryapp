import { CARDS_SEPARATOR, buildInstructions, parseReply, visibleText, type AssistantContext, type DishSetCard } from '@/features/ai-assistant/model/protocol';
import { composeSet, parseRequest, parseWhen, scriptedReply } from '@/features/ai-assistant/model/scripted';
import { usualOrder } from '@/features/ai-assistant/model/context';
import { DISHES } from '@/mocks/seed/menu';
import { RESTAURANTS } from '@/mocks/seed/restaurants';
import type { Order } from '@/entities/order/model/types';

// Wednesday 2026-10-21 18:30, local time (jest runs in Europe/Moscow).
const NOW = new Date(2026, 9, 21, 18, 30);

function ctx(over: Partial<AssistantContext> = {}): AssistantContext {
  return {
    dishes: DISHES,
    ranked: [...DISHES].sort((a, b) => b.popularity - a.popularity),
    stopList: [],
    restaurants: RESTAURANTS,
    cart: [],
    cartTotal: 0,
    now: NOW,
    weather: 'ясно',
    freeDeliveryFrom: 1500,
    deliveryFee: 199,
    ...over,
  };
}
const known = { dishIds: new Set(DISHES.map((d) => d.id)), restaurantIds: new Set(RESTAURANTS.map((r) => r.id)) };
const byId = Object.fromEntries(DISHES.map((d) => [d.id, d]));
const sum = (items: Array<{ dishId: string; qty: number }>) => items.reduce((s, i) => s + byId[i.dishId].price * i.qty, 0);

describe('protocol', () => {
  test('visibleText hides the separator and the JSON tail, also while the separator is being typed', () => {
    expect(visibleText(`Привет!\n${CARDS_SEPARATOR}\n{"cards":[]}`)).toBe('Привет!');
    expect(visibleText('Привет!\n@@')).toBe('Привет!');
    expect(visibleText('Привет!')).toBe('Привет!');
  });

  test('stable part does not depend on time, cart or order, so it stays cacheable', () => {
    const a = buildInstructions(ctx());
    const b = buildInstructions(ctx({ now: new Date(2026, 9, 24, 12, 0), cart: [{ dishId: 'bg-zhar', qty: 1 }], cartTotal: 490, stopList: ['bg-zhar'] }));
    expect(b.stable).toBe(a.stable);
    expect(b.dynamic).not.toBe(a.dynamic);
  });

  test('parseReply keeps valid cards, drops unknown ids and types, merges duplicate dishes', () => {
    const raw = `Собрал.\n${CARDS_SEPARATOR}\n${JSON.stringify({
      cards: [
        { type: 'dishes', title: 'Набор', items: [{ dishId: 'pz-pepperoni', qty: 1 }, { dishId: 'nope', qty: 2 }, { dishId: 'pz-pepperoni', qty: 2 }] },
        { type: 'booking', restaurantId: 'r-nevsky', date: '2026-10-22', time: '9:00', guests: 4 },
        { type: 'booking', restaurantId: 'r-unknown', guests: 2 },
        { type: 'teleport' },
      ],
      chips: ['Дешевле', '', 'x'.repeat(80)],
    })}`;
    const r = parseReply(raw, known);
    expect(r.text).toBe('Собрал.');
    expect(r.cards).toHaveLength(2);
    expect((r.cards[0] as DishSetCard).items).toEqual([{ dishId: 'pz-pepperoni', qty: 3 }]);
    expect(r.cards[1]).toMatchObject({ type: 'booking', restaurantId: 'r-nevsky', time: '09:00', guests: 4 });
    expect(r.chips).toEqual(['Дешевле']);
  });

  test('parseReply never throws on broken JSON or missing separator', () => {
    expect(parseReply(`Ок\n${CARDS_SEPARATOR}\n{"cards":[{"type":`, known)).toEqual({ text: 'Ок', cards: [], chips: [] });
    expect(parseReply('Просто текст', known)).toEqual({ text: 'Просто текст', cards: [], chips: [] });
  });

  test('instructions carry the whole menu, restaurants and the answer format; the stop-list goes to the per-turn part', () => {
    const a = buildInstructions(ctx({ stopList: ['pz-pepperoni'] }));
    expect(a.stable).toContain(CARDS_SEPARATOR);
    expect(a.stable).toContain('r-nevsky|');
    expect(a.stable).toContain('pz-margherita|');
    expect(a.dynamic).toContain('Закончились (не предлагай): pz-pepperoni');
  });
});

describe('scripted brain — parsing', () => {
  test.each([
    ['Ужин на четверых до 3000 ₽', { people: 4, budget: 3000 }],
    ['нас 6 человек, бюджет 5к', { people: 6, budget: 5000 }],
    ['что-нибудь на двоих', { people: 2 }],
    ['хочу пиццу', { cats: ['pizza'] }],
  ])('%s', (msg, expected) => {
    expect(parseRequest(msg)).toMatchObject(expected);
  });

  test('"не острое" is not spicy', () => {
    const r = parseRequest('что-то не острое');
    expect(r.spicy).toBe(false);
    expect(r.noSpicy).toBe(true);
  });

  test('parseWhen: tomorrow at 19, Friday, evening hours', () => {
    expect(parseWhen('столик на завтра в 19:00', NOW)).toMatchObject({ date: '2026-10-22', time: '19:00', label: 'завтра' });
    expect(parseWhen('в пятницу в 8 вечера', NOW)).toMatchObject({ date: '2026-10-23', time: '20:00' });
    expect(parseWhen('столик', NOW)).toMatchObject({ date: '2026-10-21', time: undefined });
  });
});

describe('scripted brain — composing sets', () => {
  test('group set fits the budget and includes pizza', () => {
    const r = parseRequest('Ужин на четверых до 3000 ₽');
    const items = composeSet(ctx().ranked, r);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(sum(items)).toBeLessThanOrEqual(3000);
    expect(items.some((i) => byId[i.dishId].categoryId === 'pizza')).toBe(true);
  });

  test('vegetarian request contains only veg dishes', () => {
    const items = composeSet(ctx().ranked, parseRequest('собери вегетарианский ужин на троих'));
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) expect(byId[i.dishId].tags.some((t) => t === 'veg' || t === 'vegan')).toBe(true);
  });

  test('stop-listed dishes are never proposed', () => {
    const top = ctx().ranked.find((d) => d.categoryId === 'pizza')!;
    const items = composeSet(ctx().ranked, parseRequest('хочу пиццу'), [top.id]);
    expect(items.map((i) => i.dishId)).not.toContain(top.id);
  });
});

describe('scripted brain — intents', () => {
  test('group dinner → one dish card within budget', () => {
    const r = scriptedReply('Ужин на четверых до 3000 ₽', ctx());
    expect(r.cards).toHaveLength(1);
    expect(r.cards[0].type).toBe('dishes');
    expect(sum((r.cards[0] as DishSetCard).items)).toBeLessThanOrEqual(3000);
    expect(r.chips.length).toBeGreaterThan(0);
  });

  test('table booking → booking card with parsed guests/date/time and a matched restaurant', () => {
    const r = scriptedReply('Забронируй столик на Невском на завтра в 19:00 на 4 человека', ctx());
    expect(r.cards[0]).toMatchObject({ type: 'booking', restaurantId: 'r-nevsky', date: '2026-10-22', time: '19:00', guests: 4 });
  });

  test('banquet → banquet card in a restaurant with a banquet hall', () => {
    const r = scriptedReply('Хочу банкет на 30 человек', ctx());
    expect(r.cards[0]).toMatchObject({ type: 'banquet', guests: 30 });
    const id = (r.cards[0] as { restaurantId?: string }).restaurantId;
    expect(RESTAURANTS.find((x) => x.id === id)?.hasBanquetHall).toBe(true);
  });

  test('order status with and without an active order', () => {
    const order = { id: 'o1', statusTitle: 'Курьер в пути', eta: '19:10–19:20', isPickup: false };
    expect(scriptedReply('Где мой заказ?', ctx({ order })).cards).toEqual([{ type: 'order' }]);
    expect(scriptedReply('Где мой заказ?', ctx()).text).toMatch(/нет/i);
  });

  test('late courier → support card with topic', () => {
    const order = { id: 'o1', statusTitle: 'Курьер в пути', eta: '19:10–19:20', isPickup: false };
    expect(scriptedReply('курьер опаздывает', ctx({ order })).cards).toEqual([{ type: 'support', topic: 'late' }]);
  });

  test('repeat the usual order', () => {
    const usual = [{ dishId: 'pz-pepperoni', qty: 1 }, { dishId: 'drk-cola', qty: 2 }];
    const r = scriptedReply('Повтори как обычно', ctx({ usual }));
    expect(r.cards[0]).toMatchObject({ type: 'dishes', items: usual });
  });

  test('greeting falls back to personal picks', () => {
    const r = scriptedReply('привет', ctx());
    expect(r.cards[0].type).toBe('dishes');
  });
});

describe('usualOrder', () => {
  const o = (id: string, lines: Array<[string, number]>, status: Order['status'] = 'delivered') =>
    ({ id, status, lines: lines.map(([dishId, qty]) => ({ key: dishId, dishId, qty, optionIds: [], removedIngredientIds: [] })) }) as unknown as Order;

  test('picks a repeated set regardless of line order, ignores cancelled', () => {
    const orders = [o('a', [['pz-pepperoni', 1], ['drk-cola', 2]]), o('b', [['drk-cola', 2], ['pz-pepperoni', 1]]), o('c', [['bg-zhar', 1]]), o('d', [['bg-zhar', 1]], 'cancelled')];
    expect(usualOrder(orders)).toEqual([{ dishId: 'drk-cola', qty: 2 }, { dishId: 'pz-pepperoni', qty: 1 }]);
  });

  test('no repeats → undefined', () => {
    expect(usualOrder([o('a', [['bg-zhar', 1]])])).toBeUndefined();
  });
});

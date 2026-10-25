import type { CategoryId, Dish } from '@/entities/dish/model/types';
import type { Restaurant } from '@/entities/restaurant/model/types';
import { plural, rub } from '@/shared/lib/format';
import type { AssistantCard, AssistantContext, AssistantReply } from './protocol';

/**
 * Offline brain for «Шеф ИИ»: used when real Claude is unavailable (no consent, local dev, e2e).
 * Pure and deterministic. Understands the demo's key requests well enough to keep the flow alive.
 */

export interface Request {
  people?: number;
  budget?: number;
  cats: CategoryId[];
  veg: boolean;
  spicy: boolean;
  noSpicy: boolean;
  light: boolean;
  glutenFree: boolean;
  kids: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

const WORD_PEOPLE: Array<[RegExp, number]> = [
  [/вдво[её]м|двоих|на двоих|двое/, 2],
  [/втро[её]м|троих|трое/, 3],
  [/четвер/, 4],
  [/пятер/, 5],
  [/шестер/, 6],
  [/семер/, 7],
  [/восьмер/, 8],
];

const CAT_WORDS: Array<[RegExp, CategoryId]> = [
  [/пицц/, 'pizza'],
  [/ролл|суши|сашими|нигири|маки/, 'rolls'],
  [/сет/, 'sets'],
  [/бургер|чизбургер/, 'burgers'],
  [/вок|лапш/, 'wok'],
  [/суп|борщ|рамен|том.?ям|фо\b/, 'soups'],
  [/салат|поке|боул/, 'salads'],
  [/паст|спагет|лазань/, 'pasta'],
  [/завтрак|сырник|блин|омлет|каш/, 'breakfast'],
  [/десерт|сладк|торт|чизкейк/, 'desserts'],
  [/закуск|крыл|картош|фри|наггет/, 'snacks'],
  [/шашлык|стейк|горяч|мясо на|хинкал|пельмен/, 'hot'],
  [/напит|кофе|чай|лимонад|кол[аы]/, 'drinks'],
  [/комбо/, 'combo'],
];

export function parseRequest(message: string): Request {
  const t = norm(message);
  let people: number | undefined;
  const m = t.match(/(\d{1,2})\s*(человек|чел|гост|персон|друз|взросл)/) ?? t.match(/нас\s*(\d{1,2})/) ?? t.match(/на\s*(\d{1,2})\b(?!\s*(:|час|₽|р\b|руб|к\b|тыс|000))/);
  if (m) people = Number(m[1]);
  else for (const [re, n] of WORD_PEOPLE) if (re.test(t)) people = n;
  if (!people && /компани|друз|гости|вечеринк|тусовк/.test(t)) people = 4;

  let budget: number | undefined;
  const b = t.match(/(?:до|за|бюджет\w*|в пределах|уложиться в|не дороже)\s*(\d[\d\s]*(?:[.,]\d)?)\s*(к|тыс\w*|₽|р\b|руб\w*)?/);
  if (b) {
    const n = Number(b[1].replace(/\s/g, '').replace(',', '.'));
    budget = b[2] && /^(к|тыс)/.test(b[2]) ? n * 1000 : n;
    if (budget < 200) budget = undefined;
  }

  const cats: CategoryId[] = [];
  for (const [re, c] of CAT_WORDS) if (re.test(t) && !cats.includes(c)) cats.push(c);

  return {
    people,
    budget,
    cats,
    veg: /вегет|без мяса|веган|постн/.test(t),
    noSpicy: /не\s*остр|без\s*остр|неостр/.test(t),
    spicy: /остр|пикант|жгуч/.test(t) && !/не\s*остр|без\s*остр|неостр/.test(t),
    light: /пп\b|легк|диет|калор|полезн|правильн/.test(t),
    glutenFree: /без\s*глютен/.test(t),
    kids: /дет|ребен|малыш/.test(t),
  };
}

function fits(d: Dish, r: Request, stopList: string[]): boolean {
  if (stopList.includes(d.id)) return false;
  if (r.veg && !d.tags.includes('veg') && !d.tags.includes('vegan')) return false;
  if (r.glutenFree && d.allergens.includes('gluten')) return false;
  if (r.noSpicy && d.taste.spicy > 0.4) return false;
  if (r.light && d.categoryId !== 'drinks' && d.nutrition.kcal > 650) return false;
  return true;
}

interface Slot {
  cats: CategoryId[];
  qty: number;
  prefer?: (d: Dish) => number;
}

function slotsFor(r: Request): Slot[] {
  const people = r.people ?? 1;
  const spicyBoost = (d: Dish) => (r.spicy ? d.taste.spicy : 0) + (r.kids && d.tags.includes('kids') ? 1 : 0);
  if (r.cats.length) {
    // The guest named what they want: those categories first, a drink if it's a group.
    const per = Math.max(1, Math.round(people / (r.cats.includes('pizza') ? 3 : 2)));
    const s: Slot[] = r.cats.flatMap((c) => Array.from({ length: Math.min(per, 3) }, () => ({ cats: [c], qty: people > 3 && per > 3 ? Math.ceil(per / 3) : 1, prefer: spicyBoost })));
    if (people >= 3 && !r.cats.includes('drinks')) s.push({ cats: ['drinks'], qty: people });
    return s;
  }
  if (people <= 1) {
    return [
      { cats: r.light ? ['salads', 'soups', 'wok'] : ['burgers', 'pizza', 'wok', 'pasta', 'hot', 'rolls'], qty: 1, prefer: spicyBoost },
      { cats: r.light ? ['soups', 'salads'] : ['snacks', 'salads'], qty: 1 },
      { cats: ['drinks'], qty: 1 },
    ];
  }
  const s: Slot[] = [];
  const mains = Math.max(1, Math.ceil(people / 3));
  for (let i = 0; i < mains; i++) s.push({ cats: r.light ? ['salads', 'wok'] : ['pizza'], qty: 1, prefer: spicyBoost });
  if (people >= 3) s.push({ cats: r.veg ? ['rolls', 'sets'] : ['sets', 'rolls'], qty: 1, prefer: spicyBoost });
  s.push({ cats: ['snacks'], qty: Math.max(1, Math.floor(people / 3)) });
  if (people >= 4) s.push({ cats: ['salads'], qty: 1 });
  s.push({ cats: ['drinks'], qty: people });
  if (people >= 4 && !r.light) s.push({ cats: ['desserts'], qty: Math.max(1, Math.floor(people / 3)) });
  return s;
}

/** Greedy fill: each slot takes the best-ranked fitting dish that still fits the remaining budget. */
export function composeSet(ranked: Dish[], r: Request, stopList: string[] = []): Array<{ dishId: string; qty: number }> {
  const pool = ranked.filter((d) => fits(d, r, stopList));
  const chosen: Array<{ dishId: string; qty: number }> = [];
  let left = r.budget ?? Infinity;
  for (const slot of slotsFor(r)) {
    const candidates = pool
      .filter((d) => slot.cats.includes(d.categoryId) && !chosen.some((c) => c.dishId === d.id))
      .map((d, i) => ({ d, score: -i / pool.length + (slot.prefer?.(d) ?? 0) }))
      .sort((a, b) => b.score - a.score);
    let qty = slot.qty;
    let pick = candidates.find(({ d }) => d.price * qty <= left)?.d;
    while (!pick && qty > 1) {
      qty -= 1;
      pick = candidates.find(({ d }) => d.price * qty <= left)?.d;
    }
    if (!pick) continue;
    chosen.push({ dishId: pick.id, qty });
    left -= pick.price * qty;
  }
  return chosen;
}

function total(items: Array<{ dishId: string; qty: number }>, dishes: Dish[]): number {
  return items.reduce((s, it) => s + (dishes.find((d) => d.id === it.dishId)?.price ?? 0) * it.qty, 0);
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DAY_WORDS: Array<[RegExp, number]> = [
  [/понедельн/, 1],
  [/вторник/, 2],
  [/сред[уа]/, 3],
  [/четверг/, 4],
  [/пятниц/, 5],
  [/суббот/, 6],
  [/воскресен/, 0],
];

export function parseWhen(message: string, now: Date): { date: string; time?: string; label: string } {
  const t = norm(message);
  const d = new Date(now);
  let label = 'сегодня';
  if (/послезавтра/.test(t)) {
    d.setDate(d.getDate() + 2);
    label = 'послезавтра';
  } else if (/завтра/.test(t)) {
    d.setDate(d.getDate() + 1);
    label = 'завтра';
  } else {
    for (const [re, wd] of DAY_WORDS) {
      if (re.test(t)) {
        const delta = (wd - now.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + delta);
        label = `в ${t.match(re)![0].replace(/у$/, 'у')}`;
        break;
      }
    }
  }
  const tm = t.match(/(?:в|к|на)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:час|ч\b|утра|вечера|:|$|\s)/);
  let time: string | undefined;
  if (tm) {
    let h = Number(tm[1]);
    if (/вечера/.test(t) && h < 12) h += 12;
    if (h >= 8 && h <= 23) time = `${String(h).padStart(2, '0')}:${tm[2] ?? '00'}`;
  }
  return { date: ymd(d), time, label };
}

function matchRestaurant(message: string, restaurants: Restaurant[]): Restaurant | undefined {
  const t = norm(message);
  return restaurants.find((r) =>
    [r.name.replace(/^ЖАР\s*(на\s*)?/i, ''), r.district, r.metro]
      .map((s) => norm(s).slice(0, 6))
      .some((stem) => stem.length >= 4 && t.includes(stem)),
  );
}

function peopleWord(n: number): string {
  return `${n} ${plural(n, 'гостя', 'гостей', 'гостей')}`;
}

function personalPicks(ctx: AssistantContext): AssistantCard {
  const items = ctx.ranked.filter((d) => !ctx.stopList.includes(d.id) && d.categoryId !== 'drinks').slice(0, 3).map((d) => ({ dishId: d.id, qty: 1 }));
  return { type: 'dishes', title: 'Под ваш вкус', items, note: 'Подобрал по вашим лайкам и заказам' };
}

export function scriptedReply(message: string, ctx: AssistantContext): AssistantReply {
  const t = norm(message);
  const r = parseRequest(message);

  // 1. A problem with the order comes first.
  if (/опазд|опозд|долго|холодн|не привез|не пришел|забыл|не хватает|перепут|не то|испорч|жалоб|вернуть|возврат|проблем/.test(t)) {
    if (!ctx.order) {
      return { text: 'Сейчас у вас нет активного заказа. Если вопрос по прошлому, откройте его в истории — помогу там.', cards: [], chips: ['Мои заказы', 'Что заказать?'] };
    }
    const topic = /опазд|опозд|долго/.test(t) ? 'late' : /холодн/.test(t) ? 'cold' : /забыл|не хватает|не привез/.test(t) ? 'missing' : /перепут|не то/.test(t) ? 'wrong' : 'other';
    return { text: 'Сочувствую, разберёмся прямо сейчас. Выберите, что случилось, — компенсацию начислим сразу, без ожидания оператора.', cards: [{ type: 'support', topic }], chips: ['Где курьер?'] };
  }

  // 2. Order status.
  if (/где (мой )?заказ|где курьер|статус|когда (привез|будет|доставят)|сколько ждать|скоро/.test(t)) {
    if (ctx.order) {
      return { text: `${ctx.order.statusTitle}. ${ctx.order.isPickup ? 'Будет готов' : 'Привезём'} ${ctx.order.eta}.`, cards: [{ type: 'order' }], chips: ['Что-то не так с заказом', 'Добавить десерт'] };
    }
    const usual = ctx.usual?.length ? [{ type: 'dishes', title: 'Как обычно', items: ctx.usual } as AssistantCard] : [];
    return { text: 'Активных заказов нет. Повторить ваш обычный?', cards: usual, chips: ['Что нового в меню?'] };
  }

  // 3. Banquet.
  if (/банкет|корпоратив|день рождени|свадьб|юбиле|выпускн|праздн/.test(t) && (r.people ?? 0) >= 8 || /банкет|корпоратив/.test(t)) {
    const guests = r.people && r.people >= 6 ? r.people : 20;
    const hall = matchRestaurant(message, ctx.restaurants.filter((x) => x.hasBanquetHall)) ?? ctx.restaurants.find((x) => x.hasBanquetHall);
    const per = r.budget ? Math.round(r.budget / guests) : undefined;
    return {
      text: `Банкет на ${peopleWord(guests)} проведём${hall ? ` в «${hall.name}»` : ''}. Соберу меню под бюджет и пришлю менеджеру — он перезвонит за 15 минут.`,
      cards: [{ type: 'banquet', guests, restaurantId: hall?.id, budgetPerGuest: per }],
      chips: ['А что по меню?', 'Есть детское меню?'],
    };
  }

  // 4. Table booking.
  if (/столик|стол на|забронир|бронь|брониров|посидеть|сходить в ресторан/.test(t)) {
    const guests = r.people ?? 2;
    const when = parseWhen(message, ctx.now);
    const rest = matchRestaurant(message, ctx.restaurants) ?? [...ctx.restaurants].sort((a, b) => a.load - b.load)[0];
    return {
      text: `«${rest.name}» на ${peopleWord(guests)}, ${when.label}${when.time ? ` в ${when.time}` : ''}. Выберите стол на схеме зала — можно сразу заказать блюда к приходу.`,
      cards: [{ type: 'booking', restaurantId: rest.id, date: when.date, time: when.time, guests }],
      chips: ['Есть столик у окна?', 'Другой ресторан'],
    };
  }

  // 5. Repeat the usual.
  if (/повтор|как обычно|как в прошлый|как всегда|то же самое/.test(t)) {
    if (ctx.usual?.length) {
      return { text: `Ваш классический набор — ${rub(total(ctx.usual, ctx.dishes))}. Добавить всё в корзину одним касанием?`, cards: [{ type: 'dishes', title: 'Как обычно', items: ctx.usual }], chips: ['Добавить десерт', 'Что-то новое'] };
    }
  }

  // 6. Info.
  if (/доставк\w* (стоит|сколько)|сколько (стоит )?доставк|бесплатн\w* доставк|минимальн/.test(t)) {
    const need = Math.max(0, ctx.freeDeliveryFrom - ctx.cartTotal);
    return {
      text: `Доставка ${rub(ctx.deliveryFee)}, бесплатно от ${rub(ctx.freeDeliveryFrom)}.${ctx.cartTotal > 0 ? (need > 0 ? ` До бесплатной вам осталось ${rub(need)}.` : ' Ваша корзина уже проходит.') : ''}`,
      cards: [],
      chips: need > 0 && ctx.cartTotal > 0 ? ['Чем добить корзину?'] : ['Что заказать?'],
    };
  }
  if (/добить|догнать до бесплат|чем дополнить/.test(t)) {
    const need = Math.max(1, ctx.freeDeliveryFrom - ctx.cartTotal);
    const add = ctx.ranked.filter((d) => !ctx.stopList.includes(d.id) && ['snacks', 'desserts', 'drinks'].includes(d.categoryId) && !ctx.cart.some((l) => l.dishId === d.id));
    const pick = add.find((d) => d.price >= need && d.price <= need + 250) ?? add[0];
    return { text: `Не хватает ${rub(need)} до бесплатной доставки. ${pick ? `«${pick.name}» закроет разницу.` : ''}`, cards: pick ? [{ type: 'dishes', title: 'До бесплатной доставки', items: [{ dishId: pick.id, qty: 1 }] }] : [], chips: [] };
  }
  if (/работает|часы работы|во сколько закрыва|адрес|где (вы|находит)|ближайш/.test(t)) {
    const list = [...ctx.restaurants].slice(0, 3).map((x) => `${x.name} — ${x.address}, ${x.hours}`).join('; ');
    return { text: `${list}. Всего у нас ${ctx.restaurants.length} ресторанов в Петербурге.`, cards: [], chips: ['Забронировать столик'] };
  }

  // 7. Compose a set for a group / budget / named categories / mood.
  const moody = /хочу|подбери|посоветуй|собери|что (взять|заказать|поесть)|голод|перекус|ужин|обед|завтрак|вечер|фильм|сериал|остр|сытн|легк/.test(t);
  if (r.people || r.budget || r.cats.length || moody || r.veg || r.spicy || r.light) {
    const items = composeSet(ctx.ranked, r, ctx.stopList);
    if (!items.length) {
      return { text: r.budget ? `В ${rub(r.budget)} с такими условиями не уложиться. Поднимем бюджет или уберём ограничения?` : 'Не нашёл подходящих блюд — попробуйте сформулировать иначе.', cards: [], chips: ['Без ограничений', 'Что популярно?'] };
    }
    const sum = total(items, ctx.dishes);
    const who = r.people && r.people > 1 ? ` на ${peopleWord(r.people)}` : '';
    const diet = [r.veg && 'без мяса', r.spicy && 'поострее', r.noSpicy && 'без остроты', r.light && 'полегче', r.glutenFree && 'без глютена'].filter(Boolean).join(', ');
    const fitNote = r.budget ? (sum <= r.budget ? `, укладываемся в ${rub(r.budget)}` : '') : '';
    const title = r.people && r.people > 1 ? `Набор${who}` : r.cats.length === 1 ? 'Подборка для вас' : 'Ужин под ваш вкус';
    return {
      text: `Собрал${who}${diet ? ` (${diet})` : ''}: ${items.length} ${plural(items.length, 'позиция', 'позиции', 'позиций')} на ${rub(sum)}${fitNote}. Можно поменять что угодно — просто скажите.`,
      cards: [{ type: 'dishes', title, items, note: sum < ctx.freeDeliveryFrom ? `До бесплатной доставки ${rub(ctx.freeDeliveryFrom - sum)}` : 'Доставка бесплатная' }],
      chips: [r.spicy ? 'Без остроты' : 'Поострее', r.budget ? 'Дешевле' : 'Уложиться в 2000', r.people ? 'Добавить десерт' : 'На компанию из 4'],
    };
  }

  // 8. Greeting / anything else.
  const hello = ctx.user ? `${ctx.user.name}, ` : '';
  return {
    text: `${hello}я Шеф ИИ. Соберу заказ под компанию и бюджет, забронирую стол или помогу с текущим заказом. Вот что вам обычно нравится:`,
    cards: [personalPicks(ctx)],
    chips: ['Ужин на 4 до 3000 ₽', 'Столик на завтра в 19', 'Что-то острое'],
  };
}

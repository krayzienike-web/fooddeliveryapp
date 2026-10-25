import type { Dish } from '@/entities/dish/model/types';
import type { Restaurant } from '@/entities/restaurant/model/types';

/**
 * The contract between the «Шеф ИИ» brain (real Claude or the scripted fallback) and the UI.
 * The model writes a short reply, then a separator line, then JSON with generative cards.
 * One request per turn, no tool rounds: the whole menu and the guest's context fit in the prompt,
 * which keeps answers fast on a phone.
 */

export const CARDS_SEPARATOR = '@@@';

export interface DishSetCard {
  type: 'dishes';
  title: string;
  items: Array<{ dishId: string; qty: number }>;
  note?: string;
}

export interface BookingCard {
  type: 'booking';
  restaurantId: string;
  /** YYYY-MM-DD */
  date?: string;
  /** HH:MM */
  time?: string;
  guests: number;
}

export interface BanquetCard {
  type: 'banquet';
  guests: number;
  restaurantId?: string;
  budgetPerGuest?: number;
}

export interface OrderCard {
  type: 'order';
}

export interface SupportCard {
  type: 'support';
  topic?: string;
}

export type AssistantCard = DishSetCard | BookingCard | BanquetCard | OrderCard | SupportCard;

export interface AssistantReply {
  text: string;
  cards: AssistantCard[];
  chips: string[];
}

export interface AssistantContext {
  dishes: Dish[];
  /** Dishes ordered by the guest's taste (best first). */
  ranked: Dish[];
  stopList: string[];
  restaurants: Restaurant[];
  cart: Array<{ dishId: string; qty: number }>;
  cartTotal: number;
  order?: { id: string; statusTitle: string; eta: string; isPickup: boolean };
  user?: { name: string; points: number; levelTitle: string; diet: string };
  /** Usual order, e.g. the Friday ritual. */
  usual?: Array<{ dishId: string; qty: number }>;
  now: Date;
  weather: string;
  freeDeliveryFrom: number;
  deliveryFee: number;
}

const MAX_CARDS = 3;
const MAX_CHIPS = 3;
const MAX_ITEMS = 12;

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

/** One compact line per dish: enough for Claude to choose, cheap in tokens. */
export function menuDigest(dishes: Dish[], stopList: string[]): string {
  return dishes
    .filter((d) => !stopList.includes(d.id))
    .map((d) => {
      const top = (Object.entries(d.taste) as Array<[string, number]>)
        .filter(([, v]) => v >= 0.6)
        .map(([k]) => k)
        .join(',');
      return `${d.id}|${d.name}|${d.price}₽|${d.weight}${d.unit}|${d.categoryId}|${d.tags.join(',')}|${d.nutrition.kcal}ккал|${top}|${d.tagline}`;
    })
    .join('\n');
}

export interface Instructions {
  /** Rules, format, restaurants and menu: identical across turns, so the proxy can cache it. */
  stable: string;
  /** Time, weather, guest, cart, order: changes every turn, goes after the cached prefix. */
  dynamic: string;
}

/** Standing instructions + data. The artifact runtime gets them as the first user turn, the proxy as the system prompt. */
export function buildInstructions(ctx: AssistantContext): Instructions {
  const cart = ctx.cart.length ? ctx.cart.map((l) => `${l.dishId}×${l.qty}`).join(', ') + ` (итого ${ctx.cartTotal}₽)` : 'пусто';
  const top = ctx.ranked.slice(0, 12).map((d) => d.id).join(', ');
  const rest = ctx.restaurants
    .map((r) => `${r.id}|${r.name}|${r.address}, м. ${r.metro}|${r.hours}|банкетный зал: ${r.hasBanquetHall ? 'да' : 'нет'}`)
    .join('\n');
  const stable = [
    'Ты — «Шеф ИИ», ассистент сети ресторанов и доставки «ЖАР» в Санкт-Петербурге. Говоришь по-русски, тепло и коротко, как опытный официант: 1–3 предложения, без эмодзи и без markdown.',
    'Помогаешь выбрать блюда, собрать заказ под бюджет и компанию, забронировать стол, организовать банкет, узнать статус заказа и решить проблему с заказом.',
    'Предлагай только блюда из меню ниже, ссылайся на них по id. Учитывай диету, бюджет, количество гостей и вкус гостя (список «нравится» — лучшие совпадения по вкусу). Цены считай точно.',
    'Ничего не добавляй в корзину сам: гость нажмёт кнопку на карточке. Не выдумывай акции, адреса и время работы — бери из данных.',
    '',
    'ФОРМАТ ОТВЕТА: сначала текст для гостя. Затем отдельной строкой ' + CARDS_SEPARATOR + ' и одна строка JSON:',
    '{"cards":[...],"chips":["...", "..."]}',
    'Карточки (не больше 3):',
    '- {"type":"dishes","title":"Короткое название набора","items":[{"dishId":"pz-pepperoni","qty":1}],"note":"почему это подходит"}',
    '- {"type":"booking","restaurantId":"r-nevsky","date":"YYYY-MM-DD","time":"19:00","guests":4}',
    '- {"type":"banquet","guests":20,"restaurantId":"r-novaya-gollandiya","budgetPerGuest":3000}',
    '- {"type":"order"} — показать живой статус текущего заказа',
    '- {"type":"support","topic":"late|cold|missing|wrong|other"} — перейти к решению проблемы с заказом',
    'chips — 2–3 коротких следующих вопроса от лица гостя (до 30 символов). Если карточки не нужны, верни пустой массив cards.',
    '',
    'РЕСТОРАНЫ (id|название|адрес|часы|банкет):',
    rest,
    '',
    'МЕНЮ (id|название|цена|выход|категория|теги|ккал|вкус|описание):',
    menuDigest(ctx.dishes, []),
  ].join('\n');
  const dynamic = [
    'СЕЙЧАС',
    `${WEEKDAYS[ctx.now.getDay()]}, ${ymd(ctx.now)} ${String(ctx.now.getHours()).padStart(2, '0')}:${String(ctx.now.getMinutes()).padStart(2, '0')}. Погода: ${ctx.weather}.`,
    ctx.stopList.length ? `Закончились (не предлагай): ${ctx.stopList.join(', ')}.` : '',
    `Загрузка ресторанов: ${ctx.restaurants.map((r) => `${r.id} ${Math.round(r.load * 100)}%`).join(', ')}.`,
    ctx.user ? `Гость: ${ctx.user.name}, уровень «${ctx.user.levelTitle}», ${ctx.user.points} баллов, диета: ${ctx.user.diet}.` : 'Гость не вошёл в аккаунт.',
    `Корзина: ${cart}. Бесплатная доставка от ${ctx.freeDeliveryFrom}₽, иначе ${ctx.deliveryFee}₽.`,
    ctx.order ? `Активный заказ ${ctx.order.id}: ${ctx.order.statusTitle}, ${ctx.order.isPickup ? 'самовывоз' : 'доставка'}, ожидается ${ctx.order.eta}.` : 'Активных заказов нет.',
    ctx.usual?.length ? `Обычный заказ гостя: ${ctx.usual.map((l) => `${l.dishId}×${l.qty}`).join(', ')}.` : '',
    `Нравится гостю (по вкусу): ${top}.`,
  ]
    .filter((l) => l !== '')
    .join('\n');
  return { stable, dynamic };
}

/** Text to show while the answer streams: everything before the separator. */
export function visibleText(raw: string): string {
  const i = raw.indexOf(CARDS_SEPARATOR);
  const s = i >= 0 ? raw.slice(0, i) : raw;
  // Hide a separator that is still being typed ("@", "@@").
  return s.replace(/@{1,2}\s*$/, '').trim();
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toInt(v: unknown, min: number, max: number): number | undefined {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
}

/** Validates one card against known ids; anything unknown or malformed is dropped. */
export function sanitizeCard(raw: unknown, known: { dishIds: Set<string>; restaurantIds: Set<string> }): AssistantCard | null {
  if (!isObj(raw)) return null;
  switch (raw.type) {
    case 'dishes': {
      const items = (Array.isArray(raw.items) ? raw.items : [])
        .filter(isObj)
        .map((it) => ({ dishId: String(it.dishId), qty: toInt(it.qty ?? 1, 1, 20) ?? 1 }))
        .filter((it) => known.dishIds.has(it.dishId));
      const merged: Array<{ dishId: string; qty: number }> = [];
      for (const it of items) {
        const m = merged.find((x) => x.dishId === it.dishId);
        if (m) m.qty += it.qty;
        else merged.push({ ...it });
      }
      if (!merged.length) return null;
      return { type: 'dishes', title: String(raw.title ?? 'Подборка').slice(0, 60), items: merged.slice(0, MAX_ITEMS), note: raw.note ? String(raw.note).slice(0, 160) : undefined };
    }
    case 'booking': {
      const restaurantId = String(raw.restaurantId);
      if (!known.restaurantIds.has(restaurantId)) return null;
      const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : undefined;
      const time = typeof raw.time === 'string' && /^\d{1,2}:\d{2}$/.test(raw.time) ? raw.time.padStart(5, '0') : undefined;
      return { type: 'booking', restaurantId, date, time, guests: toInt(raw.guests ?? 2, 1, 20) ?? 2 };
    }
    case 'banquet': {
      const restaurantId = raw.restaurantId && known.restaurantIds.has(String(raw.restaurantId)) ? String(raw.restaurantId) : undefined;
      return { type: 'banquet', guests: toInt(raw.guests ?? 20, 6, 200) ?? 20, restaurantId, budgetPerGuest: toInt(raw.budgetPerGuest, 500, 50000) };
    }
    case 'order':
      return { type: 'order' };
    case 'support':
      return { type: 'support', topic: raw.topic ? String(raw.topic) : undefined };
    default:
      return null;
  }
}

/** Parses the model's raw output. Never throws: a broken JSON tail just means no cards. */
export function parseReply(raw: string, known: { dishIds: Set<string>; restaurantIds: Set<string> }): AssistantReply {
  const i = raw.indexOf(CARDS_SEPARATOR);
  const text = visibleText(raw);
  if (i < 0) return { text, cards: [], chips: [] };
  const tail = raw.slice(i + CARDS_SEPARATOR.length);
  const from = tail.indexOf('{');
  const to = tail.lastIndexOf('}');
  let data: unknown = null;
  if (from >= 0 && to > from) {
    try {
      data = JSON.parse(tail.slice(from, to + 1));
    } catch {
      data = null;
    }
  }
  if (!isObj(data)) return { text, cards: [], chips: [] };
  const cards = (Array.isArray(data.cards) ? data.cards : [])
    .map((c) => sanitizeCard(c, known))
    .filter((c): c is AssistantCard => c !== null)
    .slice(0, MAX_CARDS);
  const chips = (Array.isArray(data.chips) ? data.chips : [])
    .map((c) => String(c).trim())
    .filter((c) => c.length > 0 && c.length <= 40)
    .slice(0, MAX_CHIPS);
  return { text, cards, chips };
}

/** Sum of a dish set at base prices. */
export function setTotal(items: Array<{ dishId: string; qty: number }>, byId: Record<string, Dish>): number {
  return items.reduce((s, it) => s + (byId[it.dishId]?.price ?? 0) * it.qty, 0);
}

/**
 * Comment anchors for the claude.ai artifact (D0 feedback mode). The app is a single page with in-memory
 * navigation, so a CSS path can't tell which screen a comment belongs to. Each thread gets a legible name
 * instead — «Dish(bg-zhar) › dish-add» — which is also what Claude reads as the comment's location.
 */

export interface AnchorTarget {
  route: string;
  /** The one identifying param of the route (dish id, order id…), if any. */
  key?: string;
  /** testID of the element, or 'screen' for the screen as a whole. */
  target: string;
}

const SEP = ' › ';
const MAX_BYTES = 128;

/** Which param identifies each parametrised screen. */
export const ROUTE_KEY: Record<string, string> = {
  Dish: 'id',
  Order: 'id',
  Rate: 'id',
  Restaurant: 'id',
  Promo: 'id',
  AR: 'dishId',
  Booking: 'restaurantId',
};

export const TAB_ROUTES = ['Home', 'Menu', 'Assistant', 'Restaurants', 'Profile'];

export const ROUTE_TITLE: Record<string, string> = {
  Home: 'Главная',
  Menu: 'Меню',
  Assistant: 'Шеф ИИ',
  Restaurants: 'Рестораны',
  Profile: 'Профиль',
  Onboarding: 'Онбординг',
  Dish: 'Блюдо',
  Search: 'Поиск',
  Reels: 'Reels',
  Cart: 'Корзина',
  Checkout: 'Оформление',
  Auth: 'Вход',
  Address: 'Адрес',
  Order: 'Заказ',
  Orders: 'Мои заказы',
  Rate: 'Оценка',
  Promos: 'Акции',
  Promo: 'Акция',
  Restaurant: 'Ресторан',
  Booking: 'Бронь',
  Banquet: 'Банкет',
  Loyalty: 'Бонусы',
  Wheel: 'Колесо',
  Support: 'Поддержка',
  AR: 'AR',
  GroupCart: 'Групповая корзина',
  Gift: 'Подарок',
  QrMenu: 'За столом',
  Settings: 'Настройки',
};

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Builds the anchor name; trims the element id if needed to stay within the platform's 128 bytes. */
export function anchorName(a: AnchorTarget): string {
  const screen = a.key ? `${a.route}(${a.key.replace(/[()]/g, '')})` : a.route;
  let target = a.target.replace(/[\u0000-\u001f]/g, '');
  let name = `${screen}${SEP}${target}`;
  while (bytes(name) > MAX_BYTES && target.length > 1) {
    target = target.slice(0, -1);
    name = `${screen}${SEP}${target}`;
  }
  return name;
}

export function parseAnchor(name: string): AnchorTarget | null {
  const m = /^([A-Za-z]+)(?:\(([^)]*)\))? › (.+)$/.exec(name);
  if (!m) return null;
  return { route: m[1], key: m[2] || undefined, target: m[3] };
}

/** The key param for a route from its params object. */
export function routeKey(route: string, params: unknown): string | undefined {
  const k = ROUTE_KEY[route];
  if (!k || !params || typeof params !== 'object') return undefined;
  const v = (params as Record<string, unknown>)[k];
  return typeof v === 'string' ? v : undefined;
}

/** Navigation action to bring an anchored screen back (thread opened from the shell's list). */
export function routeFor(a: AnchorTarget): { name: string; params?: Record<string, unknown> } {
  if (TAB_ROUTES.includes(a.route)) return { name: 'Tabs', params: { screen: a.route } };
  const k = ROUTE_KEY[a.route];
  return { name: a.route, params: k && a.key ? { [k]: a.key } : undefined };
}

/** Short human label for the composer: «Блюдо · В корзину». */
export function anchorLabel(route: string, elementText: string | null | undefined): string {
  const title = ROUTE_TITLE[route] ?? route;
  const text = (elementText ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return text ? `${title} · ${text}` : title;
}

/**
 * In-memory mock backend implementing `Api` (src/services/contracts.ts).
 * Simulates latency, an order lifecycle on a compressed "virtual clock", courier movement along real
 * OSRM routes, preventive-support incidents, bookings and banquet requests.
 */
import { calcTotals } from '@/entities/cart/model/pricing';
import type { Incident, IncidentKind, Order, OrderStatus } from '@/entities/order/model/types';
import { buildIncident, compensationFor, shouldNotify } from '@/entities/order/model/incidents';
import { distanceMeters, flowFor, isFinal, nextStatus } from '@/entities/order/model/lifecycle';
import type { BanquetRequest, Booking } from '@/entities/restaurant/model/types';
import { levelFor } from '@/entities/user/model/loyalty';
import type { User } from '@/entities/user/model/types';
import { CATEGORIES, DISHES, DISH_INDEX } from '@/mocks/seed/menu';
import { MODIFIERS } from '@/mocks/seed/modifiers';
import { DELIVERY_ZONE, KNOWN_ADDRESSES, pointInPolygon } from '@/mocks/seed/geo';
import { CHEFS, COURIERS } from '@/mocks/seed/people';
import { PROMOS } from '@/mocks/seed/promos';
import { FLOOR_PLANS, RESTAURANTS } from '@/mocks/seed/restaurants';
import { reviewsForDish } from '@/mocks/seed/reviews';
import { REELS } from '@/mocks/seed/reels';
import ROUTES from '@/mocks/seed/routes.json';
import { DEMO_PHONE, demoOrderHistory, demoUser } from '@/mocks/seed/user';
import type { Api, ApiError, PlaceOrderInput, ZoneCheck } from '../contracts';

export interface MockOptions {
  latencyMs?: number;
  seed?: number;
  /** Virtual seconds per real second. 20 → a 40-minute delivery plays out in ~2 minutes. */
  timeScale?: number;
}

const ROUTE_TABLE = ROUTES as unknown as Record<string, [number, number][]>;

/** Real seconds each status lasts at timeScale=1 multiplier; virtual minutes are derived from timeScale. */
const STATUS_SECONDS: Partial<Record<OrderStatus, number>> = {
  created: 3,
  accepted: 6,
  cooking: 26,
  packing: 10,
  courier_assigned: 8,
  on_the_way: 70,
  arriving: 12,
  ready_for_pickup: 9999,
};

const err = (code: ApiError['code'], message: string): ApiError => ({ code, message });

export function createApi(opts: MockOptions = {}): Api {
  const latency = opts.latencyMs ?? 350;
  let speed = 1;
  let timeScale = opts.timeScale ?? 20;
  let seed = opts.seed ?? 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const wait = <T,>(v: T, ms = latency) => new Promise<T>((res) => setTimeout(() => res(v), ms * (0.6 + rnd() * 0.8)));
  const fail = (e: ApiError, ms = latency) => new Promise<never>((_, rej) => setTimeout(() => rej(e), ms));

  // ───────── state ─────────
  const bootNow = Date.now();
  let user: User = demoUser(bootNow);
  let orders: Order[] = demoOrderHistory(bootNow);
  let bookings: Booking[] = [];
  const banquets: BanquetRequest[] = [];
  const subs = new Map<string, Set<(o: Order) => void>>();
  const timers = new Map<string, ReturnType<typeof setInterval>>();
  const statusEnteredAt = new Map<string, number>();
  const stopList = new Set<string>();
  let codesSent: Record<string, number> = {};

  const emit = (o: Order) => subs.get(o.id)?.forEach((cb) => cb(structuredCloneSafe(o)));
  const find = (id: string) => orders.find((o) => o.id === id);

  const routeFor = (restaurantId: string, lat: number, lng: number) => {
    let best: { key: string; d: number } | null = null;
    for (const a of KNOWN_ADDRESSES) {
      const d = distanceMeters(a.point, { lat, lng });
      if (!best || d < best.d) best = { key: `${restaurantId}|${a.id}`, d };
    }
    const r = best ? ROUTE_TABLE[best.key] : undefined;
    const pts = r ? r.map(([la, ln]) => ({ lat: la, lng: ln })) : [];
    const restaurant = RESTAURANTS.find((x) => x.id === restaurantId)!;
    if (!pts.length) pts.push(restaurant.point);
    pts.push({ lat, lng });
    return pts;
  };

  const tick = (o: Order) => {
    if (isFinal(o.status)) return stopTicker(o.id);
    const entered = statusEnteredAt.get(o.id) ?? Date.now();
    const dur = (STATUS_SECONDS[o.status] ?? 10) * 1000 / speed;
    const elapsed = Date.now() - entered;
    let changed = false;
    if (o.status === 'on_the_way' || o.status === 'arriving') {
      const total = ((STATUS_SECONDS.on_the_way ?? 60) + (STATUS_SECONDS.arriving ?? 10)) * 1000 / speed;
      const stuck = o.incidents.some((i) => i.kind === 'courier_delay' && !i.resolvedWith) ? 0.35 : 1;
      o.courierProgress = Math.min(1, o.courierProgress + (1000 / total) * stuck);
      if (o.status === 'on_the_way' && o.courierProgress >= 0.86) setStatus(o, 'arriving');
      if (o.status === 'arriving' && o.courierProgress >= 1) setStatus(o, 'delivered');
      changed = true;
    } else if (elapsed >= dur) {
      const n = nextStatus(o.mode, o.status);
      if (n) setStatus(o, n);
      changed = true;
    }
    // Keep the ETA honest: recompute remaining virtual minutes from the real remaining time.
    if (!isFinal(o.status)) {
      const remainingReal = remainingRealMs(o);
      const vMin = Math.max(1, Math.round((remainingReal / 1000) * timeScale * speed / 60));
      const now = Date.now();
      o.etaFrom = now + Math.max(1, vMin - 3) * 60000;
      o.etaTo = now + (vMin + 4) * 60000;
    }
    if (changed) emit(o);
  };

  const remainingRealMs = (o: Order) => {
    const flow = flowFor(o.mode);
    const i = flow.indexOf(o.status);
    let ms = 0;
    for (let k = i; k < flow.length - 1; k++) {
      const s = flow[k];
      if (s === 'ready_for_pickup') break;
      if (s === 'on_the_way') ms += (1 - o.courierProgress) * ((STATUS_SECONDS.on_the_way ?? 60) + (STATUS_SECONDS.arriving ?? 10)) * 1000 / speed;
      else if (s === 'arriving') continue;
      else ms += ((STATUS_SECONDS[s] ?? 10) * 1000) / speed;
    }
    return ms;
  };

  const setStatus = (o: Order, s: OrderStatus) => {
    o.status = s;
    o.history.push({ status: s, at: Date.now() });
    statusEnteredAt.set(o.id, Date.now());
    if (s === 'courier_assigned') o.courier = COURIERS[Math.floor(rnd() * COURIERS.length)];
    if (s === 'ready_for_pickup') o.pickupShelf = `${String.fromCharCode(65 + Math.floor(rnd() * 4))}-${1 + Math.floor(rnd() * 12)}`;
    if (s === 'delivered' || s === 'picked_up') {
      // Automatic compensation for lateness (C6): compare against the promise made at checkout.
      const late = Math.round((Date.now() - o.promisedBy) / 60000);
      if (late >= 10 && !o.incidents.some((i) => i.compensationPoints > 0)) {
        const inc = buildIncident('courier_delay', Date.now(), { delayMinutes: late });
        o.incidents.push(inc);
        user = { ...user, points: user.points + inc.compensationPoints };
      }
      user = { ...user, points: user.points + o.pointsEarned, levelSpend: user.levelSpend + o.total };
      user = { ...user, level: levelFor(user.levelSpend).id };
    }
  };

  const startTicker = (o: Order) => {
    statusEnteredAt.set(o.id, Date.now());
    stopTicker(o.id);
    const t = setInterval(() => tick(o), 1000) as unknown as { unref?: () => void };
    t.unref?.(); // never keep a Node test process alive
    timers.set(o.id, t as unknown as ReturnType<typeof setInterval>);
  };
  const stopTicker = (id: string) => {
    const t = timers.get(id);
    if (t) clearInterval(t);
    timers.delete(id);
  };

  const zone = (lat: number, lng: number): ZoneCheck => {
    const inZone = pointInPolygon({ lat, lng }, DELIVERY_ZONE);
    let nearest = RESTAURANTS[0];
    let d = Infinity;
    for (const r of RESTAURANTS) {
      const dd = distanceMeters(r.point, { lat, lng });
      if (dd < d) {
        d = dd;
        nearest = r;
      }
    }
    const base = Math.round(25 + d / 1000 * 4);
    return { inZone, zoneName: inZone ? 'Центр' : 'Вне зоны', minOrder: 600, deliveryFee: 199, etaMinutes: [base, base + 10], restaurantId: nearest.id };
  };

  const api: Api = {
    catalog: {
      getMenu: () => wait({ categories: CATEGORIES, dishes: DISHES, modifiers: MODIFIERS, stopList: [...stopList] }, 500),
      getReviews: (dishId) => {
        const d = DISH_INDEX[dishId];
        return d ? wait(reviewsForDish(d, Date.now())) : fail(err('not_found', 'Блюдо не найдено'));
      },
      getPromos: () => wait(PROMOS),
      getReels: () => wait(REELS, 200),
      validatePromo: (code, itemsTotal) => {
        const p = PROMOS.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
        if (!p) return fail(err('validation', 'Такого промокода нет. Проверьте написание.'));
        const min = 'minTotal' in p.mechanic ? p.mechanic.minTotal ?? 0 : 0;
        if (itemsTotal < min) return fail(err('validation', `Промокод работает от ${min} ₽`));
        return wait(p);
      },
    },

    auth: {
      requestCode: (phone) => {
        const digits = phone.replace(/\D/g, '').slice(-10);
        if (digits.length !== 10) return fail(err('validation', 'Введите номер полностью'));
        const last = codesSent[digits] ?? 0;
        if (Date.now() - last < 2000) return fail(err('rate_limited', 'Подождите немного'));
        codesSent = { ...codesSent, [digits]: Date.now() };
        return wait({ resendInSec: 59 }, 600);
      },
      verifyCode: (phone, code) => {
        if (code !== '0000') return fail(err('validation', 'Неверный код. Для теста используйте 0000'), 500);
        const digits = phone.replace(/\D/g, '').slice(-10);
        const isNew = digits !== DEMO_PHONE;
        if (isNew) user = { ...user, phone: digits };
        return wait({ token: `tok_${digits}`, user: structuredCloneSafe(user), isNew }, 500);
      },
    },

    geo: {
      suggest: (q) => {
        const s = q.toLowerCase().replace(/[.,]/g, ' ').trim();
        if (s.length < 2) return wait([], 150);
        const words = s.split(/\s+/);
        const res = KNOWN_ADDRESSES.filter((a) => words.every((w) => `${a.street} ${a.house}`.toLowerCase().includes(w)))
          .slice(0, 6)
          .map((a) => ({ title: `${a.street}, ${a.house}`, subtitle: `${a.district} район, Санкт-Петербург`, point: a.point, street: a.street, house: a.house }));
        return wait(res, 200);
      },
      reverse: (p) => {
        let best = KNOWN_ADDRESSES[0];
        let d = Infinity;
        for (const a of KNOWN_ADDRESSES) {
          const dd = distanceMeters(a.point, p);
          if (dd < d) {
            d = dd;
            best = a;
          }
        }
        return wait(d < 600 ? { street: best.street, house: best.house } : null, 200);
      },
      checkZone: (p) => wait(zone(p.lat, p.lng), 250),
      route: (from, to) => wait([from, to], 200),
    },

    orders: {
      place: (input: PlaceOrderInput) => {
        if (!input.lines.length) return fail(err('validation', 'Корзина пуста'));
        const unavailable = input.lines.find((l) => stopList.has(l.dishId));
        if (unavailable) return fail(err('conflict', `«${DISH_INDEX[unavailable.dishId]?.name}» закончилось. Удалите из корзины или выберите замену.`));
        if (input.mode === 'delivery' && input.address && !pointInPolygon(input.address.point, DELIVERY_ZONE)) return fail(err('out_of_zone', 'Этот адрес вне зоны доставки. Попробуйте самовывоз.'));
        const promo = input.promoCode ? PROMOS.find((p) => p.code === input.promoCode) : undefined;
        const lvl = levelFor(user.levelSpend);
        const totals = calcTotals({
          lines: input.lines,
          dishes: DISH_INDEX,
          modifiers: Object.fromEntries(MODIFIERS.map((m) => [m.id, m])),
          mode: input.mode,
          promo,
          pointsToSpend: input.pointsToSpend,
          availablePoints: user.points,
          tips: input.tips,
          cashbackPercent: lvl.cashback,
        });
        const now = Date.now();
        const z = input.address ? zone(input.address.point.lat, input.address.point.lng) : null;
        const restaurantId = input.mode === 'pickup' ? input.restaurantId : z?.restaurantId ?? input.restaurantId;
        const etaMin = input.mode === 'pickup' ? RESTAURANTS.find((r) => r.id === restaurantId)!.pickupMinutes : z ? z.etaMinutes[0] : 35;
        const id = `o-${Math.floor(now / 1000).toString(36)}`;
        const mainCat = DISH_INDEX[input.lines[0].dishId]?.categoryId;
        const chef = mainCat === 'rolls' || mainCat === 'sets' ? CHEFS[1] : mainCat === 'wok' || mainCat === 'soups' ? CHEFS[2] : mainCat === 'desserts' ? CHEFS[3] : mainCat === 'burgers' ? CHEFS[4] : CHEFS[0];
        const order: Order = {
          id,
          number: String(1000 + Math.floor(rnd() * 8999)),
          createdAt: now,
          mode: input.mode,
          lines: input.lines,
          total: totals.total,
          pointsEarned: totals.pointsEarned,
          pointsSpent: totals.pointsSpent,
          payment: input.payment,
          address: input.address,
          restaurantId,
          status: 'created',
          history: [{ status: 'created', at: now }],
          etaFrom: now + etaMin * 60000,
          etaTo: now + (etaMin + 10) * 60000,
          promisedBy: now + (etaMin + 10) * 60000,
          chef,
          route: input.mode === 'delivery' && input.address ? routeFor(restaurantId, input.address.point.lat, input.address.point.lng) : undefined,
          courierProgress: 0,
          incidents: [],
          scheduledFor: input.scheduledFor,
        };
        user = { ...user, points: user.points - totals.pointsSpent };
        orders = [order, ...orders];
        startTicker(order);
        return wait(structuredCloneSafe(order), 900);
      },
      list: () => wait(orders.map(structuredCloneSafe)),
      get: (id) => {
        const o = find(id);
        return o ? wait(structuredCloneSafe(o), 150) : fail(err('not_found', 'Заказ не найден'));
      },
      cancel: (id) => {
        const o = find(id);
        if (!o) return fail(err('not_found', 'Заказ не найден'));
        if (!['created', 'accepted', 'cooking'].includes(o.status) && !o.incidents.some((i) => i.kind === 'kitchen_delay')) return fail(err('conflict', 'Заказ уже готовится — отменить нельзя'));
        setStatus(o, 'cancelled');
        stopTicker(o.id);
        user = { ...user, points: user.points + o.pointsSpent };
        emit(o);
        return wait(structuredCloneSafe(o));
      },
      rate: (id, stars, tags, comment, photo) => {
        const o = find(id);
        if (!o) return fail(err('not_found', 'Заказ не найден'));
        o.rated = { stars, tags, comment };
        const bonus = photo ? 100 : 50;
        user = { ...user, points: user.points + bonus };
        emit(o);
        return wait(structuredCloneSafe(o));
      },
      resolveIncident: (orderId, incidentId, resolutionId) => {
        const o = find(orderId);
        const inc = o?.incidents.find((i) => i.id === incidentId);
        if (!o || !inc) return fail(err('not_found', 'Не найдено'));
        inc.resolvedWith = resolutionId;
        const res = inc.resolutions.find((r) => r.id === resolutionId);
        if (res?.kind === 'cancel') {
          setStatus(o, 'cancelled');
          stopTicker(o.id);
        }
        if (res?.kind === 'replace' && inc.dishId && inc.replacementDishIds?.length) {
          o.lines = o.lines.map((l) => (l.dishId === inc.dishId ? { ...l, dishId: inc.replacementDishIds![0], key: `${inc.replacementDishIds![0]}||` } : l));
        }
        if (res?.kind === 'refund_item' && inc.dishId) {
          const removed = o.lines.filter((l) => l.dishId === inc.dishId).reduce((s, l) => s + (DISH_INDEX[l.dishId]?.price ?? 0) * l.qty, 0);
          o.lines = o.lines.filter((l) => l.dishId !== inc.dishId);
          o.total -= removed;
        }
        if (res?.kind === 'switch_pickup') o.mode = 'pickup';
        emit(o);
        return wait(structuredCloneSafe(o), 300);
      },
      subscribe: (id, cb) => {
        if (!subs.has(id)) subs.set(id, new Set());
        subs.get(id)!.add(cb);
        const o = find(id);
        if (o && !isFinal(o.status) && !timers.has(id)) startTicker(o);
        return () => subs.get(id)?.delete(cb);
      },
      arriving: (id) => {
        const o = find(id);
        if (!o) return fail(err('not_found', 'Заказ не найден'));
        if (o.status === 'cooking' || o.status === 'accepted') statusEnteredAt.set(o.id, Date.now() - 10 * 60000);
        if (o.status === 'ready_for_pickup') {
          setTimeout(() => {
            setStatus(o, 'picked_up');
            emit(o);
          }, 6000 / speed);
        }
        emit(o);
        return wait(structuredCloneSafe(o));
      },
    },

    booking: {
      restaurants: () => wait(RESTAURANTS),
      floorPlan: (id) => {
        const p = FLOOR_PLANS.find((x) => x.id === id);
        return p ? wait(p) : fail(err('not_found', 'План зала не найден'));
      },
      availability: (restaurantId, date, time, guests) => {
        const r = RESTAURANTS.find((x) => x.id === restaurantId)!;
        const plan = FLOOR_PLANS.find((p) => p.id === r.floorPlanId)!;
        const h = (s: string) => s.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
        const busy = plan.tables.filter((t) => (h(`${restaurantId}${date}${time}${t.id}`) % 100) / 100 < r.load * 0.7 || t.seats < guests).map((t) => t.id);
        bookings.filter((b) => b.restaurantId === restaurantId && b.date === date && b.time === time).forEach((b) => busy.push(b.tableId));
        const slots: string[] = [];
        for (let hh = 12; hh <= 22; hh++) for (const mm of ['00', '30']) slots.push(`${hh}:${mm}`);
        return wait({ busyTableIds: [...new Set(busy)], slots }, 300);
      },
      book: (input) => {
        if (bookings.some((b) => b.restaurantId === input.restaurantId && b.date === input.date && b.time === input.time && b.tableId === input.tableId && b.status === 'confirmed')) {
          return fail(err('conflict', 'Этот стол только что заняли. Выберите другой.'));
        }
        const b: Booking = { ...input, id: `b-${Date.now().toString(36)}`, status: 'confirmed', createdAt: Date.now() };
        bookings = [b, ...bookings];
        return wait(b, 700);
      },
      myBookings: () => wait(bookings),
      sendBanquet: (req) => {
        const b: BanquetRequest = { ...req, id: `bq-${Date.now().toString(36)}`, status: 'sent', createdAt: Date.now() };
        banquets.push(b);
        return wait(b, 900);
      },
    },

    user: {
      me: () => wait(structuredCloneSafe(user), 200),
      update: (patch) => {
        user = { ...user, ...patch };
        return wait(structuredCloneSafe(user), 250);
      },
      addAddress: (a) => {
        user = { ...user, addresses: [...user.addresses, { ...a, id: `addr-${Date.now().toString(36)}` }] };
        return wait(structuredCloneSafe(user), 300);
      },
    },

    director: {
      triggerIncident: async (orderId, kind: IncidentKind) => {
        const o = find(orderId);
        if (!o) return null;
        if (!shouldNotify(o, kind)) return null;
        let inc: Incident;
        if (kind === 'stop_list') {
          const target = o.lines[0]?.dishId;
          const dish = DISH_INDEX[target];
          const repl = DISHES.filter((d) => d.categoryId === dish?.categoryId && d.id !== target).sort((a, b) => b.popularity - a.popularity).slice(0, 3).map((d) => d.id);
          inc = buildIncident('stop_list', Date.now(), { dishId: target, replacementDishIds: repl, message: `«${dish?.name}» только что закончилось. Подобрали похожие — замена за наш счёт, плюс ${compensationFor('stop_list')} баллов.` });
        } else if (kind === 'kitchen_delay' || kind === 'courier_delay') {
          const delay = kind === 'kitchen_delay' ? 12 : 9;
          inc = buildIncident(kind, Date.now(), { delayMinutes: delay });
          o.etaFrom += delay * 60000;
          o.etaTo += delay * 60000;
          if (kind === 'kitchen_delay') statusEnteredAt.set(o.id, (statusEnteredAt.get(o.id) ?? Date.now()) + 8000 / speed);
        } else {
          inc = buildIncident(kind, Date.now());
        }
        if (inc.compensationPoints) user = { ...user, points: user.points + inc.compensationPoints };
        o.incidents.push(inc);
        emit(o);
        return inc;
      },
      setSpeed: (m) => {
        speed = Math.max(0.25, m);
      },
      reset: async () => {
        timers.forEach((t) => clearInterval(t));
        timers.clear();
        user = demoUser(Date.now());
        orders = demoOrderHistory(Date.now());
        bookings = [];
        stopList.clear();
        speed = 1;
        timeScale = opts.timeScale ?? 20;
      },
    },
  };
  return api;
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

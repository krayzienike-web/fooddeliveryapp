import type { FloorTable, Restaurant, TableZone } from '@/entities/restaurant/model/types';

/** Booking rules (J5). Pure: no React, no IO. */

export const BOOKING = {
  daysAhead: 14,
  maxGuests: 12,
  /** A table can't be booked closer than this to now. */
  leadMinutes: 30,
  /** Last seating before closing. */
  lastSeatingBeforeCloseMinutes: 60,
};

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Horizontal date chips: «Сегодня», «Завтра», «Сб 25»… */
export function dateOptions(now: Date, days = BOOKING.daysAhead): Array<{ date: string; label: string; weekend: boolean }> {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    const label = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : `${WD[d.getDay()]} ${d.getDate()}`;
    return { date: ymd(d), label, weekend: d.getDay() === 0 || d.getDay() === 6 };
  });
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const normTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':');
  return `${h.padStart(2, '0')}:${m}`;
};

/** Slots the guest may pick: within opening hours, not in the past (with lead time). */
export function bookableSlots(slots: string[], date: string, now: Date, r: Pick<Restaurant, 'openFrom' | 'openTo'>): string[] {
  const today = date === ymd(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // openTo may exceed 24 (e.g. 26 = 02:00); evening slots are what matter for booking.
  const last = Math.min(r.openTo, 24) * 60 - BOOKING.lastSeatingBeforeCloseMinutes;
  return slots
    .map(normTime)
    .filter((s) => {
      const m = toMin(s);
      if (m < r.openFrom * 60 || m > last) return false;
      if (today && m < nowMin + BOOKING.leadMinutes) return false;
      return true;
    });
}

export type TableState = 'free' | 'busy' | 'small' | 'selected';

export function tableState(t: FloorTable, busy: string[], guests: number, selectedId?: string): TableState {
  if (t.id === selectedId) return 'selected';
  if (t.seats < guests) return 'small';
  if (busy.includes(t.id)) return 'busy';
  return 'free';
}

/** «Любой свободный стол»: the smallest free table that fits, preferring the guest's zone, then windows. */
export function pickTable(tables: FloorTable[], busy: string[], guests: number, prefer?: TableZone): FloorTable | undefined {
  const free = tables.filter((t) => t.seats >= guests && !busy.includes(t.id));
  const zoneRank = (z: TableZone) => (z === prefer ? 0 : z === 'window' ? 1 : z === 'hall' ? 2 : z === 'terrace' ? 3 : z === 'bar' ? 5 : 4);
  return [...free].sort((a, b) => a.seats - b.seats || zoneRank(a.zone) - zoneRank(b.zone) || a.id.localeCompare(b.id))[0];
}

export const ZONE_TITLE: Record<TableZone, string> = {
  window: 'У окна',
  hall: 'Зал',
  terrace: 'Терраса',
  vip: 'Шеф-стол',
  bar: 'Бар',
};

/** «Открыто до 23:00» / «Круглосуточно» / «Закрыто, откроется в 10:00». */
export function openStatus(r: Pick<Restaurant, 'openFrom' | 'openTo'>, now: Date): { open: boolean; text: string } {
  if (r.openFrom === 0 && r.openTo >= 24) return { open: true, text: 'Круглосуточно' };
  const h = now.getHours() + now.getMinutes() / 60;
  const hh = (x: number) => `${String(Math.floor(x) % 24).padStart(2, '0')}:00`;
  const open = (h >= r.openFrom && h < r.openTo) || (r.openTo > 24 && h < r.openTo - 24);
  return open ? { open: true, text: `Открыто до ${hh(r.openTo)}` } : { open: false, text: `Закрыто, откроется в ${hh(r.openFrom)}` };
}

/** Hall load. No red: a busy restaurant is not an error (guidebook §3.11). */
export function loadLabel(load: number): { text: string; tone: 'success' | 'textTertiary' | 'warning' } {
  if (load < 0.5) return { text: 'Много свободных столов', tone: 'success' };
  if (load < 0.8) return { text: 'Средняя загрузка', tone: 'textTertiary' };
  return { text: 'Почти полная посадка', tone: 'warning' };
}

/** ICS calendar event for a booking (works on web download and Android share). */
export function bookingIcs(b: { id: string; date: string; time: string; guests: number }, r: Pick<Restaurant, 'name' | 'address'>): string {
  const [y, m, d] = b.date.split('-');
  const [hh, mm] = normTime(b.time).split(':');
  const start = `${y}${m}${d}T${hh}${mm}00`;
  const endH = String(Math.min(23, Number(hh) + 2)).padStart(2, '0');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ZHAR//Booking//RU',
    'BEGIN:VEVENT',
    `UID:${b.id}@zhar.demo`,
    `DTSTART;TZID=Europe/Moscow:${start}`,
    `DTEND;TZID=Europe/Moscow:${y}${m}${d}T${endH}${mm}00`,
    `SUMMARY:Стол в «${r.name}» на ${b.guests}`,
    `LOCATION:${r.address}, Санкт-Петербург`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Через 2 часа ужин в ЖАР',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

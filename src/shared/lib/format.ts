const NBSP = ' ';
const NNBSP = ' ';

/** 1290 → «1 290 ₽» (narrow no-break space between thousands, no-break space before ₽). */
export function rub(value: number): string {
  const sign = value < 0 ? '−' : '';
  const s = Math.abs(Math.round(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return `${sign}${s}${NBSP}₽`;
}

export function points(value: number): string {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)}${NBSP}Б`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = Math.abs(n) % 10;
  const m100 = Math.abs(n) % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function minutes(n: number): string {
  return `${n}${NBSP}${plural(n, 'минута', 'минуты', 'минут')}`;
}

export function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function etaWindow(from: number, to: number): string {
  return `${hhmm(from)}–${hhmm(to)}`;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function dayMonth(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function weekdayShort(ts: number): string {
  return WEEKDAYS_SHORT[new Date(ts).getDay()];
}

export function isoDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** +7 (921) 555-12-34 mask while typing. Input: digits only. */
export function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').replace(/^[78]/, '').slice(0, 10);
  let out = '+7';
  if (d.length > 0) out += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

export function phoneDigits(masked: string): string {
  return masked.replace(/\D/g, '').replace(/^7/, '').slice(0, 10);
}

export function weight(value: number, unit: 'г' | 'мл' | 'шт'): string {
  return `${value}${NBSP}${unit}`;
}

import type { WheelPrize } from '@/entities/user/model/loyalty';

/**
 * Wheel geometry (C12). Sector i spans [i·a, (i+1)·a) clockwise from the pointer at 12 o'clock,
 * where a = 360 / n. Rotating the wheel clockwise by r degrees puts sector `sectorAt(r)` under the pointer.
 */

const mod = (x: number, m: number) => ((x % m) + m) % m;

export function sectorAt(rotation: number, n: number): number {
  const a = 360 / n;
  return Math.floor(mod(-rotation, 360) / a) % n;
}

/**
 * Final rotation that lands `index` under the pointer after at least `turns` full turns.
 * `jitter` in [-0.4, 0.4] moves the stop off the sector centre so it doesn't look scripted.
 */
export function targetRotation(current: number, index: number, n: number, turns = 5, jitter = 0): number {
  const a = 360 / n;
  const j = Math.max(-0.4, Math.min(0.4, jitter));
  const want = mod(-(index + 0.5 + j) * a, 360);
  const delta = mod(want - current, 360);
  return current + turns * 360 + delta;
}

/** «Правила и шансы»: odds in percent, rounded to 1 decimal, same order as prizes. */
export function prizeOdds(prizes: WheelPrize[]): Array<{ prize: WheelPrize; percent: number }> {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  return prizes.map((prize) => ({ prize, percent: Math.round((prize.weight / total) * 1000) / 10 }));
}

/** «Новый спин через 3 дня» / «через 5 часов». */
export function nextSpinIn(nextAt: number | null, now: number): string | null {
  if (nextAt === null) return null;
  const h = Math.max(1, Math.ceil((nextAt - now) / 3600000));
  if (h < 24) return `через ${h} ${h % 10 === 1 && h % 100 !== 11 ? 'час' : h % 10 >= 2 && h % 10 <= 4 && (h % 100 < 12 || h % 100 > 14) ? 'часа' : 'часов'}`;
  const d = Math.ceil(h / 24);
  return `через ${d} ${d % 10 === 1 && d % 100 !== 11 ? 'день' : d % 10 >= 2 && d % 10 <= 4 && (d % 100 < 12 || d % 100 > 14) ? 'дня' : 'дней'}`;
}

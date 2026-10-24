import type { Dish } from '@/entities/dish/model/types';

/** Typo-tolerant search over the menu: "пица" → "пицца", "филаделфия" → "Филадельфия". */

const LAYOUT_EN = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.`';
const LAYOUT_RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';

/** Fixes text typed in the wrong keyboard layout: "gbwwf" → "пицца". */
export function fixLayout(s: string): string {
  return [...s.toLowerCase()].map((ch) => {
    const i = LAYOUT_EN.indexOf(ch);
    return i >= 0 ? LAYOUT_RU[i] : ch;
  }).join('');
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

const SYNONYMS: Record<string, string[]> = {
  суши: ['ролл', 'роллы', 'сет'],
  роллы: ['суши'],
  острое: ['острый', 'острая', 'чили', 'спайси'],
  мясо: ['говядина', 'свинина', 'курица', 'стейк'],
  сладкое: ['десерт', 'торт', 'чизкейк'],
  веган: ['веганский', 'vegan'],
  кофе: ['латте', 'капучино', 'американо', 'раф'],
  бургер: ['бургеры'],
  пицца: ['пиццы'],
};

function tokenScore(q: string, word: string): number {
  if (word.startsWith(q)) return 1;
  if (word.includes(q) && q.length >= 3) return 0.85;
  const maxDist = q.length <= 4 ? 1 : 2;
  const dist = damerauLevenshtein(q, word.slice(0, Math.max(q.length, Math.min(word.length, q.length + 1))));
  if (dist <= maxDist) return 0.75 - dist * 0.1;
  return 0;
}

export function searchDishes(dishes: Dish[], query: string): Dish[] {
  const raw = normalize(query);
  if (!raw) return [];
  const variants = [raw];
  const fixed = normalize(fixLayout(query));
  if (fixed !== raw) variants.push(fixed);

  const results = dishes.map((dish) => {
    const hay = normalize(`${dish.name} ${dish.tagline} ${dish.ingredients.map((i) => i.title).join(' ')}`).split(' ');
    const name = normalize(dish.name).split(' ');
    let best = 0;
    for (const v of variants) {
      let s = 0;
      for (const t of v.split(' ')) {
        const alts = [t, ...(SYNONYMS[t] ?? [])];
        let tokenBest = 0;
        for (const alt of alts) {
          for (const w of name) tokenBest = Math.max(tokenBest, tokenScore(alt, w) * 1.2);
          for (const w of hay) tokenBest = Math.max(tokenBest, tokenScore(alt, w));
        }
        s += tokenBest;
      }
      best = Math.max(best, s / v.split(' ').length);
    }
    return { dish, s: best };
  });
  return results.filter((r) => r.s >= 0.5).sort((a, b) => b.s - a.s || b.dish.popularity - a.dish.popularity).map((r) => r.dish);
}

/** "Возможно, вы имели в виду" — the closest dish name word to the query. */
export function didYouMean(dishes: Dish[], query: string): string | null {
  const q = normalize(fixLayout(query));
  if (q.length < 3) return null;
  let best: { w: string; d: number } | null = null;
  for (const dish of dishes) {
    for (const w of normalize(dish.name).split(' ')) {
      const d = damerauLevenshtein(q, w);
      if (d === 0) return null;
      if (d > 0 && d <= 2 && (!best || d < best.d)) best = { w, d };
    }
  }
  return best?.w ?? null;
}

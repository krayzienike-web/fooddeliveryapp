import { damerauLevenshtein, didYouMean, fixLayout, normalize, searchDishes } from '@/features/search/model/fuzzy';
import { makeDish } from '../fixtures';

const menu = [
  makeDish({ id: 'pepperoni', categoryId: 'pizza', name: 'Пицца Пепперони', tagline: 'Острая колбаска', popularity: 500 }),
  makeDish({ id: 'margarita', categoryId: 'pizza', name: 'Пицца Маргарита', tagline: 'Томаты и моцарелла', popularity: 300 }),
  makeDish({ id: 'phila', categoryId: 'rolls', name: 'Ролл Филадельфия', tagline: 'Лосось и сливочный сыр', ingredients: [{ id: 'i1', title: 'лосось' }] }),
  makeDish({ id: 'burger', categoryId: 'burgers', name: 'Бургер Классик', tagline: 'Говядина и чеддер', ingredients: [{ id: 'i2', title: 'говядина' }] }),
  makeDish({ id: 'tomyam', categoryId: 'soups', name: 'Том ям', tagline: 'Острый суп с креветками' }),
  makeDish({ id: 'cheesecake', categoryId: 'desserts', name: 'Чизкейк Нью-Йорк', tagline: 'Нежный' }),
  makeDish({ id: 'latte', categoryId: 'drinks', name: 'Латте', tagline: 'Двойной эспрессо' }),
  makeDish({ id: 'mors', categoryId: 'drinks', name: 'Морс клюквенный', tagline: 'Ёмкий вкус' }),
];
const ids = (q: string) => searchDishes(menu, q).map((d) => d.id);

describe('helpers', () => {
  it('normalize lowercases, ё→е, strips punctuation, collapses spaces', () => {
    expect(normalize('  Ёлка,  ПИЦЦА!!! ')).toBe('елка пицца');
  });
  it('fixLayout converts EN-layout typing to RU', () => {
    expect(fixLayout('gbwwf')).toBe('пицца');
    expect(fixLayout(',ehuth')).toBe('бургер');
    expect(fixLayout('GBWWF')).toBe('пицца');
    expect(fixLayout('пицца')).toBe('пицца');
  });
  it('damerauLevenshtein', () => {
    expect(damerauLevenshtein('', 'abc')).toBe(3);
    expect(damerauLevenshtein('abc', 'abc')).toBe(0);
    expect(damerauLevenshtein('ab', 'ba')).toBe(1);
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3);
    expect(damerauLevenshtein('пица', 'пицца')).toBe(1);
  });
});

describe('searchDishes', () => {
  it('«пица» (typo) → pizzas, by popularity', () => {
    expect(ids('пица')).toEqual(['pepperoni', 'margarita']);
  });
  it('wrong keyboard layout «gbwwf» → pizzas', () => {
    expect(ids('gbwwf')).toEqual(['pepperoni', 'margarita']);
  });
  it('«филаделфия» → Филадельфия', () => {
    expect(ids('филаделфия')[0]).toBe('phila');
  });
  it('prefix search', () => {
    expect(ids('бург')[0]).toBe('burger');
  });
  it('synonyms: суши → роллы, сладкое → чизкейк, кофе → латте, мясо → говядина', () => {
    expect(ids('суши')).toContain('phila');
    expect(ids('сладкое')).toContain('cheesecake');
    expect(ids('кофе')).toContain('latte');
    expect(ids('мясо')).toContain('burger');
  });
  it('searches tagline and ingredients too', () => {
    expect(ids('лосось')).toContain('phila');
    expect(ids('креветки')).toContain('tomyam');
  });
  it('multi-word query', () => {
    expect(ids('пицца маргарита')[0]).toBe('margarita');
  });
  it('case & ё insensitive', () => {
    expect(ids('ЛАТТЕ')).toEqual(['latte']);
    expect(ids('ёмкий')).toContain('mors');
  });
  it('empty / punctuation-only query → []', () => {
    expect(ids('')).toEqual([]);
    expect(ids('  !!! ')).toEqual([]);
  });
  it('garbage → no results', () => {
    expect(ids('zzzzqqq')).toEqual([]);
  });
});

describe('didYouMean', () => {
  it('suggests the closest dish-name word', () => {
    expect(didYouMean(menu, 'пица')).toBe('пицца');
    expect(didYouMean(menu, 'бургир')).toBe('бургер');
  });
  it('works through wrong layout', () => {
    expect(didYouMean(menu, 'gbwf')).toBe('пицца');
  });
  it('short queries / far words → null', () => {
    expect(didYouMean(menu, 'пи')).toBeNull();
    expect(didYouMean(menu, 'абракадабра')).toBeNull();
  });
  // BUG (fuzzy.ts didYouMean): exact hits (d === 0) are skipped but the loop keeps looking, so a correctly
  // spelled word gets "corrected" into a different word within distance 2. Menu [«Суп дня», «Сыр»], query «суп»
  // → returns «сыр» («Возможно, вы имели в виду: сыр»); expected null.
  test('no suggestion when the query already is a dish-name word', () => {
    const m = [makeDish({ name: 'Суп дня' }), makeDish({ name: 'Сыр гриль' })];
    expect(didYouMean(m, 'суп')).toBeNull();
  });
});

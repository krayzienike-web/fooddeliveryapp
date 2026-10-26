import { dayMonth, distance, etaWindow, hhmm, isoDate, maskPhone, minutes, phoneDigits, plural, points, rub, weekdayShort, weight } from '@/shared/lib/format';
import { at } from '../fixtures';

const NBSP = ' ';

describe('money and points', () => {
  it('rub groups thousands with a regular no-break space (not U+202F) and appends ₽', () => {
    expect(rub(1290)).toBe(`1${NBSP}290${NBSP}₽`);
    expect(rub(1234567)).toBe(`1${NBSP}234${NBSP}567${NBSP}₽`);
    expect(rub(990)).toBe(`990${NBSP}₽`);
    expect(rub(0)).toBe(`0${NBSP}₽`);
    expect(rub(1290)).not.toContain(' ');
  });
  it('rub rounds and uses a real minus sign', () => {
    expect(rub(99.6)).toBe(`100${NBSP}₽`);
    expect(rub(-300)).toBe(`−300${NBSP}₽`);
  });
  it('points', () => {
    expect(points(1840)).toBe(`1${NBSP}840${NBSP}Б`);
    expect(points(50.4)).toBe(`50${NBSP}Б`);
  });
});

describe('plural (Russian)', () => {
  const p = (n: number) => plural(n, 'гость', 'гостя', 'гостей');
  it.each([
    [1, 'гость'], [2, 'гостя'], [4, 'гостя'], [5, 'гостей'], [11, 'гостей'], [12, 'гостей'], [14, 'гостей'],
    [21, 'гость'], [22, 'гостя'], [25, 'гостей'], [101, 'гость'], [111, 'гостей'], [0, 'гостей'],
  ])('%i → %s', (n, w) => expect(p(n)).toBe(w));
  it('minutes', () => {
    expect(minutes(1)).toBe(`1${NBSP}минута`);
    expect(minutes(3)).toBe(`3${NBSP}минуты`);
    expect(minutes(15)).toBe(`15${NBSP}минут`);
  });
});

describe('dates (local time, Europe/Moscow)', () => {
  const fri = at(2026, 10, 23, 9, 5);
  it('hhmm pads hours and minutes', () => expect(hhmm(fri)).toBe('09:05'));
  it('etaWindow', () => expect(etaWindow(fri, at(2026, 10, 23, 9, 40))).toBe('09:05–09:40'));
  it('isoDate', () => expect(isoDate(at(2026, 1, 3, 23, 59))).toBe('2026-01-03'));
  it('dayMonth uses the genitive month', () => expect(dayMonth(fri)).toBe('23 октября'));
  it('weekdayShort', () => expect(weekdayShort(fri)).toBe('пт'));
});

describe('phone mask', () => {
  it('formats progressively while typing', () => {
    expect(maskPhone('')).toBe('+7');
    expect(maskPhone('9')).toBe('+7 (9');
    expect(maskPhone('921')).toBe('+7 (921');
    expect(maskPhone('9215')).toBe('+7 (921) 5');
    expect(maskPhone('9215551')).toBe('+7 (921) 555-1');
    expect(maskPhone('9215551234')).toBe('+7 (921) 555-12-34');
  });
  it('drops a leading 7/8 country prefix and extra digits', () => {
    expect(maskPhone('89215551234')).toBe('+7 (921) 555-12-34');
    expect(maskPhone('+7 921 555 12 34 99')).toBe('+7 (921) 555-12-34');
  });
  it('re-masking an already masked value is stable (onChangeText receives the masked text)', () => {
    const once = maskPhone('9215551234');
    expect(maskPhone(once)).toBe(once);
  });
  it('phoneDigits ↔ maskPhone round-trip', () => {
    expect(phoneDigits(maskPhone('9990000000'))).toBe('9990000000');
    expect(phoneDigits('+7 (921) 555-12-34')).toBe('9215551234');
  });
  // Fixed: the bracket closes only with the 4th digit, so Backspace can delete past it.
  it('backspace over «)» is not undone by the mask', () => {
    expect(maskPhone('+7 (921')).toBe('+7 (921');
  });
});

describe('weight and distance', () => {
  it('weight', () => expect(weight(260, 'г')).toBe(`260${NBSP}г`));
  it.each([
    [10, '50 м'], [449, '450 м'], [940, '950 м'], [1200, '1,2 км'], [9960, '10,0 км'], [12_400, '12 км'],
  ])('distance(%i) → %s', (m, s) => expect(distance(m)).toBe(s));
});

import type { FloorTable } from '@/entities/restaurant/model/types';
import { DISHES } from '@/mocks/seed/menu';
import { BANQUET_LIMITS, composeBanquetMenu, minBudgetPerGuest } from '../banquet';
import { bookableSlots, bookingIcs, dateOptions, openStatus, pickTable, tableState } from '../booking';

// Wednesday 21 Oct 2026, 18:40 local.
const NOW = new Date(2026, 9, 21, 18, 40);
const SLOTS = Array.from({ length: 21 }, (_, i) => `${12 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`);

const table = (id: string, seats: number, zone: FloorTable['zone'] = 'hall'): FloorTable => ({ id, label: id, seats, shape: 'square', zone, x: 0, y: 0, w: 10, h: 10 });

describe('booking rules', () => {
  test('date chips start with Сегодня/Завтра, then weekday + day', () => {
    const d = dateOptions(NOW, 5);
    expect(d.map((x) => x.label)).toEqual(['Сегодня', 'Завтра', 'Пт 23', 'Сб 24', 'Вс 25']);
    expect(d[0].date).toBe('2026-10-21');
    expect(d.filter((x) => x.weekend).map((x) => x.date)).toEqual(['2026-10-24', '2026-10-25']);
  });

  test('today hides past slots and keeps a 30-min lead; last seating is an hour before closing', () => {
    const today = bookableSlots(SLOTS, '2026-10-21', NOW, { openFrom: 10, openTo: 23 });
    expect(today[0]).toBe('19:30');
    expect(today[today.length - 1]).toBe('22:00');
    const tomorrow = bookableSlots(SLOTS, '2026-10-22', NOW, { openFrom: 11, openTo: 23 });
    expect(tomorrow[0]).toBe('12:00');
  });

  test('restaurant open past midnight still offers late evening slots', () => {
    expect(bookableSlots(SLOTS, '2026-10-22', NOW, { openFrom: 10, openTo: 26 })).toContain('22:00');
  });

  test('table state: selected > too small > busy > free', () => {
    expect(tableState(table('a', 2), [], 4)).toBe('small');
    expect(tableState(table('a', 4), ['a'], 4)).toBe('busy');
    expect(tableState(table('a', 4), [], 4)).toBe('free');
    expect(tableState(table('a', 4), ['a'], 4, 'a')).toBe('selected');
  });

  test('«any free table» picks the smallest fitting table, prefers windows, skips busy', () => {
    const tables = [table('big', 8), table('hall4', 4), table('win4', 4, 'window'), table('two', 2)];
    expect(pickTable(tables, [], 3)?.id).toBe('win4');
    expect(pickTable(tables, ['win4'], 3)?.id).toBe('hall4');
    expect(pickTable(tables, ['win4', 'hall4'], 3)?.id).toBe('big');
    expect(pickTable(tables, ['win4', 'hall4', 'big'], 3)).toBeUndefined();
    expect(pickTable(tables, [], 3, 'hall')?.id).toBe('hall4');
  });

  test('open status', () => {
    expect(openStatus({ openFrom: 10, openTo: 23 }, NOW)).toEqual({ open: true, text: 'Открыто до 23:00' });
    expect(openStatus({ openFrom: 10, openTo: 26 }, new Date(2026, 9, 21, 1, 0))).toEqual({ open: true, text: 'Открыто до 02:00' });
    expect(openStatus({ openFrom: 10, openTo: 23 }, new Date(2026, 9, 21, 8, 0)).open).toBe(false);
    expect(openStatus({ openFrom: 0, openTo: 24 }, NOW).text).toBe('Круглосуточно');
  });

  test('ICS event has a 2h reminder and Moscow time', () => {
    const ics = bookingIcs({ id: 'b1', date: '2026-10-22', time: '19:00', guests: 4 }, { name: 'ЖАР на Невском', address: 'Невский пр., 74' });
    expect(ics).toContain('DTSTART;TZID=Europe/Moscow:20261022T190000');
    expect(ics).toContain('TRIGGER:-PT2H');
  });
});

describe('banquet menu', () => {
  const byId = Object.fromEntries(DISHES.map((d) => [d.id, d]));

  test.each([
    [20, 3000, 'banquet'],
    [40, 2000, 'buffet'],
    [80, 2500, 'catering'],
  ] as const)('%i guests × %i ₽ (%s) fits the budget with sensible grams', (guests, budgetPerGuest, format) => {
    const m = composeBanquetMenu(DISHES, { guests, budgetPerGuest, format });
    expect(m.fitsBudget).toBe(true);
    expect(m.total).toBeLessThanOrEqual(guests * budgetPerGuest);
    expect(m.gramsPerGuest).toBeGreaterThan(400);
    const recomputed = m.sections.flatMap((s) => s.items).reduce((s, i) => s + byId[i.dishId].price * i.qty, 0);
    expect(recomputed).toBe(m.total);
    const drinks = m.sections.find((s) => s.title === 'Напитки')!;
    expect(drinks.items.reduce((s, i) => s + i.qty, 0)).toBeGreaterThanOrEqual(guests);
  });

  test('below the honest minimum the menu says it does not fit; at the minimum it does', () => {
    expect(composeBanquetMenu(DISHES, { guests: 10, budgetPerGuest: 900, format: 'banquet' }).fitsBudget).toBe(false);
    const min = minBudgetPerGuest(DISHES, 10, 'banquet');
    expect(min % BANQUET_LIMITS.budgetStep).toBe(0);
    expect(composeBanquetMenu(DISHES, { guests: 10, budgetPerGuest: min, format: 'banquet' }).fitsBudget).toBe(true);
  });

  test('a generous budget upgrades to premium dishes', () => {
    const m = composeBanquetMenu(DISHES, { guests: 20, budgetPerGuest: BANQUET_LIMITS.maxBudget, format: 'banquet' });
    expect(m.strategy).toBe('premium');
  });

  test('variety grows with the number of guests; variant changes the menu', () => {
    const small = composeBanquetMenu(DISHES, { guests: 12, budgetPerGuest: 3000, format: 'banquet' });
    const big = composeBanquetMenu(DISHES, { guests: 70, budgetPerGuest: 3000, format: 'banquet' });
    expect(big.sections[0].items.length).toBeGreaterThan(small.sections[0].items.length);
    const other = composeBanquetMenu(DISHES, { guests: 12, budgetPerGuest: 3000, format: 'banquet', variant: 1 });
    expect(other.sections.map((s) => s.items.map((i) => i.dishId))).not.toEqual(small.sections.map((s) => s.items.map((i) => i.dishId)));
  });

  test('no soups, breakfasts or kids dishes on a banquet table; stop-list respected', () => {
    const top = composeBanquetMenu(DISHES, { guests: 30, budgetPerGuest: 3000, format: 'banquet' });
    const firstSet = top.sections[0].items[0].dishId;
    const m = composeBanquetMenu(DISHES, { guests: 30, budgetPerGuest: 3000, format: 'banquet', stopList: [firstSet] });
    const ids = m.sections.flatMap((s) => s.items.map((i) => i.dishId));
    expect(ids).not.toContain(firstSet);
    for (const id of ids) {
      expect(['soups', 'breakfast']).not.toContain(byId[id].categoryId);
      expect(byId[id].tags).not.toContain('kids');
    }
  });
});

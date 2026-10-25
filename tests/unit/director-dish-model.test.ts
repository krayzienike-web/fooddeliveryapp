/** Small pure helpers: director clock override, default modifier options, achievements catalogue. */
import { defaultOptions } from '@/entities/dish/model/store';
import { ACHIEVEMENTS } from '@/entities/user/model/achievements';
import { directorNow } from '@/features/director/model/store';
import { at, makeDish, makeModifierGroup } from '../fixtures';

describe('directorNow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(at(2026, 10, 21, 10, 15)); // Wednesday
  });
  afterEach(() => jest.useRealTimers());

  it('no override → real now', () => {
    expect(directorNow({})).toBe(at(2026, 10, 21, 10, 15));
  });
  it('weekday override moves forward to that weekday (same week or next), keeps the time', () => {
    const fri = new Date(directorNow({ weekday: 5 }));
    expect(fri.getDay()).toBe(5);
    expect(fri.getDate()).toBe(23);
    expect(fri.getHours()).toBe(10);
    const mon = new Date(directorNow({ weekday: 1 }));
    expect(mon.getDate()).toBe(26); // never goes back in time
    expect(new Date(directorNow({ weekday: 3 })).getDate()).toBe(21); // today
  });
  it('hour override pins hh:05', () => {
    const d = new Date(directorNow({ weekday: 5, hour: 19 }));
    expect([d.getDay(), d.getHours(), d.getMinutes()]).toEqual([5, 19, 5]);
  });
});

describe('defaultOptions', () => {
  const size = makeModifierGroup({ id: 'size', kind: 'single', defaultOptionId: 'm' });
  const crust = makeModifierGroup({ id: 'crust', kind: 'single' }); // no default
  const extra = makeModifierGroup({ id: 'extra', kind: 'multi', defaultOptionId: 'cheese' });
  const mods = { size, crust, extra };

  it('picks defaults of single-choice groups only, in group order', () => {
    expect(defaultOptions(makeDish({ modifierGroupIds: ['extra', 'size', 'crust'] }), mods)).toEqual(['m']);
  });
  it('ignores unknown groups and dishes without modifiers', () => {
    expect(defaultOptions(makeDish({ modifierGroupIds: ['nope', 'size'] }), mods)).toEqual(['m']);
    expect(defaultOptions(makeDish({ modifierGroupIds: [] }), mods)).toEqual([]);
  });
});

describe('ACHIEVEMENTS catalogue', () => {
  it('ids are unique kebab-case (they become testIDs and are stored on User.achievements)', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('every achievement has a title, a description and an icon', () => {
    for (const a of ACHIEVEMENTS) expect(a.title && a.description && a.icon).toBeTruthy();
  });
});

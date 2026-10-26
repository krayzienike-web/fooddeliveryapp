import { anchorLabel, anchorName, parseAnchor, routeFor, routeKey } from '../anchors';

describe('feedback anchors', () => {
  test('name ↔ parse round-trip, with and without a key', () => {
    for (const a of [
      { route: 'Dish', key: 'bg-zhar', target: 'dish-add' },
      { route: 'Home', target: 'screen' },
      { route: 'Booking', key: 'r-nevsky', target: 'booking-slot-1900' },
    ]) {
      expect(parseAnchor(anchorName(a))).toEqual({ ...a, key: a.key });
    }
    expect(anchorName({ route: 'Dish', key: 'bg-zhar', target: 'dish-add' })).toBe('Dish(bg-zhar) › dish-add');
  });

  test('stays within 128 bytes', () => {
    const name = anchorName({ route: 'Restaurant', key: 'r-novaya-gollandiya', target: 'x'.repeat(300) });
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(128);
    expect(parseAnchor(name)?.route).toBe('Restaurant');
  });

  test('foreign anchors (shell CSS paths) are not ours', () => {
    expect(parseAnchor('div > div:nth-child(2)')).toBeNull();
  });

  test('route key and navigation back', () => {
    expect(routeKey('AR', { dishId: 'pz-pepperoni' })).toBe('pz-pepperoni');
    expect(routeKey('Home', undefined)).toBeUndefined();
    expect(routeFor({ route: 'Menu', target: 'screen' })).toEqual({ name: 'Tabs', params: { screen: 'Menu' } });
    expect(routeFor({ route: 'Order', key: 'o-1', target: 'order-eta' })).toEqual({ name: 'Order', params: { id: 'o-1' } });
  });

  test('label', () => {
    expect(anchorLabel('Cart', '  Оформить   заказ ')).toBe('Корзина · Оформить заказ');
    expect(anchorLabel('Cart', '')).toBe('Корзина');
  });
});

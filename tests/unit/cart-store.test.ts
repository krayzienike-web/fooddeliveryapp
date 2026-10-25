/**
 * Cart store (features/cart/model/store.ts): line merging by key, qty to zero removes, group members, clamps.
 * The store is zustand + persist; AsyncStorage is replaced by its official in-memory mock.
 */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { lineKey } from '@/entities/cart/model/pricing';
import { useCart } from '@/features/cart/model/store';
import { makeLine } from '../fixtures';

const s = () => useCart.getState();

beforeEach(() => {
  s().clear();
  s().setMode('delivery');
  s().setCutlery(1);
});

describe('add', () => {
  it('same dish + same options merges into one line', () => {
    s().add('pz-1', ['pz-30'], []);
    s().add('pz-1', ['pz-30'], [], 2);
    expect(s().lines).toHaveLength(1);
    expect(s().lines[0]).toMatchObject({ dishId: 'pz-1', qty: 3, key: lineKey('pz-1', ['pz-30'], []) });
  });
  it('different options or removed ingredients make separate lines', () => {
    s().add('pz-1', ['pz-30']);
    s().add('pz-1', ['pz-35']);
    s().add('pz-1', ['pz-30'], ['onion']);
    expect(s().lines).toHaveLength(3);
  });
  it('the same dish added by a group member is a separate line tagged with the member', () => {
    s().add('rl-1');
    s().add('rl-1', [], [], 1, 'masha');
    expect(s().lines).toHaveLength(2);
    expect(s().lines[1]).toMatchObject({ addedBy: 'masha', key: `${lineKey('rl-1', [], [])}@masha` });
  });
  it('records lastAdded for the fly-to-cart animation and bumps updatedAt', () => {
    s().add('drk-1');
    expect(s().lastAdded?.dishId).toBe('drk-1');
    expect(typeof s().updatedAt).toBe('number');
  });
});

describe('quantities', () => {
  it('inc / dec / dec to zero removes the line', () => {
    s().add('a');
    const key = s().lines[0].key;
    s().inc(key);
    expect(s().lines[0].qty).toBe(2);
    s().dec(key);
    s().dec(key);
    expect(s().lines).toHaveLength(0);
  });
  it('remove deletes only that line', () => {
    s().add('a');
    s().add('b');
    s().remove(s().lines[0].key);
    expect(s().lines.map((l) => l.dishId)).toEqual(['b']);
  });
  it('cutlery is clamped to 0..10', () => {
    s().setCutlery(-1);
    expect(s().cutlery).toBe(0);
    s().setCutlery(42);
    expect(s().cutlery).toBe(10);
  });
});

describe('replaceAll / clear', () => {
  it('replaceAll (repeat an order) swaps the lines and points lastAdded at the first one', () => {
    s().add('x');
    s().replaceAll([makeLine({ dishId: 'p', qty: 2 }), makeLine({ dishId: 'q' })]);
    expect(s().lines.map((l) => l.dishId)).toEqual(['p', 'q']);
    expect(s().lastAdded?.dishId).toBe('p');
  });
  it('clear resets promo, points, tips, comment and the group but keeps mode and address', () => {
    s().setMode('pickup');
    s().setAddress('addr-work');
    s().add('a');
    s().setTips(100);
    s().setComment('код 1234');
    s().setPoints(50);
    s().startGroup([{ id: 'me', name: 'Я', color: '#000' }]);
    s().clear();
    expect(s()).toMatchObject({ lines: [], tips: 0, comment: '', pointsToSpend: 0, group: [], promo: undefined, mode: 'pickup', addressId: 'addr-work' });
  });
});

describe('group cart', () => {
  it('startGroup / markPaid / endGroup', () => {
    s().startGroup([{ id: 'me', name: 'Я', color: '#000' }, { id: 'dima', name: 'Дима', color: '#111' }]);
    s().markPaid('dima');
    expect(s().group.find((m) => m.id === 'dima')?.paid).toBe(true);
    expect(s().group.find((m) => m.id === 'me')?.paid).toBeUndefined();
    s().endGroup();
    expect(s().group).toEqual([]);
  });
});

import type { BillItem } from '@/entities/table/model/types';
import { createApi } from '@/services/mock';
import { splitBill } from '../bill';

const item = (id: string, price: number, qty = 1): BillItem => ({ id, dishId: id, name: id, price, qty, status: 'served' });
const items = [item('a', 690), item('b', 520), item('c', 180, 2)];

describe('splitBill', () => {
  test('whole bill with tips', () => {
    expect(splitBill(items, { mode: 'all', people: 1, mine: [], tipsPercent: 10 })).toEqual({ subtotal: 1570, tips: 157, total: 1727, tableTotal: 1570 });
  });

  test('equal split rounds each share up so the table is never short', () => {
    const s = splitBill(items, { mode: 'equal', people: 3, mine: [], tipsPercent: 0 });
    expect(s.subtotal).toBe(524);
    expect(s.subtotal * 3).toBeGreaterThanOrEqual(1570);
  });

  test('by items counts only mine, quantities included', () => {
    expect(splitBill(items, { mode: 'items', people: 2, mine: ['c'], tipsPercent: 5 })).toMatchObject({ subtotal: 360, tips: 18, total: 378 });
  });

  test('people < 1 is treated as 1', () => {
    expect(splitBill(items, { mode: 'equal', people: 0, mine: [], tipsPercent: 0 }).subtotal).toBe(1570);
  });
});

describe('mock TableApi / GiftApi', () => {
  const api = createApi({ latencyMs: 0, seed: 1 });

  test('join → add items (cooking) → pay full closes the table and earns points', async () => {
    const t = await api.table.join('zhar://table/r-nevsky/12');
    expect(t).toMatchObject({ restaurantId: 'r-nevsky', tableLabel: '12', paid: false });
    expect((await api.table.join('zhar://table/r-nevsky/12')).id).toBe(t.id);
    const more = await api.table.addItems(t.id, [{ dishId: 'des-tiramisu', qty: 2 }]);
    expect(more.items.at(-1)).toMatchObject({ dishId: 'des-tiramisu', qty: 2, status: 'cooking' });
    const total = more.items.reduce((s, i) => s + i.price * i.qty, 0);
    const before = (await api.user.me()).points;
    const res = await api.table.pay(t.id, total);
    expect(res.session.paid).toBe(true);
    expect(res.pointsEarned).toBeGreaterThan(0);
    expect((await api.user.me()).points).toBe(before + res.pointsEarned);
    await expect(api.table.addItems(t.id, [{ dishId: 'drk-cola', qty: 1 }])).rejects.toMatchObject({ code: 'conflict' });
  });

  test('partial payment keeps the table open', async () => {
    const t = await api.table.join('zhar://table/r-smolny/3');
    expect((await api.table.pay(t.id, 100)).session.paid).toBe(false);
  });

  test('gift: validates amount and phone, returns a readable code', async () => {
    const base = { amount: 3000, design: 'fire' as const, recipientName: 'Маша', recipientPhone: '+79215550000', message: 'С днём рождения!', sendAt: 'now' };
    const g = await api.gifts.send(base);
    expect(g.code).toMatch(/^ЖАР-[2-9A-HJ-NP-Z]{4}$/);
    await expect(api.gifts.send({ ...base, amount: 100 })).rejects.toMatchObject({ code: 'validation' });
    await expect(api.gifts.send({ ...base, recipientPhone: '123' })).rejects.toMatchObject({ code: 'validation' });
  });
});

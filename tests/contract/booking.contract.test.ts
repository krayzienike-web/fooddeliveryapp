import type { Api } from '@/services/contracts';
import { describeContract, expectApiError, makeApi } from './harness';

const DATE = '2026-12-12';
const TIME = '19:00';

describeContract('BookingApi contract', () => {
  let api: Api;
  beforeEach(async () => { api = makeApi(); await api.director.reset(); });

  it('restaurants have floor plans with tables', async () => {
    const rs = await api.booking.restaurants();
    expect(rs.length).toBeGreaterThan(0);
    for (const r of rs) {
      const plan = await api.booking.floorPlan(r.floorPlanId);
      expect(plan.tables.length).toBeGreaterThan(0);
      expect(new Set(plan.tables.map((t) => t.id)).size).toBe(plan.tables.length);
    }
  });

  it('availability returns slots and busy table ids that exist on the plan', async () => {
    const [r] = await api.booking.restaurants();
    const plan = await api.booking.floorPlan(r.floorPlanId);
    const av = await api.booking.availability(r.id, DATE, TIME, 2);
    expect(av.slots.length).toBeGreaterThan(0);
    for (const s of av.slots) expect(s).toMatch(/^\d{2}:\d{2}$/);
    const ids = new Set(plan.tables.map((t) => t.id));
    expect(av.busyTableIds.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('book a free table → confirmed, appears in myBookings, table becomes busy, double booking conflicts', async () => {
    const [r] = await api.booking.restaurants();
    const plan = await api.booking.floorPlan(r.floorPlanId);
    const av = await api.booking.availability(r.id, DATE, TIME, 2);
    const table = plan.tables.find((t) => t.seats >= 2 && !av.busyTableIds.includes(t.id))!;
    expect(table).toBeDefined();
    const b = await api.booking.book({ restaurantId: r.id, tableId: table.id, date: DATE, time: TIME, guests: 2, preorder: [] });
    expect(b).toMatchObject({ status: 'confirmed', tableId: table.id });
    expect((await api.booking.myBookings()).map((x) => x.id)).toContain(b.id);
    expect((await api.booking.availability(r.id, DATE, TIME, 2)).busyTableIds).toContain(table.id);
    await expectApiError(api.booking.book({ restaurantId: r.id, tableId: table.id, date: DATE, time: TIME, guests: 2, preorder: [] }), 'conflict');
  });

  it('booking keeps the pre-order', async () => {
    const [r] = await api.booking.restaurants();
    const plan = await api.booking.floorPlan(r.floorPlanId);
    const menu = await api.catalog.getMenu();
    const av = await api.booking.availability(r.id, DATE, '20:00', 2);
    const table = plan.tables.find((t) => !av.busyTableIds.includes(t.id))!;
    const preorder = [{ dishId: menu.dishes[0].id, qty: 2 }];
    const b = await api.booking.book({ restaurantId: r.id, tableId: table.id, date: DATE, time: '20:00', guests: 2, preorder });
    expect(b.preorder).toEqual(preorder);
  });
});

describeContract('Banquet contract', () => {
  it('sendBanquet → request with id and status sent', async () => {
    const api = makeApi();
    await api.director.reset();
    const rs = await api.booking.restaurants();
    const r = rs.find((x) => x.hasBanquetHall) ?? rs[0];
    const menu = await api.catalog.getMenu();
    const req = await api.booking.sendBanquet({
      restaurantId: r.id, date: DATE, guests: 20, budgetPerGuest: 3000, format: 'banquet', occasion: 'День рождения',
      menu: [{ dishId: menu.dishes[0].id, qty: 20 }], total: 60000, gramsPerGuest: 1200,
    });
    expect(req.id).toBeTruthy();
    expect(req.status).toBe('sent');
    expect(req.guests).toBe(20);
  });
});

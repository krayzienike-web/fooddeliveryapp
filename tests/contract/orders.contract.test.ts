import type { Api, PlaceOrderInput } from '@/services/contracts';
import type { Order } from '@/entities/order/model/types';
import { DELIVERY_FLOW, PICKUP_FLOW } from '@/entities/order/model/lifecycle';
import { SPB_CENTER, TEST_CODE, TEST_PHONE, describeContract, expectApiError, makeApi, waitFor } from './harness';

jest.setTimeout(60000);

async function setup(): Promise<{ api: Api; input: (over?: Partial<PlaceOrderInput>) => PlaceOrderInput }> {
  const api = makeApi();
  await api.director.reset();
  await api.auth.requestCode(TEST_PHONE);
  await api.auth.verifyCode(TEST_PHONE, TEST_CODE);
  const menu = await api.catalog.getMenu();
  const [restaurant] = await api.booking.restaurants();
  const dish = menu.dishes.find((d) => !menu.stopList.includes(d.id) && d.modifierGroupIds.length === 0) ?? menu.dishes[0];
  const input = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
    lines: [{ key: `${dish.id}||`, dishId: dish.id, qty: 3, optionIds: [], removedIngredientIds: [] }],
    mode: 'delivery',
    address: { id: 'a1', label: 'Дом', street: 'Невский проспект', house: '28', point: SPB_CENTER },
    restaurantId: restaurant.id,
    payment: 'card',
    pointsToSpend: 0,
    tips: 0,
    cutlery: 1,
    ...over,
  });
  return { api, input };
}

describeContract('OrdersApi contract', () => {
  it('place → created order with history, listed and gettable', async () => {
    const { api, input } = await setup();
    const o = await api.orders.place(input());
    expect(o.id).toBeTruthy();
    expect(o.number).toBeTruthy();
    expect(o.status).toBe('created');
    expect(o.history[0].status).toBe('created');
    expect(o.total).toBeGreaterThan(0);
    expect(o.etaFrom).toBeLessThanOrEqual(o.etaTo);
    expect((await api.orders.list()).map((x) => x.id)).toContain(o.id);
    expect((await api.orders.get(o.id)).id).toBe(o.id);
    await expectApiError(api.orders.get('no-such-order'), 'not_found');
  });

  it('delivery order progresses through the whole flow to delivered under accelerated speed', async () => {
    const { api, input } = await setup();
    api.director.setSpeed(600);
    const o = await api.orders.place(input());
    const seen: string[] = [];
    let last: Order | undefined;
    const unsub = api.orders.subscribe(o.id, (x) => { last = x; if (seen[seen.length - 1] !== x.status) seen.push(x.status); });
    const done = await waitFor(() => (last?.status === 'delivered' ? last : undefined), 45000);
    unsub();
    // statuses only move forward along the delivery flow
    const idx = seen.map((s) => DELIVERY_FLOW.indexOf(s as Order['status']));
    expect(idx.every((i) => i >= 0)).toBe(true);
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
    expect(done.history.map((h) => h.status)).toEqual(DELIVERY_FLOW);
    expect(done.courier).toBeDefined();
    expect(done.route?.length ?? 0).toBeGreaterThan(1);
    expect(done.courierProgress).toBeCloseTo(1, 1);
  });

  it('pickup order ends in picked_up with a shelf number after «Я подхожу»', async () => {
    const { api, input } = await setup();
    api.director.setSpeed(600);
    const o = await api.orders.place(input({ mode: 'pickup', address: undefined }));
    await waitFor(async () => ((await api.orders.get(o.id)).status === 'ready_for_pickup' ? true : undefined), 45000);
    const arriving = await api.orders.arriving(o.id);
    expect(arriving.pickupShelf).toBeTruthy();
    const done = await waitFor(async () => { const x = await api.orders.get(o.id); return x.status === 'picked_up' ? x : undefined; }, 45000);
    expect(done.history.map((h) => h.status)).toEqual(PICKUP_FLOW);
  });

  it('cancel is allowed right after placing', async () => {
    const { api, input } = await setup();
    const o = await api.orders.place(input());
    expect((await api.orders.cancel(o.id)).status).toBe('cancelled');
  });

  it('rate stores stars & tags', async () => {
    const { api, input } = await setup();
    const o = await api.orders.place(input());
    const r = await api.orders.rate(o.id, 5, ['Горячее'], 'Отлично');
    expect(r.rated).toMatchObject({ stars: 5, tags: ['Горячее'] });
  });
});

describeContract('DirectorApi incidents contract', () => {
  it('triggerIncident attaches a built incident with compensation and resolutions', async () => {
    const { api, input } = await setup();
    const o = await api.orders.place(input());
    const inc = await api.director.triggerIncident(o.id, 'kitchen_delay');
    expect(inc).not.toBeNull();
    expect(inc!.kind).toBe('kitchen_delay');
    expect(inc!.resolutions.length).toBeGreaterThan(0);
    const after = await api.orders.get(o.id);
    expect(after.incidents.map((i) => i.id)).toContain(inc!.id);
  });

  it('resolveIncident records the chosen resolution', async () => {
    const { api, input } = await setup();
    const o = await api.orders.place(input());
    const inc = (await api.director.triggerIncident(o.id, 'stop_list'))!;
    const res = await api.orders.resolveIncident(o.id, inc.id, inc.resolutions[0].id);
    expect(res.incidents.find((i) => i.id === inc.id)!.resolvedWith).toBe(inc.resolutions[0].id);
  });

  it('respects max 2 proactive messages per order (payment problems excepted)', async () => {
    const { api, input } = await setup();
    const o = await api.orders.place(input());
    expect(await api.director.triggerIncident(o.id, 'stop_list')).not.toBeNull();
    expect(await api.director.triggerIncident(o.id, 'kitchen_delay')).not.toBeNull();
    expect(await api.director.triggerIncident(o.id, 'weather_load')).toBeNull();
    expect(await api.director.triggerIncident(o.id, 'payment_failed')).not.toBeNull();
  });

  it('incident updates are pushed to subscribers', async () => {
    const { api, input } = await setup();
    const o = await api.orders.place(input());
    let last: Order | undefined;
    const unsub = api.orders.subscribe(o.id, (x) => { last = x; });
    await api.director.triggerIncident(o.id, 'courier_delay');
    await waitFor(() => last?.incidents.some((i) => i.kind === 'courier_delay'), 5000);
    unsub();
  });
});

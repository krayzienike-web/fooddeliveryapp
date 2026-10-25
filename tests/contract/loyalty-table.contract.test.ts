/**
 * LoyaltyApi + TableApi gaps not covered next to the code (src/features/{loyalty,table}/model/__tests__):
 * spin exhaustion → conflict, bonus spin for a big order, prize promos listed as personal, waiter call, unknown QR.
 */
import type { PlaceOrderInput } from '@/services/contracts';
import { WHEEL_RULES } from '@/entities/user/model/loyalty';
import { SPB_CENTER, TEST_CODE, TEST_PHONE, describeContract, expectApiError, makeApi } from './harness';

jest.setTimeout(30000);

async function loggedIn() {
  const api = makeApi();
  await api.director.reset();
  await api.auth.requestCode(TEST_PHONE);
  await api.auth.verifyCode(TEST_PHONE, TEST_CODE);
  return api;
}

describeContract('LoyaltyApi contract', () => {
  it('state → spins until none left, then conflict', async () => {
    const api = await loggedIn();
    const st = await api.loyalty.state();
    expect(st.spins).toBeGreaterThanOrEqual(1);
    for (let i = st.spins; i > 0; i--) {
      const r = await api.loyalty.spin();
      expect(r.state.spins).toBe(i - 1);
      expect(r.prize.title).toBeTruthy();
      if (r.prize.kind === 'points') expect(r.promo).toBeUndefined();
      else expect(r.promo?.code).toMatch(/^ПРИЗ-/);
    }
    await expectApiError(api.loyalty.spin(), 'conflict');
  });

  it('non-point prizes appear among personal promos', async () => {
    const api = await loggedIn();
    const codes: string[] = [];
    for (let i = (await api.loyalty.state()).spins; i > 0; i--) {
      const r = await api.loyalty.spin();
      if (r.promo) codes.push(r.promo.code);
    }
    const promos = await api.catalog.getPromos();
    for (const c of codes) expect(promos.find((p) => p.code === c)?.personal).toBe(true);
  });

  it(`an order with items ≥ ${WHEEL_RULES.orderMin} ₽ grants a bonus spin`, async () => {
    const api = await loggedIn();
    for (let i = (await api.loyalty.state()).spins; i > 0; i--) await api.loyalty.spin();
    expect((await api.loyalty.state()).spins).toBe(0);
    const menu = await api.catalog.getMenu();
    const dish = menu.dishes.find((d) => !menu.stopList.includes(d.id) && d.modifierGroupIds.length === 0 && d.price >= 300)!;
    const qty = Math.ceil(WHEEL_RULES.orderMin / dish.price);
    const [restaurant] = await api.booking.restaurants();
    const input: PlaceOrderInput = {
      lines: [{ key: `${dish.id}||`, dishId: dish.id, qty, optionIds: [], removedIngredientIds: [] }],
      mode: 'delivery',
      address: { id: 'a1', label: 'Дом', street: 'Невский проспект', house: '28', point: SPB_CENTER },
      restaurantId: restaurant.id,
      payment: 'card',
      pointsToSpend: 0,
      tips: 0,
      cutlery: 1,
    };
    await api.orders.place(input);
    expect((await api.loyalty.state()).spins).toBe(1);
  });
});

describeContract('TableApi contract', () => {
  it('callWaiter answers with an ETA; unknown session → not_found', async () => {
    const api = await loggedIn();
    const t = await api.table.join('zhar://table/r-nevsky/5');
    expect((await api.table.callWaiter(t.id)).etaMinutes).toBeGreaterThan(0);
    await expectApiError(api.table.callWaiter('no-such-table'), 'not_found');
  });

  it('an unrecognised QR opens the demo table instead of failing', async () => {
    const api = await loggedIn();
    const t = await api.table.join('https://example.com/not-a-zhar-qr');
    expect(t.restaurantId).toBe('r-rubinshteyna');
    expect(t.items.length).toBeGreaterThan(0);
  });
});

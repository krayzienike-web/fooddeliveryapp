import type { Api } from '@/services/contracts';
import { WHEEL_PRIZES } from '@/entities/user/model/loyalty';
import { SPB_CENTER, TEST_CODE, TEST_PHONE, describeContract, expectApiError, hasMockApi, makeApi } from './harness';

if (!hasMockApi) test.todo('mock backend (src/services/mock/index.ts → createApi) not available yet — contract suites skipped');

describeContract('AuthApi contract', () => {
  let api: Api;
  beforeEach(async () => { api = makeApi(); await api.director.reset(); });

  it('requestCode returns a resend timer', async () => {
    const r = await api.auth.requestCode(TEST_PHONE);
    expect(r.resendInSec).toBeGreaterThan(0);
  });
  it('code 0000 is accepted and returns token + user', async () => {
    await api.auth.requestCode(TEST_PHONE);
    const r = await api.auth.verifyCode(TEST_PHONE, TEST_CODE);
    expect(r.token).toEqual(expect.any(String));
    expect(r.token.length).toBeGreaterThan(0);
    expect(r.user.id).toBeTruthy();
    expect(typeof r.isNew).toBe('boolean');
  });
  it.each(['1111', '0001', '', '00000', 'abcd'])('code %p is rejected', async (code) => {
    await api.auth.requestCode(TEST_PHONE);
    const e = await expectApiError(api.auth.verifyCode(TEST_PHONE, code));
    expect(['validation', 'unauthorized']).toContain(e.code);
  });
});

describeContract('CatalogApi contract', () => {
  let api: Api;
  beforeAll(async () => { api = makeApi(); await api.director.reset(); });

  it('menu has ≥120 dishes with unique ids', async () => {
    const m = await api.catalog.getMenu();
    expect(m.dishes.length).toBeGreaterThanOrEqual(120);
    expect(new Set(m.dishes.map((d) => d.id)).size).toBe(m.dishes.length);
  });
  it('every dish references a valid category, has an image, price and taste in 0..1', async () => {
    const m = await api.catalog.getMenu();
    const cats = new Set(m.categories.map((c) => c.id));
    const bad = m.dishes.filter((d) => !cats.has(d.categoryId) || !d.image || !(d.price > 0) || !d.name);
    expect(bad.map((d) => d.id)).toEqual([]);
    for (const d of m.dishes) for (const v of Object.values(d.taste)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('every category has at least one dish', async () => {
    const m = await api.catalog.getMenu();
    const empty = m.categories.filter((c) => !m.dishes.some((d) => d.categoryId === c.id));
    expect(empty.map((c) => c.id)).toEqual([]);
  });
  it('references are consistent: modifiers, pairsWith, stop-list, wheel prizes', async () => {
    const m = await api.catalog.getMenu();
    const ids = new Set(m.dishes.map((d) => d.id));
    const mods = new Set(m.modifiers.map((g) => g.id));
    expect(m.dishes.flatMap((d) => d.modifierGroupIds.filter((g) => !mods.has(g)).map((g) => `${d.id}→${g}`))).toEqual([]);
    expect(m.dishes.flatMap((d) => d.pairsWith.filter((p) => !ids.has(p)).map((p) => `${d.id}→${p}`))).toEqual([]);
    expect(m.stopList.filter((s) => !ids.has(s))).toEqual([]);
    expect(WHEEL_PRIZES.filter((p) => p.dishId && !ids.has(p.dishId)).map((p) => p.dishId)).toEqual([]);
  });
  it('promos: list non-empty, a listed code validates, a bogus code is rejected', async () => {
    const promos = await api.catalog.getPromos();
    expect(promos.length).toBeGreaterThan(0);
    const p = promos[0];
    const minTotal = 'minTotal' in p.mechanic ? (p.mechanic.minTotal ?? 0) : 0;
    await expect(api.catalog.validatePromo(p.code, minTotal + 10000)).resolves.toMatchObject({ code: p.code });
    await expectApiError(api.catalog.validatePromo('NO-SUCH-CODE-42', 10000));
  });
  it('reviews for a dish are returned as an array', async () => {
    const m = await api.catalog.getMenu();
    const r = await api.catalog.getReviews(m.dishes[0].id);
    expect(Array.isArray(r)).toBe(true);
  });
  it('geo: city centre is inside the delivery zone', async () => {
    const z = await api.geo.checkZone(SPB_CENTER);
    expect(z.inZone).toBe(true);
    expect(z.etaMinutes[0]).toBeLessThanOrEqual(z.etaMinutes[1]);
  });
});

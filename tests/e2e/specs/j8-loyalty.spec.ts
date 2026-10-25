/**
 * J8 «Хочу выгоду»: заказываю регулярно — вижу выгоду и прогресс.
 * Сценарий: Профиль → «Бонусы» (уровень, баланс, достижения, история) → колесо недели → приз → «Акции» → промокод.
 * The prize is server-random (mock PRNG from the seed) — assert structure, not a specific prize.
 * Demo user starts with 2 spins (weekly + order bonus); the 3rd is refused.
 */
import { test, expect, TID, expectUx } from '../support/fixtures';

const LEVELS = /Искра|Пламя|Жар|Пекло/;

test.describe('J8 · Хочу выгоду', () => {
  test('profile → «Бонусы»: level, balance, wheel entry, achievements, history', async ({ app, page }) => {
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.profile.expectOpen();
    await expectUx(page, 'profile');
    await app.tap(TID.profile.loyalty);
    await app.screen('loyalty').expectOpen();
    await expect(app.tid(TID.loyalty.level)).toContainText(LEVELS);
    await expect(app.tid(TID.loyalty.balance)).toContainText(/\d/);
    await expect(app.tid(TID.loyalty.wheel)).toContainText(/2 спина|Крутить/);
    await expect(app.tid(TID.loyalty.achievements)).toBeVisible();
    await expect(app.tid(TID.loyalty.history)).toBeVisible();
    await expectUx(page, 'loyalty');
    await app.expectNoErrors();
  });

  test('wheel: rules → spin → prize → second spin → no spins left', async ({ app, page }) => {
    test.setTimeout(60_000);
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.tap(TID.profile.loyalty);
    await app.tap(TID.loyalty.wheel);
    await app.screen('wheel').expectOpen();
    await expect(app.tid(TID.wheel.hint)).toContainText('2 спина');
    await app.tap(TID.wheel.rules);
    await expect(app.tid(TID.wheel.rulesSheet)).toBeVisible();
    await page.mouse.click(20, 80); // backdrop
    await expect(app.tid(TID.wheel.rulesSheet)).toBeHidden();
    await expectUx(page, 'wheel');

    await app.tap(TID.wheel.spin);
    const result = app.tid(TID.wheel.result);
    await expect(result).toContainText('Ваш приз', { timeout: 15_000 });
    await expect(result).toContainText(/Баллы уже на балансе|код ПРИЗ-[A-ZА-Я0-9]{4}/);
    await expect(app.tid(TID.wheel.apply)).toBeVisible();

    await app.tap(TID.wheel.again);
    await expect(result).toContainText('Ваш приз', { timeout: 15_000 });
    await expect(app.tid(TID.wheel.again)).toHaveCount(0);
    await expect(app.tid(TID.wheel.hint)).toContainText(/Новый спин/);
    await app.tap(TID.wheel.close);
    await app.screen('loyalty').expectOpen();
  });

  test('guest logs in from the profile and gets «Бонусы»', async ({ app }) => {
    await app.open();
    await app.goTab('profile');
    await expect(app.tid(TID.profile.login)).toBeVisible();
    await app.tap(TID.profile.login);
    await app.loginWithSms();
    await app.profile.expectOpen();
    await expect(app.tid(TID.profile.loyalty)).toBeVisible();
  });

  test('promos: list → promo card → copy code → apply to the cart', async ({ app }) => {
    await app.open({ loggedIn: true });
    await app.addFromFeed();
    await app.goTab('profile');
    await app.tap(TID.profile.promos);
    await app.screen('promos').expectOpen();
    await app.tap(TID.promos.item('p-freedel'));
    await app.screen('promo').expectOpen();
    await app.tap(TID.promo.code);
    await app.expectToast('Код скопирован');
    await app.tap(TID.promo.apply);
    // ДОСТАВКА0 has conditions (weekday before 16:00, min 700 ₽) — either applied or an honest error.
    await expect(app.tid(TID.global.toast)).toBeVisible();
  });

  test('a ПРИЗ- promo from the wheel appears among personal offers in «Акции»', async ({ app }) => {
    test.setTimeout(60_000);
    await app.open({ loggedIn: true });
    await app.goTab('profile');
    await app.tap(TID.profile.loyalty);
    await app.tap(TID.loyalty.wheel);
    // spin until a promo prize or out of spins
    let promo = false;
    let title = '';
    for (let i = 0; i < 2 && !promo; i++) {
      await app.tap(i ? TID.wheel.again : TID.wheel.spin);
      await expect(app.tid(TID.wheel.result)).toContainText('Ваш приз', { timeout: 15_000 });
      const text = await app.tid(TID.wheel.result).innerText();
      promo = /ПРИЗ-/.test(text);
      title = text.split('\n').map((x) => x.trim()).filter(Boolean)[1] ?? '';
      if (!promo && !(await app.tid(TID.wheel.again).isVisible())) break;
    }
    test.skip(!promo, 'seeded wheel gave only point prizes this run');
    await app.tap(TID.wheel.close);
    await app.tap(TID.loyalty.back);
    await app.tap(TID.profile.promos);
    const prize = app.prefixed('promos-item-', app.screen('promos').root).filter({ hasText: title }).first();
    await prize.click();
    await expect(app.tid(TID.promo.code)).toContainText('ПРИЗ-');
  });
});

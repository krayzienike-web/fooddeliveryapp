# Тестирование ЖАР

Три слоя: **domain/unit** («бэк», Jest) → **contract** (mock-бэкенд через `Api`, Jest) → **E2E/UX/UI** (Playwright по веб-экспорту, Pixel 7 412×915, ru-RU, Europe/Moscow).

## Запуск

| Команда | Что делает |
|---|---|
| `npm test` | Jest: `tests/unit/**`, `tests/contract/**`, `src/**/__tests__/**` |
| `npm run test:watch` | то же в watch-режиме |
| `npm run e2e` | собирает `dist/` (если его нет) через `expo export --platform web`, раздаёт `python3 -m http.server` на :4173, гоняет `tests/e2e/specs` |
| `E2E_REBUILD=1 npm run e2e` | принудительно пересобрать `dist/` перед прогоном |
| `E2E_BASE_URL=http://localhost:8081 npm run e2e` | прогон против уже поднятого сервера (например, `npx expo start --web`) |
| `npm run e2e:update` | перезаписать эталонные скриншоты (`tests/e2e/__screenshots__`) |
| `npx playwright test j4` | один сценарий; `--headed`/`--debug`/`--ui` для отладки |
| `npx tsc --noEmit` | тайпчек проекта, включая тесты |

Chromium уже лежит в `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`). **Никогда** не запускайте `playwright install`. Версия `@playwright/test` (1.63.0) зафиксирована под этот браузер; при обновлении меняйте обе вместе.

Отчёты и трейсы лежат в `tests/e2e/.artifacts/` (в git не попадают). Открыть отчёт: `npx playwright show-report tests/e2e/.artifacts/report`.

## Структура

```
jest.config.js            babel-jest + babel-preset-expo, алиас @/ → src/, TZ=Europe/Moscow
playwright.config.ts      Pixel 7 412×915, ru-RU, reducedMotion, webServer = dist/
tests/
  fixtures/index.ts       типизированные фабрики: makeDish, makeOrder, makeLine, makePromo, makeProfile, makeIncident, makeTotalsInput, at()
  jest-globals.d.ts       типы Jest и Node для tsc
  unit/                   чистая логика из entities/*/model и features/*/model
  contract/               контракт Api: harness.ts + *.contract.test.ts (включаются, когда появится src/services/mock/index.ts)
  e2e/
    support/testids.ts    реестр testID (единый источник правды)
    support/app.ts        App-драйвер, page objects (Screen) и переиспользуемые флоу (loginWithSms, checkoutAndPay, openDirector…)
    support/ux.ts         UX-эвристики (expectGoodUx / collectUxViolations)
    support/visual.ts     визуальная регрессия (expectScreen)
    support/fixtures.ts   `test`/`expect` с фикстурой `app` — спеки импортируют отсюда
    specs/smoke.spec.ts           всегда включён: приложение грузится без ошибок, нет горизонтального переполнения
    specs/ux-checker.spec.ts      самотест UX-чекера на синтетической разметке
    specs/j1…j9-*.spec.ts         Job Stories из docs/job-stories.md (пока `test.fixme`)
    specs/screens.visual.spec.ts  эталон для каждого экрана: UX + скриншот (`test.fixme`, пока нет экранов)
    __screenshots__/              эталонные скриншоты (коммитятся)
```

### Правила для unit-тестов
- Данные собираем только фабриками из `tests/fixtures`. **Seed** (`src/mocks/seed`) в unit-тестах не используем: он меняется. Проверки самого seed идут в contract-тестах через `Api`.
- Время локальное (Moscow): `at(2026, 10, 23, 19, 30)` — пятница.
- Найден баг, а чинить сейчас нельзя: тест оставляем, помечаем `test.failing(...)` и пишем рядом комментарий `// BUG (file: function): input → expected vs actual`. После фикса Jest упадёт с «failing test passed» — тогда меняем `test.failing` на `it`.

### Contract-тесты
`tests/contract/harness.ts` проверяет, есть ли `src/services/mock/index.ts`. Пока его нет, все наборы зарегистрированы через `describe.skip` (плюс один `test.todo`). Ожидаемая фабрика:

```ts
export function createApi(opts?: { latencyMs?: number; seed?: number }): Api;
```

Требования к моку, которые проверяют тесты: `director.reset()` возвращает чистое состояние; `director.setSpeed(600)` проводит заказ по всему флоу примерно за 30 с реального времени; `orders.subscribe` пушит обновления статуса и инцидентов; ошибки — это `ApiError` (`{ code, message }`), например `not_found` для неизвестного заказа и `conflict` при двойном бронировании стола; `director.triggerIncident` возвращает `null`, когда упирается в лимит из 2 сообщений (кроме `payment_failed`).

## Соглашение о testID

`testID` в kebab-case по схеме `screen-element[-qualifier]`. react-native-web выводит его как `data-testid`.

| Шаблон | Смысл |
|---|---|
| `<screen>-screen` | корневой контейнер экрана (по нему e2e ждут навигацию) |
| `<screen>-primary-cta` | **единственное** главное действие экрана. UX-чекер падает, если видно больше одного |
| `<screen>-<element>-<id>` | элемент списка; `<id>` — id сущности, приведённый через `kebab()`: `19:00` → `19-00`, `kitchen_delay` → `kitchen-delay` |
| `*-live` | меняющийся во времени контент (таймеры, карта, видео, ETA): маскируется на скриншотах |
| `*-title`, `*-price`, `*-total`, `*-text` | текст, у которого проверяется контраст. Любой другой текст можно пометить `dataSet={{ uxContrast: '1' }}` |

Неактивные варианты (занятый стол и т. п.) получают `aria-disabled="true"` (`accessibilityState={{ disabled: true }}`). Выбранные вкладки и переключатели — `aria-selected` (`accessibilityState={{ selected }}`).

### testID по экранам (источник — `tests/e2e/support/testids.ts`)

- **Глобальные:** `tabbar-home`, `tabbar-menu`, `tabbar-assistant`, `tabbar-restaurants`, `tabbar-profile`, `cart-bar`, `cart-bar-total`, `cart-bar-open`, `order-capsule`, `order-capsule-status`, `toast`, `header-back`
- **onboarding:** `onboarding-screen`, `onboarding-option-<axis|dishId>`, `onboarding-progress`, `onboarding-skip`, `onboarding-primary-cta`
- **home:** `home-screen`, `home-mode-delivery`, `home-mode-pickup`, `home-address`, `home-search`, `home-for-you-list`, `home-dish-card-<dishId>`, `home-dish-add-<dishId>`, `home-dish-why-<dishId>`, `home-category-<categoryId>`, `home-promo-<promoId>`, `home-reels-entry`, `home-prediction-card`, `home-prediction-why`, `home-prediction-mute`, `home-prediction-cta`
- **reels:** `reels-screen`, `reels-item-<dishId>`, `reels-video-live`, `reels-like`, `reels-dislike`, `reels-primary-cta`, `reels-close`
- **menu:** `menu-screen`, `menu-category-tab-<categoryId>`, `menu-dish-card-<dishId>`, `menu-dish-add-<dishId>`
- **search:** `search-screen`, `search-input`, `search-result-<dishId>`, `search-did-you-mean`, `search-empty`
- **dish:** `dish-screen`, `dish-title`, `dish-price`, `dish-option-<optionId>`, `dish-remove-ingredient-<ingredientId>`, `dish-qty-inc`, `dish-qty-dec`, `dish-qty`, `dish-primary-cta`, `dish-close`
- **cart:** `cart-screen`, `cart-line-<dishId>`, `cart-line-inc-<dishId>`, `cart-line-dec-<dishId>`, `cart-promo-input`, `cart-promo-apply`, `cart-promo-error`, `cart-to-free-delivery`, `cart-total`, `cart-group-invite`, `cart-group-member-<memberId>`, `cart-empty`, `cart-primary-cta`
- **auth:** `auth-screen`, `auth-phone-input`, `auth-code-input`, `auth-code-error`, `auth-resend`, `auth-primary-cta`
- **checkout:** `checkout-screen`, `checkout-mode-delivery`, `checkout-mode-pickup`, `checkout-address`, `checkout-restaurant-<restaurantId>`, `checkout-time-asap`, `checkout-payment-<card|sbp|gpay|cash|card-courier|split>`, `checkout-points-toggle`, `checkout-tips-<amount>`, `checkout-total`, `checkout-primary-cta`
- **order:** `order-screen`, `order-status-title`, `order-progress`, `order-eta-live`, `order-kitchen-live`, `order-chef`, `order-courier-map-live`, `order-courier`, `order-incident-card`, `order-incident-resolution-<resolutionId>`, `order-compensation`, `order-cancel`, `order-pickup-arriving`, `order-pickup-shelf`, `order-rate-star-<1..5>`, `order-primary-cta`
- **wheel:** `wheel-screen`, `wheel-primary-cta`, `wheel-result`, `wheel-close`
- **assistant:** `assistant-screen`, `assistant-input`, `assistant-send`, `assistant-mic`, `assistant-message-<n>`, `assistant-suggestion-<dishId>`, `assistant-chip-<n>`, `assistant-primary-cta`
- **restaurants / restaurant:** `restaurants-screen`, `restaurants-map`, `restaurants-item-<restaurantId>`, `restaurant-screen`, `restaurant-primary-cta` (забронировать), `restaurant-banquet`, `restaurant-pickup`
- **booking:** `booking-screen`, `booking-date-<yyyy-mm-dd>`, `booking-guests-inc`, `booking-guests-dec`, `booking-floor-plan`, `booking-table-<tableId>`, `booking-time-<hh-mm>`, `booking-preorder-add-<dishId>`, `booking-primary-cta`, `booking-confirmation`
- **banquet:** `banquet-screen`, `banquet-guests-slider`, `banquet-budget-slider`, `banquet-format-<banquet|buffet|catering>`, `banquet-generate`, `banquet-menu-item-<dishId>`, `banquet-total`, `banquet-primary-cta`, `banquet-sent`
- **profile:** `profile-screen`, `profile-level`, `profile-progress-ring`, `profile-points`, `profile-achievements`, `profile-achievement-<id>`, `profile-history`, `profile-login`, `profile-director`
- **director (D0):** `director-screen`, `director-incident-<kind>` (например, `director-incident-kitchen-delay`), `director-speed-<x>`, `director-weather-<kind>`, `director-reset`, `director-close`

### E2E-хуки в приложении
До загрузки бандла `App.open()` кладёт в `window.__ZHAR_E2E__` объект `{ seed, speed, skipOnboarding, loggedIn, reducedMotion, persist }`. Приложение читает его один раз при старте и делает следующее:
- `seed` задаёт детерминированный mock и рекомендации; ИИ-ассистент отвечает оффлайн-заготовками;
- `speed` передаётся в `director.setSpeed`;
- `skipOnboarding`/`loggedIn` дают стартовое состояние (демо-пользователь с историей, в которой ≥ 3 пятничных вечерних заказа, — это нужно для J2);
- `reducedMotion` останавливает бесконечные анимации Reanimated и Lottie;
- `persist: false` отключает чтение и запись AsyncStorage.

Часы задаёт `page.clock.install` (например, «пятница 19:30» для J2).

## UX- и UI-проверки
- `await expectGoodUx(page, { screen: 'cart' })` — soft-ассерт. Проверяет: ≤ 1 видимой `*-primary-cta`; тап-цели ≥ 48×48 dp; нет горизонтального переполнения (горизонтальные скроллеры не считаются); контраст по WCAG (4.5 для обычного текста, 3 для крупного) у помеченного текста; у каждого интерактивного элемента есть testID. Исключение задаётся через `dataSet={{ uxIgnore: 'tap' }}` (или `contrast`, `overflow`, `testIds`, `primaryCta`, `all`) либо через опцию `ignore: [selector]`. Например, карта — сторонний виджет.
- `await expectScreen(page, 'j4-order-cooking')` — `toHaveScreenshot` с `maxDiffPixelRatio: 0.02` и `threshold: 0.2`. CSS-анимации отключены, `*-live` и `<video>` замаскированы. Эталоны лежат в `tests/e2e/__screenshots__/<spec>/<name>.png`.

## Чек-лист: сценарий или экран изменился

1. **Job Story поменялась** (`docs/job-stories.md`): обновите шапку-комментарий и шаги в `tests/e2e/specs/jN-*.spec.ts`. Новая история — новый файл `jN-<slug>.spec.ts` по образцу.
2. **testID добавили, переименовали или удалили:** сначала правится `tests/e2e/support/testids.ts`, потом список выше. Спеки обращаются к `TID.*`, поэтому чаще всего этого достаточно.
3. **Изменился флоу, общий для нескольких историй** (логин, оформление, директор): правьте метод в `support/app.ts` (`loginWithSms`, `checkoutAndPay`, `openDirector`), а не каждую спеку.
4. **Изменилось бизнес-правило** (цены, пороги, лимиты, лестница компенсаций): в том же изменении обновите `tests/unit/<module>.test.ts`. Константы (`PRICING`, `LOYALTY_LEVELS`, `MAX_PROACTIVE_MESSAGES_PER_ORDER`) импортируйте, а не копируйте.
5. **Изменился контракт `Api`** (`src/services/contracts.ts`): обновите `tests/contract/*` и требования к моку в этом документе.
6. **Новый экран:** добавьте его в `SCREENS` в `screens.visual.spec.ts`, запустите `npm run e2e:update`, проверьте новый PNG глазами и закоммитьте.
7. **Намеренно изменился дизайн:** `npm run e2e:update -- <spec>`, просмотрите diff PNG в ревью. «Обновить всё вслепую» нельзя.
8. **Экран готов:** снимите `test.fixme` с соответствующих тестов и убедитесь, что `npm run e2e` зелёный.
9. **Баг исправлен:** замените `test.failing` на `it` и удалите комментарий `BUG`.
10. Перед коммитом: `npx tsc --noEmit && npm test` (+ `npm run e2e`, если трогали UI).

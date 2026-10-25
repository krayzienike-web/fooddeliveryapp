# Тестирование ЖАР

Три слоя: **domain/unit** («бэк», Jest) → **contract** (mock-бэкенд через `Api` + реестр testID, Jest) → **E2E/UX/UI** (Playwright по веб-экспорту, Pixel 7 412×915, ru-RU, Europe/Moscow, тёмная тема, reduced motion).

Сейчас: **Jest 609** (unit 287 в `tests/unit` и `src/**/__tests__`, contract 322, из них 289 — сверка реестра testID с `src`); **Playwright 122**: 65 сценарных тестов, 32 эталонных экрана (UX + скриншот), 13 «известных UX-долгов», 12 smoke/самотестов UX-чекера. Явно помечены: 5 `test.fail` (баги), 2 `test.fixme`, 1 `test.failing` в Jest.

## Запуск

| Команда | Что делает |
|---|---|
| `npm test` | Jest: `tests/unit/**`, `tests/contract/**`, `src/**/__tests__/**` |
| `npm run test:watch` | то же в watch-режиме |
| `npm run e2e` | собирает `dist/` (если его нет) через `expo export --platform web`, раздаёт `python3 -m http.server` на :4173, гоняет `tests/e2e/specs` |
| `E2E_REBUILD=1 npm run e2e` | принудительно пересобрать `dist/` перед прогоном (нужно после любых правок в `src/`) |
| `E2E_BASE_URL=http://localhost:8081 npm run e2e` | прогон против уже поднятого сервера. Порт 8081 часто занят чужим `expo start` — не убивайте его, работайте через `dist/` |
| `npm run e2e:update` | перезаписать эталонные скриншоты (`tests/e2e/__screenshots__`) |
| `npx playwright test j4` | один файл; `-g "текст"` — один тест; `--headed`/`--debug`/`--ui` для отладки |
| `npx tsc --noEmit` | тайпчек проекта, включая тесты |

**Браузер.** Локально Chromium уже лежит в `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`). **Никогда** не запускайте `playwright install` локально. Версия `@playwright/test` (1.63.0) зафиксирована под этот браузер; обновляйте их вместе. В CI браузер ставится командой `npx playwright install --with-deps chromium`.

Если на :4173 уже работает сервер, Playwright использует его (`reuseExistingServer`), и `E2E_REBUILD` не сработает: сначала остановите старый сервер.

Отчёты и трейсы лежат в `tests/e2e/.artifacts/` (в git не попадают). Открыть отчёт: `npx playwright show-report tests/e2e/.artifacts/report`.

## CI (`.github/workflows/ci.yml`)

Запускается на каждый push и pull request: `npm ci` → `npx tsc --noEmit` → `npm test -- --ci` → `npx expo export --platform web` → `npx playwright install --with-deps chromium` → `npm run e2e`. Если что-то упало, HTML-отчёт и трейсы загружаются артефактом `playwright-report`. В CI действуют `retries: 1`, `workers: 2` и `forbidOnly`. Эталоны снимались в Linux на том же Chromium. Шрифты приложение грузит само, поэтому допуска `maxDiffPixelRatio: 0.02` хватает. Если CI стабильно расходится с эталоном только по сглаживанию, пересоберите эталоны из отчёта CI. Поднимать допуск не нужно.

## Структура

```
jest.config.js            babel-jest + babel-preset-expo, алиас @/ → src/, TZ=Europe/Moscow
playwright.config.ts      Pixel 7 412×915, ru-RU, reducedMotion, webServer = dist/
.github/workflows/ci.yml  tsc → jest → web export → playwright (Chromium), отчёт артефактом при падении
tests/
  fixtures/index.ts       фабрики: makeDish, makeOrder, makeLine, makePromo, makeProfile, makeIncident, makeModifierGroup, makeTotalsInput, at()
  unit/                   чистая логика: pricing, lifecycle, incidents, loyalty, predictions, recommendations, search, ai-assistant,
                          format (₽, телефон, даты), cart-store (zustand), director/defaultOptions/achievements
  contract/               Api мока (orders, booking, catalog-auth, loyalty-table) + testids.contract (реестр ↔ src)
  e2e/
    support/testids.ts    реестр testID (единый источник правды; блок `planned` — только для заглушек)
    support/app.ts        App-драйвер, page objects (Screen), флоу: addFromFeed, openCart, loginWithSms, checkoutAndPay,
                          placeOrder, slideToPay, swipe/touchTap (жесты), openDirector, triggerIncident, expectToast…
    support/known-issues.ts  известные UX-долги приложения (исключаются из expectUx, у каждого есть test.fail)
    support/ux.ts         UX-эвристики (expectGoodUx / collectUxViolations, опция scope)
    support/visual.ts     expectScreen, settle, waitForStill
    support/fixtures.ts   `test`/`expect` с фикстурой `app`, expectUx(page, screen), FRIDAY_EVENING, SUNDAY_NOON
    specs/                j1…j9 (Job Stories), a1 каталог/корзина, b1 Шеф ИИ, b2 Reels, c13 оценка+поддержка,
                          c17 QR-стол, c18 подарок, p1 профиль/настройки, screens.visual, smoke, ux-checker
    __screenshots__/      эталонные скриншоты (коммитятся)
```

## Матрица покрытия

| Story / экран | Spec | Статус |
|---|---|---|
| J1 Голоден сейчас: онбординг (свайп + кнопки) → радар → «почему» в ленте → Reels «+» → SMS 0000 → slide-to-pay | `j1-hungry-now` | ✅ 3 теста |
| J2 Повторяю любимое: пятница 19:30 → «Как обычно» → «Почему?» → «Повторить», «Не предлагать», полоса «Повторить» | `j2-repeat-favorite` | ✅ 3 · ❌ `test.fail`: гость видит чужую историю |
| J3 Компания: ИИ «нас 4, бюджет 4000…» → «Добавить всё»; групповая корзина, друзья, «Поровну» | `j3-group-order` | ✅ 2 |
| J4 Жду заказ: живая кухня, капсула на вкладках, курьер на карте, «Доставлен», звёзды, колесо | `j4-track-order` | ✅ 3 · ⏸ `fixme`: нет кнопки «Отменить заказ» |
| J5 Иду в ресторан: список/карта → ресторан → дата/гости/19:00 → автостол/схема → повод → предзаказ → SMS → подтверждение → календарь; >12 гостей → банкет | `j5-book-table` | ✅ 5 |
| J6 Событие: ползунки, формат, зал, меню ИИ, «Другое», SMS → «отправлено менеджеру»; выездной без зала | `j6-banquet` | ✅ 3 |
| J7 Инцидент через панель режиссёра: задержка → баллы на балансе, замена, отмена, лимит 2 сообщения, оплата вне лимита | `j7-incident` | ✅ 6 |
| J8 Выгода: «Бонусы» (уровень, баланс, достижения, история), колесо (2 спина → нет), приз ПРИЗ-… в «Акциях», промокод | `j8-loyalty` | ✅ 5 |
| J9 Самовывоз: −10 %, ресторан в оформлении, «Я подхожу» → полка → «Я на месте» → выдан | `j9-pickup` | ✅ 1 |
| A1 Меню, фильтры, блюдо (модификаторы, живая цена), корзина (qty, промокод, апселл, очистка), поиск, адрес | `a1-catalog-cart` | ✅ 5 · ❌ `test.fail`: «пицца» не находит пиццы |
| B1 Шеф ИИ: стартер → карточка → «Добавить всё» → корзина; «Дешевле», «Добавить десерт»; бронь; банкет; поиск → «Спросить у Шефа ИИ»; «Где мой заказ?» | `b1-assistant` | ✅ 7 |
| B2 Reels: видео/постер, лайк, «+», бейдж, карточка блюда | `b2-reels` | ✅ 1 · ❌ `test.fail`: лента открывается в конце · ⏸ `fixme`: свайп к следующему |
| C13 Оценка (5★ ИИ-фото, ≤3★ → поддержка) · A18 Поддержка (возврат баллами, опоздание, оператор) | `c13-rate-support` | ✅ 5 · ❌ `test.fail`: поле ввода выходит за экран |
| C17 За столом (QR): скан, дозаказ, официант, «Поровну»/«Моё», чаевые, оплата, вход | `c17-qr-table` | ✅ 3 |
| C18 Подарок: дизайн, сумма, валидация имени и телефона, отправка, код, вход | `c18-gift` | ✅ 2 |
| Профиль и настройки: заказы → повтор, брони, избранное, тема, диета, персонализация, удаление в 2 шага, выход | `p1-profile-settings` | ✅ 6 |
| Эталон экрана (UX + скриншот): onboarding, home ×2, menu, search ×2, dish, cart ×2, group-cart, auth, checkout, order, orders, address, assistant ×2, restaurants, restaurant, booking, banquet, qr-menu, gift, profile ×2, loyalty, wheel, promos, support, settings, director | `screens.visual` | ✅ 32 + 13 `test.fail` (UX-долги) |
| Reels, rate, promo (модалка) — эталона нет: Reels открывается в сломанном состоянии, у rate и promo медленный сетап (rate покрыт в c13) | — | — |
| AR | — | заглушка, тестов нет |
| Pure-логика `features/*/model`, `entities/*/model`, `shared/lib/format` | `tests/unit/*`, `src/**/__tests__` | ✅ |
| Контракт Api: orders, booking, catalog/auth, loyalty, table, gifts (+ `src/features/table` и `loyalty`) | `tests/contract/*` | ✅ |
| Реестр testID ↔ `src` | `tests/contract/testids.contract.test.ts` | ✅ 289 |

## Правила для unit-тестов
- Данные собираем только фабриками из `tests/fixtures`. **Seed** (`src/mocks/seed`) в unit-тестах не используем: он меняется. Проверки самого seed идут в contract-тестах через `Api`.
- Время локальное (Moscow): `at(2026, 10, 23, 19, 30)` — пятница. Для логики, которая читает «сейчас», используйте `jest.useFakeTimers()` + `jest.setSystemTime()`.
- Zustand-сторы можно тестировать напрямую (`useCart.getState()`). AsyncStorage подменяем официальным моком: `jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))`.
- Не дублируйте тесты, которые лежат рядом с кодом (`src/features/{booking,loyalty,table}/model/__tests__`), и `tests/unit/ai-assistant.test.ts`.
- Найден баг, а чинить сейчас нельзя: тест оставляем, помечаем `test.failing(...)` и пишем рядом комментарий `// BUG (file: function): input → expected vs actual`. После фикса Jest упадёт с «failing test passed», и тогда `test.failing` меняем на `it`.

### Contract-тесты
`tests/contract/harness.ts`: `makeApi()` создаёт `createApi({ latencyMs: 0, seed: 1 })`, есть `describeContract`, `expectApiError`, `waitFor`. Каждый файл создаёт свежий api и вызывает `director.reset()`. Требования к моку: `director.reset()` возвращает чистое состояние; `director.setSpeed(600)` проводит заказ по всему флоу примерно за 30 с; `orders.subscribe` пушит обновления; ошибки — `ApiError` (`{ code, message }`); `director.triggerIncident` возвращает `null`, когда упирается в лимит из 2 сообщений (кроме `payment_failed`); `loyalty.spin` возвращает `conflict`, когда спинов нет; заказ от 1500 ₽ даёт бонусный спин; призы, кроме баллов, становятся персональными промокодами `ПРИЗ-XXXX`.

## Соглашение о testID

`testID` в kebab-case по схеме `screen-element[-qualifier]`. react-native-web выводит его как `data-testid`. Источник правды — `tests/e2e/support/testids.ts`, `TID.<screen>.<element>`. `tests/contract/testids.contract.test.ts` проверяет, что каждый литерал из реестра есть в `src`.

| Шаблон | Смысл |
|---|---|
| `<screen>-screen` | корневой контейнер экрана (по нему e2e ждут навигацию) |
| `<screen>-primary-cta` | **единственное** главное действие экрана. UX-чекер падает, если видно больше одного. Исключения в приложении: `restaurant-book`, `booking-submit`, `banquet-send`, `gift-send`, `qr-pay` |
| `<screen>-<element>-<id>` | элемент списка. id сущности берётся **как есть**: `dish-card-pz-pepperoni`, `director-incident-kitchen_delay`, `checkout-payment-card_courier`, `booking-slot-1900`, `booking-table-B2` |
| `<id>-inc` / `<id>-dec` | кнопки общего `Stepper` (`dish-qty-inc`, `cart-qty-<dishId>-inc`, `booking-guests-inc`) |
| `<id>-<option>` | сегменты общего `Segmented` (`home-mode-pickup`, `restaurants-view-map`, `qr-split-mode-equal`) |
| `<id>-back` | «Назад» общего `Header`. Если у Header нет своего testID, кнопка называется `header-back` |
| `*-live` | меняющийся во времени контент (ETA, живая кухня, карта курьера). На скриншотах маскируется |
| `*-title`, `*-price`, `*-total`, `*-text` | текст, у которого проверяется контраст |

Особенности, о которые легко споткнуться:
- `DishCard` используется на главной, в меню и в поиске, поэтому `dish-card-*`, `dish-add-*`, `dish-qty-*` и `dish-why-*` повторяются. Ищите их внутри корня экрана: `app.menu.root.getByTestId(...)`. Лента главной называется `for-you-list`, без префикса `home-`.
- Карточка-предсказание на главной имеет id `prediction-card`, `prediction-why`, `prediction-mute`, `prediction-cta`.
- Reels: каждый отрисованный ролик повторяет `reels-like`, `reels-add` и т. д. Берите `.first()`.
- Панель режиссёра — это Sheet `director-panel`. Открывается тройным тапом по `home-logo`. Кнопки закрытия нет, закрывают тапом по фону (`app.closeDirector()`).
- Состояние «выбрано» не выводится как `aria-selected` (RN-web так не делает для `role=button`). Проверяйте результат (текст, сумма), а не атрибут. Отключённые элементы получают `aria-disabled="true"`.

## E2E: как устроены тесты

**Флаги.** `App.open(flags, { now })` кладёт `window.__ZHAR_E2E__` до загрузки бандла (`src/shared/config/env.ts`). Набор по умолчанию: `{ seed: 1, speed: 20, skipOnboarding: true, loggedIn: false, reducedMotion: true, persist: false }`.
- `seed` — детерминированный PRNG мока (номера заказов, призы колеса);
- `speed` — множитель жизненного цикла заказа: при ×1 весь путь занимает около 135 с, при ×30 — несколько секунд. Для экрана «готовим» берите `speed: 1`;
- `skipOnboarding` — сразу открыть главную. Профиль вкуса при этом не настроен: подборка «Самое популярное», без пояснений «почему»;
- `loggedIn` — демо-пользователь +7 921 555-12-34 с историей заказов (пятничный ритуал) и 2 спинами колеса;
- `persist: false` — AsyncStorage не используется, каждый тест начинает с чистого состояния;
- `reducedMotion` приложение **пока не читает**. Анимации успокаивает `reducedMotion: 'reduce'` в конфиге Playwright;
- любой непустой набор флагов переключает «Шеф ИИ» на офлайн-мозг (`scripted.ts`): ответы детерминированы, перед ответом пауза около 450 мс.

**Часы.** `{ now }` вызывает `page.clock.install`: время стартует с заданного момента и идёт дальше. `FRIDAY_EVENING` (пт 23.10.2026, 19:30) нужен для J2 и эталонов. `SUNDAY_NOON` (вс 25.10, 12:00) нужен для броней: «завтра» — понедельник, и 19:00 на Невском свободно. В субботу вечером в seed всё занято, поэтому «завтра 19:00» по реальным часам падало бы по пятницам.

**DOM.** Экраны стека под верхним остаются в DOM с `display: none`, и `app.tid()` их отфильтровывает. Посещённые вкладки остаются «видимыми» за краем экрана, поэтому повторяющиеся id ищите внутри корня экрана.

**Жесты.** Пан-жесты react-native-gesture-handler (свайп онбординга, slide-to-pay, слайдеры банкета, колесо) **не реагируют на mouse drag** Playwright при профиле с `hasTouch`. Нужны CDP-тач-события с паузой в кадр: `app.swipe()`, `app.swipeTasteCard()`, `app.slideToPay()`, `app.touchTap(slider, 0.99)`.

**Ожидания.** Не используйте `waitForTimeout`. Используйте `expect(...).toBeVisible/ toHaveText`, `expect.poll` для чисел и `waitForStill(locator)`, чтобы дождаться конца анимации появления перед UX-проверкой и скриншотом. Цены пишутся с неразрывным пробелом U+00A0 (`2 396 ₽`). В регулярках пишите `\s`, а для чисел используйте `Number(text.replace(/\D/g, ''))`.

## UX- и UI-проверки
- `await expectUx(page, 'cart')` — soft-ассерт по корню `cart-screen` плюс глобальные элементы (таб-бар, корзина-бар, капсула, тосты, шиты) за вычетом известных долгов экрана из `support/known-issues.ts`. Под капотом `expectGoodUx`/`collectUxViolations`. Проверяется: не больше одной видимой `*-primary-cta`, тап-цели не меньше 48×48 dp, нет горизонтального переполнения, контраст по WCAG у помеченного текста, у каждого интерактивного элемента есть testID. Исключения в приложении: `dataSet={{ uxIgnore: 'tap' }}`. В тесте — опции `ignore: [selector]` и `scope`.
- `await expectScreen(page, name, { mask })` — `toHaveScreenshot` с `maxDiffPixelRatio: 0.02` и `threshold: 0.2`. CSS-анимации отключены. Маскируются `*-live`, `<video>`, карты, видоискатель QR и заголовок статуса заказа. Эталоны лежат в `tests/e2e/__screenshots__/<spec>/<name>.png`.
- **Известные UX-долги** (`support/known-issues.ts`). У каждого экрана с долгами есть `test.fail` в `screens.visual.spec.ts`, который гоняет эвристики без исключений. Когда приложение исправит все долги экрана, тест «неожиданно пройдёт». Тогда удалите записи из `known-issues.ts`.

## Как поддерживать тесты при новой сборке

1. **Пересоберите и прогоните:** `E2E_REBUILD=1 npm run e2e`. Сначала смотрите на `testids.contract`: `npm test` сам покажет переименованные или удалённые testID.
2. **testID добавили, переименовали или удалили:** правьте `tests/e2e/support/testids.ts`. Спеки обращаются к `TID.*`, поэтому часто этого достаточно. Если id переехал из `planned` в реальность, перенесите его из блока `planned`.
3. **Изменился общий флоу** (добавление в корзину, логин, оформление, оплата, панель режиссёра): правьте метод в `support/app.ts` (`addFromFeed`, `loginWithSms`, `checkoutAndPay`, `placeOrder`, `openDirector`), а не каждую спеку.
4. **Job Story поменялась** (`docs/job-stories.md`): обновите шапку-комментарий и шаги в `jN-*.spec.ts` и строку в матрице выше. Новая история — новый файл по образцу.
5. **Новый экран:** добавьте его в `SCREENS` в `screens.visual.spec.ts` (`ready` — элемент, который появляется последним), потом запустите `npm run e2e:update -- screens.visual -g "<name>"`, проверьте PNG глазами и закоммитьте. Добавьте сценарий в подходящую спеку и строку в матрицу.
6. **Намеренно изменился дизайн или общий layout** (шрифт, отступы, формат цен): `npm run e2e:update -- screens.visual`, затем просмотрите diff всех PNG в ревью. Обновлять «вслепую» нельзя.
7. **Новый UX-долг**, который нельзя исправить сейчас: добавьте запись в `support/known-issues.ts` с комментарием `BUG`/`NEEDS testID`. `test.fail` появится автоматически.
8. **Баг исправлен** (`test.fail` или `test.failing` «неожиданно прошёл»): замените на `test`/`it`, удалите комментарий `BUG`, запись в `known-issues.ts` и строку из матрицы.
9. **Экран перестал быть заглушкой:** снимите `test.fixme`, перенесите id из `planned` и добавьте экран в `SCREENS`.
10. **Изменилось бизнес-правило** (цены, пороги, лимиты, лестница компенсаций, спины колеса): в том же изменении обновите `tests/unit/<module>.test.ts`. Константы (`PRICING`, `LOYALTY_LEVELS`, `WHEEL_RULES`, `MAX_PROACTIVE_MESSAGES_PER_ORDER`) импортируйте, а не копируйте.
11. **Изменился контракт `Api`** (`src/services/contracts.ts`): обновите `tests/contract/*` и требования к моку в этом документе.
12. Перед коммитом выполните `npx tsc --noEmit && npm test && npm run e2e`.

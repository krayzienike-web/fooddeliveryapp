# «Шеф ИИ» — прокси к Claude API для Android-сборки

Приложение не хранит ключ Claude API: ключ из APK достаётся за минуту. Приложение шлёт запрос в этот Cloudflare Worker, Worker добавляет ключ и вызывает Claude.

```
Android-приложение ──POST {system, context, messages}──▶ Worker (ключ в секретах) ──▶ Claude API
```

Веб-сборке, опубликованной как claude.ai Artifact, прокси не нужен: там Claude отвечает через runtime артефакта, на аккаунте зрителя.

## Почему отдельный ключ

Подписка Claude (Pro/Max/Team) покрывает claude.ai и Claude Code, но **не даёт доступа к API** из вашего приложения. Для API нужен отдельный аккаунт в Claude Console с оплатой по токенам.

## Настройка (≈10 минут)

1. **Ключ API.** Откройте [console.anthropic.com](https://console.anthropic.com) → Billing (пополните баланс) → API Keys → Create Key.
   Совет: в Limits задайте месячный лимит расходов для этого workspace.
2. **Cloudflare.** Бесплатного аккаунта Cloudflare Workers достаточно.
   ```bash
   cd server/ai-proxy
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY   # вставьте ключ из шага 1
   npx wrangler secret put APP_KEY             # любая длинная строка
   npx wrangler deploy                         # выдаст URL вида https://zhar-ai-proxy.<you>.workers.dev
   ```
3. **Приложение.** В корне проекта создайте `.env` по образцу `.env.example`:
   ```
   EXPO_PUBLIC_AI_PROXY_URL=https://zhar-ai-proxy.<you>.workers.dev
   EXPO_PUBLIC_AI_APP_KEY=<та же строка, что в APP_KEY>
   ```
   Для EAS-сборки задайте те же переменные в `eas.json` (`build.<profile>.env`) или через `eas env:create`.
4. Пересоберите APK. В шапке ассистента появится «Отвечает Claude».

Без `EXPO_PUBLIC_AI_PROXY_URL` Android-сборка работает на офлайн-сценариях («Быстрые ответы»).

## Проверка

```bash
curl -s https://zhar-ai-proxy.<you>.workers.dev \
  -H 'content-type: application/json' -H 'x-app-key: <APP_KEY>' \
  -d '{"system":"Отвечай одним словом.","messages":[{"role":"user","content":"Столица России?"}]}'
```

## Модель и стоимость

- По умолчанию `claude-opus-5-5` с `effort: "low"`, чтобы ответы приходили быстро. Модель меняется в `wrangler.toml` (`MODEL`) без пересборки приложения.
- Меню (≈15 тыс. символов) — стабильная часть промпта и кэшируется (`cache_control`). Каждый ход оплачивает дешёвое чтение из кэша и короткий ответ.
- Цены смотрите на [странице тарифов](https://www.anthropic.com/pricing) и в Usage-разделе Console.
- Включён серверный fallback (`fallbacks: "default"`). Если фильтр безопасности отклонит запрос, API сам повторит его на подходящей модели.

## Защита

`APP_KEY` поставляется внутри приложения, поэтому секретом не является: он только отсекает случайный трафик. Для публичного релиза добавьте [Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/) на маршрут Worker и проверку сессии пользователя (токен из SMS-входа) вместо общего ключа.

# ЖАР — food delivery & restaurant chain demo (Saint Petersburg)

Expo SDK 58 / React Native 0.88 / React 19 / TypeScript strict. Target: **Android** (EAS build) + web build published as a claude.ai Artifact for review with an in-app comment mode.

Read `AGENTS.md` for Expo rules. Deviation: we use **React Navigation** (not Expo Router) because the web build runs inside a sandboxed iframe where URL routing is unavailable; navigation state lives in memory.

## Architecture (Feature-Sliced, top layers may import lower layers only)

```
src/
  app/        providers, navigation, root App           (imports everything below)
  screens/    one folder per screen, composes widgets/features
  widgets/    large self-contained UI blocks (DishCard feed, CartBar, OrderCapsule, CourierMap…)
  features/   user actions + their model (add-to-cart, auth-by-sms, ai-assistant, recommendations, predictions, search…)
  entities/   business entities: types (model/types.ts), PURE logic (model/*.ts), small UI (ui/)
  shared/     ui kit, theme tokens, lib (haptics, sound, format), config — no business knowledge
  services/   contracts.ts (backend API interfaces) + mock/ implementation + ai/ client
  mocks/seed/ static demo content (menu, restaurants, promos, reviews, demo user history)
```

Rules:
- Business rules are pure functions in `entities/*/model` or `features/*/model` — no React, no IO. They are unit-tested.
- UI talks to the backend only via `Api` from `src/services/contracts.ts` (obtained with `useApi()`), never imports `services/mock` directly.
- State: zustand stores in `features/*/model/store.ts` / `entities/*/model/store.ts`. Persist only session, cart, profile.
- Styling: only tokens from `src/shared/theme`. No literal colors in components.
- Every interactive element gets a `testID` (kebab-case, `screen-element`), used by e2e tests.
- Russian copy, ₽ formatting via `shared/lib/format`.

## Testing
- `npm test` — Jest unit tests for pure logic and mock backend (`__tests__` next to code or in `tests/`).
- `npm run e2e` — Playwright against the web export (`dist/`), mobile viewport, covering Job Stories (see `docs/job-stories.md`).
- Visual regression: Playwright screenshots in `tests/e2e/__screenshots__`.
- When a scenario or feature changes, update the matching tests in the same change.

## Commands
- `npx expo start --web` dev, `npx expo export --platform web` build, `npx tsc --noEmit` typecheck.

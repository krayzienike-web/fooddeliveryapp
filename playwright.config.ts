/**
 * Playwright E2E / UX / UI harness for the web export.
 *
 *   npm run e2e            build dist/ if missing, serve it, run all specs
 *   npm run e2e:update     same, re-baselining visual snapshots
 *   E2E_REBUILD=1 npm run e2e   force a fresh `expo export`
 *   E2E_BASE_URL=http://localhost:8081 npm run e2e   run against an already running server (e.g. expo start --web)
 *
 * Browsers: Chromium preinstalled in $PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers). Never run `playwright install`.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e/specs',
  outputDir: 'tests/e2e/.artifacts/results',
  snapshotPathTemplate: 'tests/e2e/__screenshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.2, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/e2e/.artifacts/report' }]],
  use: {
    ...devices['Pixel 7'],
    viewport: { width: 412, height: 915 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    geolocation: { latitude: 59.9356, longitude: 30.3256 }, // Невский, 28
    permissions: ['geolocation'],
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'pixel7-chromium' }],
  webServer: externalBaseUrl
    ? undefined
    : {
        // Build the static web export once (or on E2E_REBUILD=1), then serve dist/ (no SPA routing needed: navigation is in-memory).
        command: `sh -c '{ [ -f dist/index.html ] && [ -z "$E2E_REBUILD" ]; } || npx expo export --platform web --output-dir dist; exec python3 -m http.server ${PORT} --bind 127.0.0.1 --directory dist 2>/dev/null'`,
        url: `http://127.0.0.1:${PORT}/index.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 600_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});

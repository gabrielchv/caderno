import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// Dedicated ports: localhost:3000/3001 are commonly taken on dev machines
// (an unrelated Open WebUI already runs on 3000 here), so the suite refuses to
// reuse whatever happens to be listening.
const WEB_PORT = 3200
const REALTIME_PORT = 3201

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @caderno/realtime dev',
      cwd: root,
      port: REALTIME_PORT,
      reuseExistingServer: false,
      env: {
        PORT: String(REALTIME_PORT),
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
      },
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @caderno/web exec next dev -p ${WEB_PORT}`,
      cwd: root,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_REALTIME_URL: `http://localhost:${REALTIME_PORT}`,
      },
      timeout: 180_000,
    },
  ],
})

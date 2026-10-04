import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
  },
  // Два дев-сервера: app-режим для старых спеков и web-режим для шеринга —
  // VITE_CLIENT_MODE компилируется в бандл, поэтому режимы живут на разных портах.
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      env: { VITE_CLIENT_MODE: 'app' },
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
      env: { VITE_CLIENT_MODE: 'web', VITE_WEB_NODE_URL: 'https://eu3.privy.stream:8443', VITE_WEB_NODE_NAME: 'open.eu3' },
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'desktop-app',
      testIgnore: /share\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Шторка «Поделиться» — фича мобильного веба: ссылка, копирование, цели.
      // Pixel 7 + chrome — как в player-drag.spec: touch-события и знакомый движок.
      name: 'mobile-web',
      testMatch: /share\.spec\.ts/,
      use: { ...devices['Pixel 7'], channel: 'chrome', baseURL: 'http://127.0.0.1:4174' },
    },
  ],
});

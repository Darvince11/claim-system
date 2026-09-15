import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',
  workers:1,
  timeout:120000,
  expect:{timeout:15000},
  use:{baseURL:process.env.TEST_WEB_URL??'http://127.0.0.1:5173',trace:'retain-on-failure',browserName:'chromium',channel:process.env.PLAYWRIGHT_CHANNEL},
});

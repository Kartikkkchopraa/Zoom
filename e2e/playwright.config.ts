import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests against the real app (Next.js + FastAPI + SQLite).
 *
 * Both servers are started automatically (or reused if already running).
 * The database is reseeded once before the run (see global-setup.ts).
 * Tests share one database, so they run one at a time.
 */
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1275, height: 900 },
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "uv run uvicorn app.main:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      cwd: "../frontend",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});

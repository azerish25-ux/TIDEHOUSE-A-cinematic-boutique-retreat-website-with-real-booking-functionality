import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "evidence/playwright-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "no-preference",
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "webkit",
      testMatch: "**/release.spec.ts",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1280, height: 900 },
        reducedMotion: "no-preference",
      },
    },
    {
      name: "firefox",
      testMatch: "**/release.spec.ts",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 900 },
        reducedMotion: "no-preference",
      },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

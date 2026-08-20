import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// The suite reads the database directly for setup that has no UI.
loadEnv();

/**
 * End-to-end coverage of the flows a user actually performs.
 * Assumes a server is already running at BASE_URL (see `npm run build && npm start`).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // Most traffic to these pages is mobile, so that is what we test.
    ...devices["Pixel 7"],
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Use the Chromium already present in the image rather than letting
          // Playwright download a build matched to its own version.
          executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
        },
      },
    },
  ],
});

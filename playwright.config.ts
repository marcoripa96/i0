import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "fs";

/**
 * `next start` loads `.env.production`, whose database credentials point at the
 * real database rather than local Postgres. Read `DATABASE_URL` out of `.env`
 * and pass it explicitly — Next leaves an already-set process env var alone, so
 * this wins over the production file.
 */
function localDatabaseUrl(): string {
  const line = readFileSync(".env", "utf8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));

  if (!line) throw new Error("DATABASE_URL is not set in .env");

  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  // Instant-navigation assertions race with each other over one server.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // App shells and partial prefetching are a production-build behaviour, so
    // these run against `next start`, never the dev server.
    command: "bun run build && bun run start --port 3100",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { DATABASE_URL: localDatabaseUrl() },
  },
});

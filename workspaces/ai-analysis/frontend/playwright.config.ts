import { defineConfig } from "@playwright/test";

// Local acceptance servers must never be probed through the host HTTP proxy.
process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1", "localhost"].filter(Boolean).join(",");
process.env.no_proxy = process.env.NO_PROXY;

const e2eApiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:18000";
const e2eWebUrl = process.env.E2E_WEB_URL ?? "http://127.0.0.1:15173";
const e2eApiPort = new URL(e2eApiUrl).port || "18000";
const e2eWebPort = new URL(e2eWebUrl).port || "15173";

export default defineConfig({
  testDir: "./e2e",
  // Every spec intentionally shares one isolated SQLite runtime; serialize files to
  // keep acceptance deterministic instead of creating cross-worker write contention.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: e2eWebUrl,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `NORTHLIGHT_RUNTIME_ROOT=.runtime/e2e uv run uvicorn northlight.main:app --app-dir backend --host 127.0.0.1 --port ${e2eApiPort}`,
      cwd: "..",
      url: `${e2eApiUrl}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `VITE_API_PROXY=${e2eApiUrl} pnpm exec vite --host 127.0.0.1 --port ${e2eWebPort} --strictPort`,
      cwd: ".",
      url: e2eWebUrl,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});

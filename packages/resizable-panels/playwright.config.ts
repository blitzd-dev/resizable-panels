import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const DEMO_PORT = 5273;
const DEMO_ROOT = fileURLToPath(new URL("../../apps/demo/", import.meta.url));
// One above the demo app, so both suites can run side by side.
const HARNESS_PORT = 5274;
const useReact18 = process.env.RESIZABLE_PANELS_REACT_VERSION === "18";
const demoSpecs = [
  "**/percentage-bounds-cold-load.spec.ts",
  "**/shadcn-sidebar.spec.ts",
];
const browserBoundarySpecs = ["**/browser-boundary.spec.ts"];

export default defineConfig({
  testDir: "./e2e",
  // Confine Playwright's per-run scratch (traces/videos) to a dedicated
  // subdirectory. The default (test-results/) gets wiped on every run, which
  // destroys gitignored probe artifacts kept alongside it (R-37 Batch 4).
  outputDir: "./test-results/.pw-artifacts",
  // Files run in parallel across workers (each worker gets its own browser
  // context, so layouts don't bleed across files). Tests within a single
  // file stay sequential — keeps file-internal assumptions about layout
  // state cheap to reason about.
  fullyParallel: false,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${HARNESS_PORT}`,
    // Capture trace + video only on failure for fast local iteration.
    trace: "retain-on-failure",
    video: "retain-on-failure",
    // Animations are part of what we test; don't try to suppress them.
    actionTimeout: 5_000,
    // `PWSLOWMO=250 bun run test:e2e --headed` slows every action down so
    // you can watch the suite drive the browser by hand.
    launchOptions: {
      slowMo: process.env.PWSLOWMO ? Number(process.env.PWSLOWMO) : 0,
    },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: demoSpecs,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "firefox-boundary",
      testMatch: browserBoundarySpecs,
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "webkit-boundary",
      testMatch: browserBoundarySpecs,
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1280, height: 800 },
      },
    },
    ...(!useReact18
      ? [
          {
            name: "shadcn-demo",
            testMatch: demoSpecs,
            use: {
              ...devices["Desktop Chrome"],
              baseURL: `http://localhost:${DEMO_PORT}`,
              viewport: { width: 1440, height: 900 },
            },
          },
        ]
      : []),
  ],
  webServer: [
    // Fixture harness for the library-level matrix.
    {
      command: `vite --config e2e/vite.config.ts --port ${HARNESS_PORT} --strictPort`,
      port: HARNESS_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: "ignore",
      stderr: "pipe",
      timeout: 30_000,
    },
    // The Shadcn regression must exercise the real Tailwind composition and
    // controlled SidebarProvider, not a look-alike fixture.
    ...(!useReact18
      ? [
          {
            command: `vite --host 127.0.0.1 --port ${DEMO_PORT} --strictPort`,
            cwd: DEMO_ROOT,
            port: DEMO_PORT,
            reuseExistingServer: !process.env.CI,
            stdout: "ignore" as const,
            stderr: "pipe" as const,
            timeout: 30_000,
          },
        ]
      : []),
  ],
});

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const packageRoot = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const packageJson = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const temporaryRoot = mkdtempSync(join(tmpdir(), "resizable-panels-package-"));
const typescriptPackageRoot = dirname(
  fileURLToPath(import.meta.resolve("typescript/package.json")),
);
const typescriptExecutable = resolve(typescriptPackageRoot, "bin/tsc");
const reactMatrix = [
  { react: "react", reactDom: "react-dom", reactTypes: "@types/react" },
  {
    react: "react18",
    reactDom: "react-dom18",
    reactTypes: "@types/react18",
  },
];
// §8 recommended matrix: each React major compiled under both consumer
// module-resolution strategies against the packed declarations.
const TYPE_RESOLUTION_MODES = [
  { name: "NodeNext", module: "nodenext", moduleResolution: "nodenext" },
  { name: "bundler", module: "esnext", moduleResolution: "bundler" },
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result;
}

function packLocalPackage(packageRoot, destination) {
  mkdirSync(destination);
  run(
    npm,
    ["pack", "--ignore-scripts", "--pack-destination", destination],
    packageRoot,
  );
  const archives = readdirSync(destination).filter((file) =>
    file.endsWith(".tgz"),
  );
  if (archives.length !== 1) {
    throw new Error(
      `Expected one runtime archive in ${destination}, found ${archives.length}.`,
    );
  }
  return resolve(destination, archives[0]);
}

try {
  const archiveDirectory = resolve(temporaryRoot, "archive");
  mkdirSync(archiveDirectory);
  run(npm, ["pack", "--pack-destination", archiveDirectory], packageRoot);

  const archives = readdirSync(archiveDirectory).filter((file) =>
    file.endsWith(".tgz"),
  );
  if (archives.length !== 1) {
    throw new Error(`Expected one package archive, found ${archives.length}.`);
  }

  const archivePath = resolve(archiveDirectory, archives[0]);
  const imports = Object.keys(packageJson.exports).map((subpath) => {
    const specifier =
      subpath === "."
        ? packageJson.name
        : `${packageJson.name}/${subpath.slice(2)}`;
    const options =
      subpath === "./package.json" ? ', { with: { type: "json" } }' : "";
    return `await import(${JSON.stringify(specifier)}${options});`;
  });

  for (const { react, reactDom, reactTypes } of reactMatrix) {
    const reactPackageRoot = dirname(
      fileURLToPath(import.meta.resolve(`${react}/package.json`)),
    );
    const reactDomPackageRoot = dirname(
      fileURLToPath(import.meta.resolve(`${reactDom}/package.json`)),
    );
    const reactTypesPackageRoot = dirname(
      fileURLToPath(import.meta.resolve(`${reactTypes}/package.json`)),
    );
    const jsdomPackageRoot = dirname(
      fileURLToPath(import.meta.resolve("jsdom/package.json")),
    );
    const reactDomRequire = createRequire(
      resolve(reactDomPackageRoot, "package.json"),
    );
    const schedulerPackageRoot = dirname(
      reactDomRequire.resolve("scheduler/package.json"),
    );
    const reactVersion = JSON.parse(
      readFileSync(resolve(reactPackageRoot, "package.json"), "utf8"),
    ).version;
    const reactTypesVersion = JSON.parse(
      readFileSync(resolve(reactTypesPackageRoot, "package.json"), "utf8"),
    ).version;
    const jsdomVersion = JSON.parse(
      readFileSync(resolve(jsdomPackageRoot, "package.json"), "utf8"),
    ).version;
    if (reactTypesVersion.split(".")[0] !== reactVersion.split(".")[0]) {
      throw new Error(
        `React ${reactVersion} was paired with incompatible React typings ${reactTypesVersion}.`,
      );
    }
    const consumerDirectory = resolve(
      temporaryRoot,
      `consumer-react-${reactVersion}`,
    );
    mkdirSync(consumerDirectory);
    const runtimeArchiveDirectory = resolve(
      temporaryRoot,
      `runtime-react-${reactVersion}`,
    );
    mkdirSync(runtimeArchiveDirectory);
    const reactArchive = packLocalPackage(
      reactPackageRoot,
      resolve(runtimeArchiveDirectory, "react"),
    );
    const reactDomArchive = packLocalPackage(
      reactDomPackageRoot,
      resolve(runtimeArchiveDirectory, "react-dom"),
    );
    const schedulerArchive = packLocalPackage(
      schedulerPackageRoot,
      resolve(runtimeArchiveDirectory, "scheduler"),
    );
    writeFileSync(
      resolve(consumerDirectory, "package.json"),
      `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
    );
    // Install jsdom and @types/react from the registry (exact workspace
    // versions). Local path / npm-pack of jsdom@29 re-runs `prepare` →
    // wireit even with --ignore-scripts, which fails without that devDep.
    run(
      npm,
      [
        "install",
        "--ignore-scripts",
        "--legacy-peer-deps",
        "--no-audit",
        "--no-fund",
        archivePath,
        reactArchive,
        reactDomArchive,
        schedulerArchive,
        `jsdom@${jsdomVersion}`,
        // Alias package names (e.g. @types/react18) are workspace-only;
        // the published artifact is always @types/react@<matched major>.
        `@types/react@${reactTypesVersion}`,
      ],
      consumerDirectory,
    );
    // §8 public type-contract fixtures: compile the checked-in positive and
    // negative TSX against the PACKED declarations across the full matrix —
    // React 18/19 (this loop) x NodeNext/bundler resolution (below) — under
    // strict, skipLibCheck:false, and exactOptionalPropertyTypes:true. The
    // negative fixture's @ts-expect-error directives fail the compile if any
    // rejected combination starts compiling.
    for (const fixture of ["positive.tsx", "negative.tsx"]) {
      copyFileSync(
        resolve(packageRoot, "type-tests", fixture),
        resolve(consumerDirectory, fixture),
      );
    }
    for (const resolution of TYPE_RESOLUTION_MODES) {
      run(
        process.execPath,
        [
          typescriptExecutable,
          "--noEmit",
          "--strict",
          "--exactOptionalPropertyTypes",
          "--skipLibCheck",
          "false",
          "--esModuleInterop",
          "--jsx",
          "react-jsx",
          "--target",
          "ES2023",
          "--module",
          resolution.module,
          "--moduleResolution",
          resolution.moduleResolution,
          "positive.tsx",
          "negative.tsx",
        ],
        consumerDirectory,
      );
    }
    writeFileSync(
      resolve(consumerDirectory, "consumer-smoke.mjs"),
      `${imports.join("\n")}\n${consumerSmokeSource()}\n`,
    );
    run(process.execPath, ["consumer-smoke.mjs"], consumerDirectory);
    await testPackedBrowserInteraction(consumerDirectory);
    console.log(
      `React ${reactVersion} with typings ${reactTypesVersion}: type-checked ${TYPE_RESOLUTION_MODES.length} resolution modes against the positive/negative fixtures, imported ${imports.length} packed entry points, rendered SSR, hydrated, and resized in Chromium.`,
    );
  }
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}

async function testPackedBrowserInteraction(consumerDirectory) {
  writeFileSync(
    resolve(consumerDirectory, "index.html"),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/client.mjs"></script></body></html>\n',
  );
  writeFileSync(
    resolve(consumerDirectory, "client.mjs"),
    packedBrowserSource(),
  );

  const server = await createServer({
    configFile: false,
    root: consumerDirectory,
    logLevel: "silent",
    // Prebundle the installed consumer graph before navigation. Without an
    // explicit entry Vite may discover the second React-major fixture lazily,
    // briefly serving the packed library's bare React import to the browser.
    optimizeDeps: {
      force: true,
      include: ["react", "react-dom/client", "@blitzd/resizable-panels"],
    },
    server: { host: "127.0.0.1", port: 0 },
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Packed consumer Vite server did not expose a TCP port.");
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1_000, height: 700 },
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const handle = page.locator("[data-resizable-panels-resize-handle]");
    await handle.waitFor();
    await page.waitForFunction(() => {
      const separator = document.querySelector(
        "[data-resizable-panels-resize-handle]",
      );
      const navigation = document.querySelector(
        '[data-resizable-panels-panel-id="navigation"]',
      );
      const content = document.querySelector(
        '[data-resizable-panels-panel-id="content"]',
      );
      const group = document.querySelector(
        "[data-resizable-panels-panel-group]",
      );
      if (
        !(separator instanceof HTMLElement) ||
        !(navigation instanceof HTMLElement) ||
        !(content instanceof HTMLElement) ||
        !(group instanceof HTMLElement) ||
        separator.getAttribute("aria-disabled") === "true"
      ) {
        return false;
      }
      const valueNow = Number(separator.getAttribute("aria-valuenow"));
      const valueMin = Number(separator.getAttribute("aria-valuemin"));
      const valueMax = Number(separator.getAttribute("aria-valuemax"));
      const navigationWidth = navigation.getBoundingClientRect().width;
      const contentWidth = content.getBoundingClientRect().width;
      const groupWidth = group.getBoundingClientRect().width;
      return (
        Number.isFinite(valueNow) &&
        valueMax > valueMin &&
        Math.abs(valueNow - navigationWidth) <= 1 &&
        Math.abs(navigationWidth + contentWidth - groupWidth) <= 1
      );
    });
    // ARIA state is published from layout effects. Give pointer listeners and
    // the browser's measured layout two frames to settle before input.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const before = await readPackedBrowserLayout(page);
    let after = before;
    for (let attempt = 0; attempt < 2; attempt++) {
      const box = await handle.boundingBox();
      if (!box) throw new Error("Packed consumer resize handle has no bounds.");
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 80, y, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(100);
      after = await readPackedBrowserLayout(page);
      if (Math.abs(after.navigation - before.navigation) > 1) break;
      // A newly optimized React-major graph can finish attaching pointer
      // listeners just after its first actionable paint. Permit one fresh
      // gesture, but still fail if the packed consumer cannot resize.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    }
    assertClose(
      after.navigation - before.navigation,
      80,
      "navigation pointer transfer",
    );
    assertClose(
      after.content - before.content,
      -80,
      "content pointer transfer",
    );
    assertClose(
      before.navigation + before.content,
      before.group,
      "initial panel total",
    );
    assertClose(
      after.navigation + after.content,
      after.group,
      "resized panel total",
    );
    assertClose(after.group, before.group, "group width during pointer resize");
    // §15: the dev handle-metrics global is inert test instrumentation — it
    // must never be created by the library itself. Assert it stays absent
    // after a full mount + interaction in a consumer that never seeds it.
    const metricsGlobalCreated = await page.evaluate(
      () =>
        "__resizablePanelsHandleStateMetrics" in
        /** @type {Record<string, unknown>} */ (globalThis),
    );
    if (metricsGlobalCreated) {
      throw new Error(
        "Packed consumer created globalThis.__resizablePanelsHandleStateMetrics; the metrics global must stay inert unless a consumer pre-seeds it.",
      );
    }
    if (pageErrors.length > 0) {
      throw new Error(
        `Packed consumer browser emitted errors:\n${pageErrors.join("\n")}`,
      );
    }
  } finally {
    await browser?.close();
    await server.close();
  }
}

async function readPackedBrowserLayout(page) {
  return page.evaluate(() => {
    const width = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing packed consumer element: ${selector}`);
      }
      return element.getBoundingClientRect().width;
    };
    return {
      navigation: width('[data-resizable-panels-panel-id="navigation"]'),
      content: width('[data-resizable-panels-panel-id="content"]'),
      group: width("[data-resizable-panels-panel-group]"),
    };
  });
}

function assertClose(actual, expected, label) {
  if (Math.abs(actual - expected) > 1.5) {
    throw new Error(`${label}: expected ${expected}, received ${actual}.`);
  }
}

function packedBrowserSource() {
  return `
import React from "react";
import { createRoot } from "react-dom/client";
import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";

const h = React.createElement;
function App() {
  return h(
    PanelProvider,
    null,
    h(
      PanelGroup,
      {
        orientation: "horizontal",
        style: { height: "300px", width: "800px" },
      },
      h(
        Panel,
        { panelId: "navigation", side: "start", defaultSize: 300, maxSize: 500 },
        "navigation",
      ),
      h(PanelResizeHandle),
      h(Panel, { panelId: "content" }, "content"),
    ),
  );
}

createRoot(document.getElementById("root")).render(h(App));
`;
}

function consumerSmokeSource() {
  return String.raw`
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";

const h = React.createElement;
function App() {
  return h(
    PanelProvider,
    null,
    h(
      PanelGroup,
      { orientation: "horizontal" },
      h(Panel, { panelId: "navigation", defaultSize: 240 }, "navigation"),
      h(PanelResizeHandle),
      h(Panel, { panelId: "content" }, "content"),
    ),
  );
}

const originalError = console.error;
const errors = [];
console.error = (...args) => {
  const message = args.map(String).join(" ");
  if (!message.startsWith("Warning: useLayoutEffect does nothing")) {
    errors.push(message);
  }
};
try {
  const markup = renderToString(h(App));
  if (!markup.includes("data-resizable-panels-panel-group")) {
    throw new Error("Packed artifact did not render panel markup on the server.");
  }
  const dom = new JSDOM('<!doctype html><div id="root">' + markup + "</div>", {
    pretendToBeVisual: true,
    url: "http://localhost/",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  const container = dom.window.document.getElementById("root");
  const root = hydrateRoot(container, h(App));
  await new Promise((resolve) => setTimeout(resolve, 25));
  root.unmount();
  dom.window.close();
  if (errors.length > 0) {
    throw new Error("Packed artifact hydration emitted errors:\n" + errors.join("\n"));
  }
} finally {
  console.error = originalError;
}
`;
}

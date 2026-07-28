/**
 * Publish dry-run gate (§15). Runs before the real publish and validates,
 * against the actual packed tarball:
 *
 *   1. version / release-tag agreement (when RELEASE_TAG is set);
 *   2. a CHANGELOG.md entry for the version being published;
 *   3. tarball contents — required files present, source/test/config absent;
 *   4. resolvable repository/homepage/bugs metadata URLs.
 *
 * All problems are collected and reported together so a maintainer sees the
 * full picture in one run. Exit non-zero if any check fails. This is NOT part
 * of the everyday `verify:release`; it gates the tag-triggered publish so
 * main CI stays green while the launch gate stays strict.
 *
 * URL resolution can be skipped for pre-infrastructure local runs with
 * RESIZABLE_PANELS_SKIP_URL_CHECK=1 (the launch itself must not skip it).
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const packageJson = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const version = packageJson.version;
const problems = [];

function runVerbose(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result.stdout;
}

// ── 1. version / release-tag agreement ──────────────────────────────────────
const releaseTag = process.env.RELEASE_TAG;
if (releaseTag) {
  const tagVersion = releaseTag.replace(/^v/, "");
  if (tagVersion !== version) {
    problems.push(
      `Release tag "${releaseTag}" does not match package version ${version}.`,
    );
  }
}

// ── 2. changelog entry for this version ─────────────────────────────────────
const changelog = readFileSync(resolve(packageRoot, "CHANGELOG.md"), "utf8");
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
if (!new RegExp(`^##\\s+${escapedVersion}(\\s|$)`, "m").test(changelog)) {
  problems.push(`CHANGELOG.md has no "## ${version}" entry.`);
}

// ── 3. tarball contents ─────────────────────────────────────────────────────
// Build the way `prepack` does, then pack the built output with
// --ignore-scripts so stdout carries only the JSON manifest.
runVerbose("bun", ["run", "build"]);
runVerbose("bun", ["run", "verify:package"]);
const packDestination = mkdtempSync(join(tmpdir(), "verify-publish-"));
try {
  const manifestJson = capture(npm, [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    packDestination,
  ]);
  const manifest = JSON.parse(manifestJson);
  const files = (manifest[0]?.files ?? []).map((entry) => entry.path);

  const required = [
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "dist/index.js",
    "dist/index.d.ts",
  ];
  for (const file of required) {
    if (!files.includes(file)) {
      problems.push(`Tarball is missing required file: ${file}.`);
    }
  }

  const forbiddenPrefixes = [
    "src/",
    "e2e/",
    "type-tests/",
    "scripts/",
    "test-results/",
    "node_modules/",
  ];
  const forbiddenExact = new Set([
    "tsconfig.json",
    "tsconfig.build.json",
    "tsconfig.tsbuildinfo",
    "playwright.config.ts",
    "vite.config.ts",
    "RELEASING.md",
    "TESTING.md",
  ]);
  for (const file of files) {
    if (
      forbiddenPrefixes.some((prefix) => file.startsWith(prefix)) ||
      forbiddenExact.has(file) ||
      file.endsWith(".tsbuildinfo")
    ) {
      problems.push(`Tarball unexpectedly includes: ${file}.`);
    }
  }
} finally {
  rmSync(packDestination, { recursive: true, force: true });
}

// ── 4. resolvable metadata URLs ─────────────────────────────────────────────
function metadataUrls() {
  const urls = [];
  const repository = packageJson.repository;
  const repositoryUrl =
    typeof repository === "string" ? repository : repository?.url;
  if (repositoryUrl) {
    urls.push({
      field: "repository.url",
      url: repositoryUrl
        .replace(/^git\+/, "")
        .replace(/\.git$/, "")
        .replace(/^git:\/\//, "https://"),
    });
  }
  if (packageJson.homepage) {
    urls.push({ field: "homepage", url: packageJson.homepage });
  }
  const bugs = packageJson.bugs;
  const bugsUrl = typeof bugs === "string" ? bugs : bugs?.url;
  if (bugsUrl) urls.push({ field: "bugs", url: bugsUrl });
  return urls;
}

async function resolves(url) {
  for (const method of ["HEAD", "GET"]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
      });
      if (response.status < 400) return { ok: true };
      // Some hosts reject HEAD; only treat a GET status as authoritative.
      if (method === "GET")
        return { ok: false, detail: `HTTP ${response.status}` };
    } catch (error) {
      if (method === "GET") {
        return {
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  return { ok: false, detail: "unreachable" };
}

if (process.env.RESIZABLE_PANELS_SKIP_URL_CHECK) {
  console.warn(
    "Skipping metadata URL resolution (RESIZABLE_PANELS_SKIP_URL_CHECK set). The launch publish must not skip this.",
  );
} else {
  const checks = await Promise.all(
    metadataUrls().map(async ({ field, url }) => ({
      field,
      url,
      ...(await resolves(url)),
    })),
  );
  for (const check of checks) {
    if (!check.ok) {
      problems.push(
        `Metadata ${check.field} does not resolve: ${check.url} (${check.detail}).`,
      );
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
if (problems.length > 0) {
  console.error(
    `\nPublish gate failed for ${packageJson.name}@${version}:\n` +
      problems.map((problem) => `  - ${problem}`).join("\n"),
  );
  process.exit(1);
}
console.log(
  `Publish gate passed for ${packageJson.name}@${version}: tarball contents, changelog, ${releaseTag ? "tag agreement, " : ""}and metadata URLs verified.`,
);

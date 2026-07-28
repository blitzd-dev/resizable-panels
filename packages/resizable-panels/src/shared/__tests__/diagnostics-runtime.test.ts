import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";

describe("diagnostics runtime detection", () => {
  it("builds output that evaluates without a process global", async () => {
    const results = (await build({
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        lib: {
          entry: resolve(__dirname, "../runtime-mode.ts"),
          formats: ["es"],
          fileName: "runtime-mode",
        },
      },
    })) as Rollup.RollupOutput[];
    const chunk = results[0]?.output.find(
      (output): output is Rollup.OutputChunk => output.type === "chunk",
    );

    expect(chunk?.code).toContain("typeof process");

    const moduleUrl = `data:text/javascript;base64,${Buffer.from(
      chunk?.code ?? "",
    ).toString("base64")}`;
    const evaluation = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `globalThis.process = undefined; const module = await import(${JSON.stringify(moduleUrl)}); if (module.IS_DEVELOPMENT !== true) throw new Error("expected development mode");`,
      ],
      { encoding: "utf8" },
    );

    expect(evaluation.stderr).toBe("");
    expect(evaluation.status).toBe(0);
  });
});

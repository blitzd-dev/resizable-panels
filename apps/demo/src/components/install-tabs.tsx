import { useState } from "react";
import { CodeBlock } from "@/components/code-block";
import { Segmented } from "@/components/segmented";

// The package managers we show an install line for, in tab order. `bun` leads
// because it is this repo's default (see the workspace tooling).
const MANAGERS = ["bun", "npm", "pnpm", "yarn"] as const;
type Manager = (typeof MANAGERS)[number];

// npm spells the add verb "install"; every other manager uses "add".
const ADD_VERB: Record<Manager, string> = {
  bun: "add",
  npm: "install",
  pnpm: "add",
  yarn: "add",
};

/**
 * The install snippet, as a package-manager switch. One code block whose
 * command follows the selected tab — rendered as `bash` so the manager reads
 * as a command and the scoped package name stays plain text (the old `js`
 * highlighting mis-parsed `@scope/name` into an ugly red decorator/regex).
 */
export function InstallTabs({ pkg }: { pkg: string }) {
  const [manager, setManager] = useState<Manager>("bun");
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        options={MANAGERS}
        value={manager}
        onValueChange={setManager}
        mono
      />
      <CodeBlock
        code={`${manager} ${ADD_VERB[manager]} ${pkg}`}
        lang="bash"
        lineNumbers={false}
      />
    </div>
  );
}

import { StrictMode, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArenaCard,
  type ArenaScenario,
  type ArenaVerdictRecord,
  loadVerdict,
  saveVerdict,
} from "./arena-kit";
import { BEHAVIOR_SCENARIOS } from "./scenarios-behaviors";
import { FEATURE_SCENARIOS } from "./scenarios-features";
import { FINDING_SCENARIOS } from "./scenarios-findings";

const SCENARIOS: ArenaScenario[] = [
  ...FINDING_SCENARIOS,
  ...BEHAVIOR_SCENARIOS,
  ...FEATURE_SCENARIOS,
];

const STRICT_MODE_KEY = "arena:strictmode";

function loadStrictMode(): boolean {
  try {
    return localStorage.getItem(STRICT_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Edge-case test arena: manual validation surface for the behaviors most
 * likely to silently regress. Sweep the cards after each library iteration;
 * verdicts persist locally. Findings (R-xx) reference
 * docs/release-prep/FINDINGS.md in the repo.
 */
export default function Arena() {
  const [verdicts, setVerdicts] = useState<Record<string, ArenaVerdictRecord>>(
    () =>
      Object.fromEntries(
        SCENARIOS.map((scenario) => [
          scenario.slug,
          loadVerdict(scenario.slug),
        ]),
      ),
  );
  const [strictMode, setStrictMode] = useState(loadStrictMode);
  // Remount every fixture when StrictMode flips so mount-time double-invoke
  // behavior is actually exercised, not just future renders.
  const [strictModeGeneration, setStrictModeGeneration] = useState(0);

  const setVerdict = (slug: string, record: ArenaVerdictRecord) => {
    saveVerdict(slug, record);
    setVerdicts((prev) => ({ ...prev, [slug]: record }));
  };
  const resetVerdicts = () => {
    for (const scenario of SCENARIOS) {
      saveVerdict(scenario.slug, { verdict: "untested", at: 0 });
    }
    setVerdicts(
      Object.fromEntries(
        SCENARIOS.map((scenario) => [
          scenario.slug,
          { verdict: "untested" as const, at: 0 },
        ]),
      ),
    );
  };
  const toggleStrictMode = () => {
    const next = !strictMode;
    try {
      localStorage.setItem(STRICT_MODE_KEY, next ? "1" : "0");
    } catch {
      // ignore unwritable storage
    }
    setStrictMode(next);
    setStrictModeGeneration((generation) => generation + 1);
  };

  const counts = useMemo(() => {
    let pass = 0;
    let fail = 0;
    for (const scenario of SCENARIOS) {
      const verdict = verdicts[scenario.slug]?.verdict ?? "untested";
      if (verdict === "pass") pass += 1;
      else if (verdict === "fail") fail += 1;
    }
    return { pass, fail, untested: SCENARIOS.length - pass - fail };
  }, [verdicts]);

  const cards = SCENARIOS.map((scenario) => (
    <ArenaCard
      key={`${scenario.slug}:${strictModeGeneration}`}
      scenario={scenario}
      verdict={verdicts[scenario.slug] ?? { verdict: "untested", at: 0 }}
      onVerdictChange={(record) => setVerdict(scenario.slug, record)}
    />
  ));

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <PageHeader
          eyebrow="Edge-case arena"
          title="Manual validation, hardest cases first"
        >
          One card per contract that the automated suites are least able to
          protect. Sweep after each iteration: follow the steps, compare the
          event log against the expectations, record Pass/Fail. Verdicts persist
          in this browser. R-xx tags reference docs/release-prep/FINDINGS.md.
        </PageHeader>

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-emerald-600 dark:text-emerald-400">
              {counts.pass} pass
            </span>
            <span className="text-red-600 dark:text-red-400">
              {counts.fail} fail
            </span>
            <span className="text-muted-foreground">
              {counts.untested} untested
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="xs"
              variant={strictMode ? "default" : "outline"}
              onClick={toggleStrictMode}
              className={cn(
                strictMode && "bg-violet-600 text-white hover:bg-violet-600/90",
              )}
            >
              StrictMode: {strictMode ? "ON" : "off"}
            </Button>
            <Button size="xs" variant="ghost" onClick={resetVerdicts}>
              Reset verdicts
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {strictMode ? <StrictMode>{cards}</StrictMode> : cards}
        </div>
      </div>
    </div>
  );
}

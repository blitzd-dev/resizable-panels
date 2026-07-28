import { PanelProvider, usePanelActions } from "@blitzd/resizable-panels";
import { MousePointer2, Pause, Play, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { CodeStack } from "./code-stack";
import { driveClick, driveDrag, sleep } from "./drive-drag";
import { SceneEngagementContext } from "./engagement";
import { FakeCursor, type FakeCursorHandle } from "./fake-cursor";
import { SCENES, type Scene, type SceneStep } from "./scenes";

type HomeDemoProps = {
  className?: string;
};

/**
 * The scenes render at 1/zoom size and are scaled back down, so the fake
 * apps read as full-size windows seen zoomed out — more layout on show in
 * the same card. The zoom is a CSS var (--zoom) so it can step per
 * breakpoint: phones zoom out to 0.5 so the whole fake window fits the
 * card width instead of cropping the right edge off screen.
 * driveDrag derives the live scale from panel rects, so it needs no
 * constant and stays correct at every breakpoint.
 */

/**
 * Autoplaying hero demo. Cycles through the SCENES, running each scene's
 * scripted step list in sequence. The code stack on the right mirrors the
 * actions firing on the live panel layout.
 */
export function HomeDemo({ className }: HomeDemoProps) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  // Autoplay is still an animation: reduced-motion users get a parked demo
  // they can play or step through on their own terms.
  const [playing, setPlaying] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<FakeCursorHandle>(null);

  const scene = SCENES[sceneIdx];

  // Plain reads, no updater functions: calling setSceneIdx inside the
  // setStepIdx updater double-advances scenes under StrictMode, which
  // double-invokes updaters to surface exactly this kind of impurity.
  const advance = useCallback(() => {
    const nextStep = stepIdx + 1;
    if (nextStep >= SCENES[sceneIdx].script.length) {
      setSceneIdx((sceneIdx + 1) % SCENES.length);
      setStepIdx(0);
    } else {
      setStepIdx(nextStep);
    }
  }, [stepIdx, sceneIdx]);

  const restart = useCallback(() => {
    setSceneIdx(0);
    setStepIdx(0);
    setPlaying(true);
  }, []);

  const selectScene = useCallback((i: number) => {
    setSceneIdx(i);
    setStepIdx(0);
  }, []);

  // The visitor took the wheel (opened a file, typed a command, messaged
  // the agent): stop advancing the script so it doesn't drive over them.
  const engage = useCallback(() => setPlaying(false), []);

  return (
    <div
      className={cn(
        "grid w-full min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6",
        className,
      )}
    >
      {/* Card height tracks the zoom so the scene's layout height stays
          ~587px at every breakpoint (440/0.75 on desktop) — the fake app
          renders as the same window, just scaled, rather than stretching
          into a tall portrait layout on phones. */}
      <Card className="relative h-73 gap-0 overflow-hidden rounded-2xl py-0 shadow-xl shadow-black/5 sm:h-117 lg:h-110">
        <WindowChrome title={scene.title}>
          {!playing ? (
            <span className="mr-1 text-[10px] text-muted-foreground/70">
              you're driving
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause demo" : "Play demo"}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={restart}
            aria-label="Restart demo"
          >
            <RotateCcw />
          </Button>
        </WindowChrome>
        {/* top offset tracks the chrome's responsive height (h-7/h-9) */}
        <div
          ref={containerRef}
          data-home-hero=""
          className="absolute inset-x-0 bottom-0 top-7 sm:top-9"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={scene.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="h-full overflow-hidden"
            >
              <div
                className="[--zoom:0.5] sm:[--zoom:0.8] lg:[--zoom:0.75]"
                style={{
                  width: "calc(100% / var(--zoom))",
                  height: "calc(100% / var(--zoom))",
                  transform: "scale(var(--zoom))",
                  transformOrigin: "top left",
                }}
              >
                <SceneEngagementContext.Provider value={engage}>
                  <PanelProvider>
                    <scene.Layout />
                    <SceneRunner
                      script={scene.script}
                      stepIdx={stepIdx}
                      autoAdvance={playing}
                      onComplete={advance}
                      containerRef={containerRef}
                      cursorRef={cursorRef}
                    />
                  </PanelProvider>
                </SceneEngagementContext.Provider>
              </div>
            </motion.div>
          </AnimatePresence>
          <FakeCursor ref={cursorRef} />
        </div>
      </Card>

      <div className="flex min-h-0 flex-col gap-4">
        <CodeStack scene={scene} stepIdx={stepIdx} />
        {/* Desktop-only: on phones the demo sits between the scene chips and
            the code stack, and this caption just added scroll length. */}
        <p className="mt-auto hidden items-start gap-2 text-xs leading-relaxed text-muted-foreground lg:flex">
          <MousePointer2 className="mt-0.5 size-3.5 shrink-0" />
          Not a video — the window is the library running live. Drag a seam,
          open a file, run a command, ask the agent. Autoplay pauses while you
          drive.
        </p>
      </div>

      <SceneStrip
        scenes={SCENES}
        sceneIdx={sceneIdx}
        onSelectScene={selectScene}
        // Phones surface the picker above the window — it's a compact chip
        // row there, and scrolling past the window + code stack to find the
        // scene switcher hid it. On lg it stays below as the blurb legend.
        className="order-first lg:order-0 lg:col-span-2"
      />
    </div>
  );
}

export function WindowChrome({
  title,
  children,
}: {
  title: string;
  /** Rendered at the right edge of the title bar (demo transport controls). */
  children?: ReactNode;
}) {
  return (
    // Slimmer bar on phones: at the mobile zoom a 36px chrome eats an
    // outsized share of the card, and the transport buttons are desktop
    // affordances (autoplay just runs on touch devices).
    <div className="flex h-7 items-center gap-2 border-b border-border bg-secondary/40 px-3 sm:h-9 sm:gap-3">
      <div className="flex gap-1.5">
        <span className="size-2 rounded-full bg-red-400/70 sm:size-2.5" />
        <span className="size-2 rounded-full bg-amber-400/70 sm:size-2.5" />
        <span className="size-2 rounded-full bg-emerald-400/70 sm:size-2.5" />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="text-[11px] font-medium text-muted-foreground"
        >
          {title}
        </motion.div>
      </AnimatePresence>
      {children ? (
        <div className="ml-auto hidden items-center gap-0.5 sm:flex">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type SceneRunnerProps = {
  script: SceneStep[];
  stepIdx: number;
  /** When true, schedules `onComplete` after the step's dwell. When false,
   *  the step still executes on `stepIdx` change but no advance is queued. */
  autoAdvance: boolean;
  onComplete?: () => void;
  /** Roots the seam lookup for drag steps. Optional: without it (or the
   *  cursor) drag steps fall back to an instant setSize. */
  containerRef?: RefObject<HTMLDivElement | null>;
  cursorRef?: RefObject<FakeCursorHandle | null>;
};

/**
 * Lives inside each scene's PanelProvider. Executes the active step whenever
 * `stepIdx` changes — direct commands fire instantly, while click and drag
 * steps play their cursor gesture — and (when autoAdvance is on) schedules
 * the next advance once the step's work has finished plus its dwell. Execution and advance are
 * separate effects so toggling pause mid-gesture neither replays nor
 * aborts it; pausing only stops the advance. The action dispatcher is
 * stable for the provider's lifetime, so the execution effect never
 * re-fires on layout updates.
 */
export function SceneRunner({
  script,
  stepIdx,
  autoAdvance,
  onComplete,
  containerRef,
  cursorRef,
}: SceneRunnerProps) {
  const actions = usePanelActions();

  // Identifies the step whose work (command or gesture) last completed.
  // The advance effect below only schedules when this matches the active
  // step, so a step change gates it off without an explicit reset.
  const [doneStep, setDoneStep] = useState<{
    script: SceneStep[];
    stepIdx: number;
  } | null>(null);

  useEffect(() => {
    const step = script[stepIdx];
    if (!step) return;
    const ctrl = new AbortController();

    (async () => {
      // First step of a scene: hold a beat so the crossfade (~250ms)
      // settles and the user sees the default-state layout before any
      // motion starts. Also serializes against the previous scene's
      // runner, which keeps gesturing until its exit animation ends.
      if (stepIdx === 0) await sleep(260, ctrl.signal);

      if (step.drag) {
        const container = containerRef?.current;
        const cursor = cursorRef?.current;
        if (container && cursor) {
          await driveDrag({
            container,
            cursor,
            actions,
            ...step.drag,
            keepCursor: !!script[stepIdx + 1]?.drag,
            signal: ctrl.signal,
          });
        } else {
          actions.setSize(step.drag.target, step.drag.toSize);
        }
      } else if (step.click) {
        const container = containerRef?.current;
        const cursor = cursorRef?.current;
        if (container && cursor) {
          await driveClick({
            container,
            cursor,
            selector: step.click.selector,
            activate: () => step.action?.(actions),
            signal: ctrl.signal,
          });
        } else {
          step.action?.(actions);
        }
      } else {
        step.action?.(actions);
      }
      if (!ctrl.signal.aborted) setDoneStep({ script, stepIdx });
    })().catch(() => {
      // Aborted mid-step (scene change / unmount). driveDrag has already
      // restored the seam highlight and cursor.
    });

    return () => ctrl.abort();
  }, [script, stepIdx, containerRef, cursorRef, actions]);

  useEffect(() => {
    const done = doneStep?.script === script && doneStep.stepIdx === stepIdx;
    if (!(done && autoAdvance && onComplete)) return;
    const timer = setTimeout(onComplete, script[stepIdx]?.dwell ?? 0);
    return () => clearTimeout(timer);
  }, [doneStep, autoAdvance, onComplete, script, stepIdx]);

  return null;
}

type SceneStripProps = {
  scenes: Scene[];
  sceneIdx: number;
  onSelectScene: (i: number) => void;
  className?: string;
};

/**
 * Scene switcher that doubles as the "what am I looking at" legend: one card
 * per layout archetype, the active card tracking the window above.
 */
function SceneStrip({
  scenes,
  sceneIdx,
  onSelectScene,
  className,
}: SceneStripProps) {
  return (
    <ToggleGroup
      value={[scenes[sceneIdx].id]}
      onValueChange={(value) => {
        const nextIndex = scenes.findIndex((scene) => scene.id === value[0]);
        if (nextIndex >= 0) onSelectScene(nextIndex);
      }}
      aria-label="Demo scene"
      spacing={3}
      className={cn("w-full flex-row", className)}
    >
      {scenes.map((s) => (
        <ToggleGroupItem
          key={s.id}
          value={s.id}
          // Phones get an equal-width chip row (title only, blurb hidden) —
          // three stacked blurb cards were ~2 viewport heights of scrolling
          // for what is just a scene picker.
          className="h-auto min-w-0 flex-1 basis-0 flex-col items-start gap-1 rounded-xl border border-border/70 bg-card/50 p-2.5 text-left whitespace-normal aria-pressed:border-primary/40 aria-pressed:bg-muted/60 sm:p-4"
        >
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-foreground sm:gap-2 sm:text-sm">
            <s.icon className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
            <span className="truncate">{s.title}</span>
          </span>
          <span className="hidden text-xs leading-relaxed text-muted-foreground sm:block">
            {s.blurb}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

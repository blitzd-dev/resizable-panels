import { MousePointer2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { Scene } from "./scenes";

type CodeStackProps = {
  scene: Scene;
  stepIdx: number;
};

// Must stay below the shortest scene script (6 steps) — at VISIBLE ===
// script length the exiting top line and the entering bottom line would
// share an AnimatePresence key.
const VISIBLE = 5;
const SLOT_H = 48; // px — fixed height per slot so y-translation is uniform.
const ACTIVE_EXTRA = 8; // px — small lift so the top line breathes vs the rest.

/**
 * Vertical stack of upcoming code snippets. Each slot is absolutely positioned
 * and animated via translateY — fixed slot height means the stack never
 * reflows mid-step, so the transition stays buttery. On advance the old top
 * line drifts up and fades, every below line slides into the slot above it,
 * and a fresh line pops in from the bottom.
 */
export function CodeStack({ scene, stepIdx }: CodeStackProps) {
  const stackHeight = SLOT_H * VISIBLE + ACTIVE_EXTRA;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <div className="font-mono text-[10px] text-muted-foreground">
          {stepIdx + 1}
          <span className="text-muted-foreground/40">
            {" / "}
            {scene.script.length}
          </span>
        </div>
      </div>

      {/* Height is CSS (not the stackHeight const) so it can shrink under
          md: phones clip to the active line + one peeking slot instead of
          giving five upcoming steps ~250px of vertical space. The px values
          mirror SLOT_H/ACTIVE_EXTRA/VISIBLE — CSS can't read the consts.
          overflow-hidden clips the remaining slots; their enter/exit
          animation math is unchanged. */}
      <div className="relative h-26 overflow-hidden md:h-62">
        <AnimatePresence initial={false}>
          {Array.from({ length: VISIBLE }, (_, offset) => {
            const absIdx = (stepIdx + offset) % scene.script.length;
            const step = scene.script[absIdx];
            const isActive = offset === 0;
            // Active line sits at y=0 and is a touch taller; inactive lines
            // stack below offset by SLOT_H each, starting after ACTIVE_EXTRA.
            const targetY = isActive ? 0 : ACTIVE_EXTRA + offset * SLOT_H;

            return (
              <motion.div
                key={`${scene.id}:${absIdx}`}
                initial={{
                  y: stackHeight + 12,
                  opacity: 0,
                  scale: 0.94,
                }}
                animate={{
                  y: targetY,
                  opacity: isActive ? 1 : Math.max(0.22, 0.6 - offset * 0.12),
                  scale: 1,
                }}
                exit={{
                  y: -SLOT_H - 4,
                  opacity: 0,
                  scale: 0.92,
                  transition: {
                    duration: 0.36,
                    ease: [0.4, 0, 0.2, 1],
                  },
                }}
                // Match the panel library's 300ms Material "standard"
                // easing so the stack and live layout share one motion
                // language.
                transition={{
                  duration: 0.3,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className="absolute inset-x-0"
                style={{ top: 0 }}
              >
                <CodeLine
                  code={step.code}
                  active={isActive}
                  gesture={!!step.drag}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CodeLine({
  code,
  active,
  gesture,
}: {
  code: string;
  active: boolean;
  gesture?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center rounded-lg border px-4 font-mono leading-snug",
        active
          ? "border-primary/30 bg-primary/6 text-foreground shadow-sm"
          : "border-border/40 bg-card/30 text-muted-foreground",
      )}
      style={{
        height: active ? SLOT_H + ACTIVE_EXTRA : SLOT_H - 6,
        fontSize: active ? 15 : 12,
        fontWeight: active ? 500 : 400,
        // `transition-colors` (the previous Tailwind class) only animated
        // color/background. font-size and height were jumping instantly.
        // Match the panel library's 300ms standard easing so the line's
        // size morph reads as part of the same motion language.
        transition:
          "height 300ms cubic-bezier(0.4, 0, 0.2, 1), font-size 300ms cubic-bezier(0.4, 0, 0.2, 1), color 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {gesture ? (
        // Drag steps aren't API calls — render as a user gesture, not code,
        // to underline that dragging needs no wiring at all.
        <span
          className={cn(
            "flex min-w-0 items-center gap-2 italic",
            active ? "text-muted-foreground" : "text-muted-foreground/60",
          )}
        >
          <MousePointer2
            className={cn("size-3.5 shrink-0", active && "text-primary")}
          />
          <span className="truncate">{code}</span>
        </span>
      ) : (
        // pre-line + clamp: scripted steps may be two commands separated by
        // a newline; anything longer clips instead of blowing up the slot.
        <span className="line-clamp-2 min-w-0 whitespace-pre-line">
          <Tokenized code={code} active={active} />
        </span>
      )}
    </div>
  );
}

/**
 * Lightweight tokenizer tuned for short method-call snippets like
 * `nav.setOpen(false)` — keeps the stack lively without pulling Prism in.
 */
function Tokenized({ code, active }: { code: string; active: boolean }) {
  // Split on a trailing comment first so "// pinned" stays muted.
  const commentIdx = code.indexOf("//");
  const head = commentIdx >= 0 ? code.slice(0, commentIdx) : code;
  const tail = commentIdx >= 0 ? code.slice(commentIdx) : "";

  const parts = head.split(/([().,\s])/);

  return (
    <>
      {parts.map((piece, i) => {
        if (piece === "") return null;
        if (/^[().,\s]$/.test(piece)) {
          return (
            <span key={i} className="text-muted-foreground/70">
              {piece}
            </span>
          );
        }
        if (/^(true|false|null|undefined)$/.test(piece)) {
          return (
            <span key={i} className="text-orange-400">
              {piece}
            </span>
          );
        }
        if (/^-?\d+(\.\d+)?$/.test(piece)) {
          return (
            <span key={i} className="text-amber-400">
              {piece}
            </span>
          );
        }
        // Method names appear right after a dot. Walk back to the previous
        // non-whitespace piece to decide.
        let prev = "";
        for (let j = i - 1; j >= 0; j--) {
          if (parts[j] && parts[j].trim() !== "") {
            prev = parts[j];
            break;
          }
        }
        if (prev.endsWith(".")) {
          return (
            <span
              key={i}
              className={active ? "text-primary" : "text-foreground/70"}
            >
              {piece}
            </span>
          );
        }
        return (
          <span key={i} className={active ? "text-foreground" : ""}>
            {piece}
          </span>
        );
      })}
      {tail ? <span className="text-muted-foreground/60">{tail}</span> : null}
    </>
  );
}

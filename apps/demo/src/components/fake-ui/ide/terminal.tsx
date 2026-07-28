import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TerminalProps = {
  /** Active panel tab label. Defaults to "Terminal". */
  label?: string;
  /** Present when the prompt accepts real keyboard input. Called on focus /
   *  first keystroke so the host can pause any scripted driving. */
  onInteract?: () => void;
};

const PANEL_TABS = ["Problems", "Output", "Terminal"];
const COMMAND = "pnpm dev";

type HistoryEntry = { cmd: string; output: ReactNode };

/**
 * VS Code-style bottom panel. On mount the prompt types out `pnpm dev` and
 * the dev-server output fades in; with `onInteract` set, the trailing prompt
 * is a real input with a tiny toy shell behind it.
 */
export function Terminal({ label = "Terminal", onInteract }: TerminalProps) {
  const reduceMotion = useReducedMotion();
  const { typed, done } = useTypewriter(COMMAND, {
    startDelay: 400,
    charDelay: 55,
    enabled: !reduceMotion,
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [introVisible, setIntroVisible] = useState(true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll reacts to content growth
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, done]);

  const run = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    if (cmd === "clear") {
      setIntroVisible(false);
      setHistory([]);
      return;
    }
    setHistory((h) => [...h, { cmd, output: fakeShell(cmd) }]);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-border px-3 text-[10px] font-medium uppercase tracking-wider">
        {PANEL_TABS.map((tab) => {
          const isActive = tab === label;
          return (
            <span
              key={tab}
              className={cn(
                "relative flex h-full items-center",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground/60 hover:text-foreground/80",
              )}
            >
              {tab}
              {isActive ? (
                <span className="absolute inset-x-0 bottom-0 h-px bg-foreground/70" />
              ) : null}
            </span>
          );
        })}
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-4 text-foreground/80 [scrollbar-width:none]"
      >
        {introVisible ? (
          <>
            <div>
              <span className="text-muted-foreground">$</span> {typed}
              {!done ? <Cursor /> : null}
            </div>
            {done ? (
              <>
                <OutputLine delay={0.25}>
                  <span className="text-muted-foreground"> VITE v5.4.0</span>{" "}
                  <span className="text-emerald-400/80">ready in 142 ms</span>
                </OutputLine>
                <OutputLine delay={0.45}>
                  <span className="text-emerald-400/80"> ➜</span>
                  <span className="text-muted-foreground"> Local: </span>
                  <span className="text-cyan-400/80">
                    http://localhost:5173/
                  </span>
                </OutputLine>
              </>
            ) : null}
          </>
        ) : null}
        {history.map((entry, i) => (
          <div key={i}>
            <div>
              <span className="text-muted-foreground">$</span> {entry.cmd}
            </div>
            {entry.output}
          </div>
        ))}
        {done || !introVisible ? (
          onInteract ? (
            <OutputLine delay={introVisible && history.length === 0 ? 0.7 : 0}>
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">$</span>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={onInteract}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      run(input);
                      setInput("");
                    }
                  }}
                  aria-label="Terminal input"
                  spellCheck={false}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-foreground/80 caret-emerald-400 outline-none placeholder:text-muted-foreground/40"
                  placeholder="type a command…"
                />
              </span>
            </OutputLine>
          ) : (
            <OutputLine delay={0.7}>
              <span className="text-muted-foreground">$</span> <Cursor />
            </OutputLine>
          )
        ) : null}
      </div>
    </div>
  );
}

/** Just enough shell to be fun. Unknown commands fail like zsh would. */
function fakeShell(cmd: string): ReactNode {
  const [bin, ...rest] = cmd.split(/\s+/);
  const arg = rest.join(" ");
  const muted = (text: string) => (
    <div className="text-muted-foreground">{text}</div>
  );
  switch (bin) {
    case "ls":
      return muted("src  package.json  tsconfig.json  README.md");
    case "pwd":
      return muted("~/code/panel-layout-demo");
    case "echo":
      return muted(arg || "");
    case "whoami":
      return muted("you-drive");
    case "git":
      return arg.startsWith("status") ? (
        <>
          {muted("On branch main")}
          {muted("nothing to commit, working tree clean")}
        </>
      ) : (
        muted(`git: '${arg}' looks fine from here`)
      );
    case "pnpm":
    case "npm":
    case "bun":
      return arg === "test" ? (
        <div>
          <span className="text-emerald-400/80"> ✓</span>
          <span className="text-muted-foreground">
            {" "}
            128 tests passed (vitest, 1.4s)
          </span>
        </div>
      ) : (
        muted("dev server already running on :5173")
      );
    case "help":
      return muted("try: ls · pwd · echo · git status · pnpm test · clear");
    default:
      return (
        <div className="text-red-400/80">zsh: command not found: {bin}</div>
      );
  }
}

function OutputLine({
  delay,
  children,
}: {
  delay: number;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      className="block"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: reduceMotion ? 0 : delay, duration: 0.15 }}
    >
      {children}
    </motion.span>
  );
}

function Cursor() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return (
      <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-foreground/70" />
    );
  }
  return (
    <motion.span
      className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-foreground/70"
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
    />
  );
}

function useTypewriter(
  text: string,
  {
    startDelay,
    charDelay,
    enabled,
  }: { startDelay: number; charDelay: number; enabled: boolean },
) {
  const [count, setCount] = useState(enabled ? 0 : text.length);

  useEffect(() => {
    if (!enabled) return;
    let chars = 0;
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        chars += 1;
        setCount(chars);
        if (chars >= text.length) window.clearInterval(interval);
      }, charDelay);
    }, startDelay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [text, startDelay, charDelay, enabled]);

  return { typed: text.slice(0, count), done: count >= text.length };
}

import {
  ArrowUp,
  ChevronDown,
  Infinity as InfinityIcon,
  Plus,
  SquareTerminal,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export type AgentReply = {
  text: string;
  /** Optional mono "tool call" line rendered as a card above the text. */
  tool?: string;
};

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool?: string };

const DEFAULT_MESSAGES: Message[] = [
  {
    role: "user",
    content: "Wrap the editor and terminal in a vertical PanelGroup.",
  },
  {
    role: "assistant",
    tool: "edit App.tsx · +12 −3",
    content:
      'Nested a vertical PanelGroup inside the main pane — the terminal is now a collapsible bottom panel with side="end".',
  },
  { role: "user", content: "Nice. Can the terminal start collapsed?" },
  {
    role: "assistant",
    tool: 'terminal.collapse({ transition: "none" })',
    content:
      "Done — pass defaultCollapsed on the Panel, or drive it imperatively like I just did. Ask me to hide or show any panel.",
  },
];

export type AiChatProps = {
  /** Present when the composer is live. Returns the agent's reply; the panel
   *  shows a thinking indicator while it waits. */
  onSend?: (text: string) => AgentReply;
  /** Called on focus / send so the host can pause scripted driving. */
  onInteract?: () => void;
};

/** Cursor-style agent side panel. */
export function AiChat({ onSend, onInteract }: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const replyTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(replyTimer.current), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll reacts to content growth
  useEffect(() => {
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  const send = () => {
    const text = draft.trim();
    if (!text || !onSend || thinking) return;
    onInteract?.();
    setDraft("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setThinking(true);
    const reply = onSend(text);
    replyTimer.current = window.setTimeout(() => {
      setThinking(false);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: reply.text, tool: reply.tool },
      ]);
    }, 900);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-border pl-2.5 pr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Agent</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="New agent chat"
          onClick={() => {
            onInteract?.();
            window.clearTimeout(replyTimer.current);
            setThinking(false);
            setMessages([]);
          }}
        >
          <Plus className="size-3" />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
        <div className="space-y-2.5 px-2.5 py-2.5">
          {messages.length === 0 ? (
            <p className="pt-2 text-center text-[10px] text-muted-foreground/60">
              New chat. Ask me to hide, show, or resize any panel.
            </p>
          ) : null}
          {messages.map((m, i) => (
            <MessageBlock key={i} message={m} order={i} />
          ))}
          {thinking ? <ThinkingDots /> : null}
        </div>
      </ScrollArea>
      <Composer
        draft={draft}
        onDraftChange={setDraft}
        onSend={send}
        onInteract={onInteract}
        disabled={!onSend}
      />
    </div>
  );
}

function MessageBlock({ message, order }: { message: Message; order: number }) {
  const reduceMotion = useReducedMotion();
  // Only the seeded conversation staggers in; live messages appear at once.
  const delay = order < DEFAULT_MESSAGES.length ? 0.3 + order * 0.25 : 0;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
    >
      {message.role === "user" ? (
        <div className="rounded-md border border-border bg-card/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-foreground/90">
          {message.content}
        </div>
      ) : (
        <div className="space-y-1.5 px-0.5">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50">
            Thought briefly
          </div>
          {message.tool ? (
            <div className="flex items-center gap-1.5 overflow-hidden rounded-md border border-border/70 bg-card/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
              <SquareTerminal className="size-3 shrink-0 text-sky-400/80" />
              <span className="truncate">{message.tool}</span>
            </div>
          ) : null}
          <p className="text-[11px] leading-relaxed text-foreground/85">
            {message.content}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function ThinkingDots() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex items-center gap-1 px-0.5 py-1">
      {[0, 1, 2].map((i) =>
        reduceMotion ? (
          <span
            key={i}
            className="size-1 rounded-full bg-muted-foreground/70"
          />
        ) : (
          <motion.span
            key={i}
            className="size-1 rounded-full bg-muted-foreground/70"
            animate={{ y: [0, -2.5, 0], opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ),
      )}
    </div>
  );
}

function Composer({
  draft,
  onDraftChange,
  onSend,
  onInteract,
  disabled,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onInteract?: () => void;
  disabled: boolean;
}) {
  return (
    <div className="border-t border-border p-2">
      <div className="rounded-lg border border-border bg-background px-2 py-1.5">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onFocus={onInteract}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          disabled={disabled}
          aria-label="Message the agent"
          spellCheck={false}
          autoComplete="off"
          placeholder="Plan, build, ask anything…"
          className="w-full bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded border border-border/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
            <InfinityIcon className="size-2.5" />
            Agent
            <ChevronDown className="size-2.5" />
          </span>
          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
            Fable 5
            <ChevronDown className="size-2.5" />
          </span>
          <Button
            size="icon-xs"
            aria-label="Send"
            onClick={onSend}
            className="ml-auto"
            disabled={disabled || !draft.trim()}
          >
            <ArrowUp className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

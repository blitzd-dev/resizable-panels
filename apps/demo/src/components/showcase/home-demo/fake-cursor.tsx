import { motion, useMotionValue } from "motion/react";
import { type Ref, useImperativeHandle, useRef, useState } from "react";

export type CursorGlyph = "pointer" | "col-resize" | "row-resize";

/**
 * Imperative surface for the hero's scripted cursor. All coordinates are
 * viewport (client) coordinates — the component converts to its own overlay
 * space internally, so choreography code can work straight off
 * getBoundingClientRect without knowing where the overlay sits.
 */
export type FakeCursorHandle = {
  /** Jump instantly to a point. Movement easing is the caller's job. */
  placeAt: (clientX: number, clientY: number) => void;
  /** Last placed point, or null before the first placement. */
  position: () => { x: number; y: number } | null;
  setVisible: (visible: boolean) => void;
  isVisible: () => boolean;
  /** Squeezes the glyph while "the button is down". */
  setPressed: (pressed: boolean) => void;
  setGlyph: (glyph: CursorGlyph) => void;
};

/**
 * The visual cursor for the hero's drag choreography: a pointer-events-none
 * overlay holding a macOS-style arrow that swaps to a resize glyph while
 * grabbing a seam. Purely presentational — drive-drag.ts owns all motion
 * and timing through the imperative handle.
 */
export function FakeCursor({ ref }: { ref: Ref<FakeCursorHandle> }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const visibleRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [glyph, setGlyph] = useState<CursorGlyph>("pointer");

  useImperativeHandle(
    ref,
    () => ({
      placeAt: (clientX, clientY) => {
        posRef.current = { x: clientX, y: clientY };
        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;
        x.set(clientX - rect.left);
        y.set(clientY - rect.top);
      },
      position: () => posRef.current,
      setVisible: (v) => {
        visibleRef.current = v;
        setVisible(v);
      },
      isVisible: () => visibleRef.current,
      setPressed,
      setGlyph,
    }),
    [x, y],
  );

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
    >
      <motion.div
        style={{ x, y }}
        initial={false}
        animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.7 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="absolute left-0 top-0"
      >
        <PointerGlyph hidden={glyph !== "pointer"} pressed={pressed} />
        <ResizeGlyph
          hidden={glyph === "pointer"}
          vertical={glyph === "row-resize"}
          pressed={pressed}
        />
      </motion.div>
    </div>
  );
}

const GLYPH_SHADOW = "drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.4))";

/** Classic arrow, drawn so its tip sits on the handle's (x, y) point.
 *  Black fill with a white edge stays legible on both themes — same trick
 *  real OS cursors use. */
function PointerGlyph({
  hidden,
  pressed,
}: {
  hidden: boolean;
  pressed: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      className="absolute"
      style={{
        left: -5.5,
        top: -2.5,
        opacity: hidden ? 0 : 1,
        transform: `scale(${pressed ? 0.84 : 1})`,
        transformOrigin: "6px 4px",
        transition: "opacity 120ms, transform 110ms ease-out",
        filter: GLYPH_SHADOW,
      }}
    >
      <path
        d="M6 3 L6 19.5 L9.9 15.6 L12.2 21 L14.8 19.9 L12.5 14.5 L18 14.5 Z"
        fill="#000"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** col-resize style glyph (◄|►), centered on the handle's (x, y) point.
 *  `vertical` rotates it for row seams; `pressed` squeezes it slightly so
 *  the grab moment reads as a click. */
function ResizeGlyph({
  hidden,
  vertical,
  pressed,
}: {
  hidden: boolean;
  vertical: boolean;
  pressed: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="absolute"
      style={{
        left: -12,
        top: -12,
        opacity: hidden ? 0 : 1,
        transform: `${vertical ? "rotate(90deg) " : ""}scale(${pressed ? 0.85 : 1})`,
        transition: "opacity 120ms, transform 130ms ease-out",
        filter: GLYPH_SHADOW,
      }}
    >
      <g fill="#000" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round">
        <rect x="10.9" y="5.5" width="2.2" height="13" rx="0.8" />
        <path d="M8.2 8.6 L3.6 12 L8.2 15.4 Z" />
        <path d="M15.8 8.6 L20.4 12 L15.8 15.4 Z" />
      </g>
    </svg>
  );
}

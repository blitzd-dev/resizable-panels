// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSkipAnimation } from "../use-skip-animation";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let rafQueue: Map<number, FrameRequestCallback>;
let rafId: number;
const flushFrame = () => {
  // One frame: run only the callbacks scheduled before this flush.
  const cbs = [...rafQueue.values()];
  rafQueue.clear();
  act(() => {
    for (const cb of cbs) cb(0);
  });
};

let container: HTMLDivElement;
let root: Root;
let current: { skip: boolean; setSkip: (s: boolean) => void };

function Harness() {
  const [skip, setSkip] = useSkipAnimation();
  current = { skip, setSkip };
  return null;
}

beforeEach(() => {
  rafQueue = new Map();
  rafId = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.set(++rafId, cb);
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue.delete(id);
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("useSkipAnimation", () => {
  it("stays raised through the first frame and clears after the second", () => {
    act(() => current.setSkip(true));
    expect(current.skip).toBe(true);

    flushFrame(); // first rAF: schedules the second, flag still raised
    expect(current.skip).toBe(true);

    flushFrame(); // second rAF: clears
    expect(current.skip).toBe(false);
  });

  it("re-raising mid-countdown restarts the two-frame window", () => {
    act(() => current.setSkip(true));
    flushFrame(); // first frame elapses

    act(() => current.setSkip(true)); // same value: state unchanged, no new effect
    act(() => current.setSkip(false));
    act(() => current.setSkip(true)); // genuinely re-raised: effect restarts

    flushFrame();
    expect(current.skip).toBe(true); // only one frame of the new window elapsed
    flushFrame();
    expect(current.skip).toBe(false);
  });

  it("stays false when never raised", () => {
    expect(current.skip).toBe(false);
    flushFrame();
    flushFrame();
    expect(current.skip).toBe(false);
  });
});

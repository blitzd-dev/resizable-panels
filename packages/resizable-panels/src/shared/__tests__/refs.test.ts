import { describe, expect, it, vi } from "vitest";
import { composeRefs } from "../refs";

describe("composeRefs (§9)", () => {
  it("retains and invokes React 19 callback-ref cleanups", () => {
    const cleanup = vi.fn();
    const consumer = vi.fn(() => cleanup);
    const internal = { current: null as string | null };
    const composed = composeRefs<string>(internal, consumer);

    const detach = composed("element");
    expect(internal.current).toBe("element");
    expect(consumer).toHaveBeenCalledWith("element");
    expect(cleanup).not.toHaveBeenCalled();

    // React 19 protocol: React invokes the returned cleanup on detach.
    detach?.();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(internal.current).toBeNull();
    // The consumer with a cleanup never receives a null call.
    expect(consumer).toHaveBeenCalledTimes(1);
  });

  it("preserves React 18 null-detach for cleanup-less consumers", () => {
    const calls: (string | null)[] = [];
    const consumer = (value: string | null) => {
      calls.push(value);
    };
    const internal = { current: null as string | null };
    const composed = composeRefs<string>(internal, consumer);

    composed("element");
    expect(calls).toEqual(["element"]);
    // React 18 protocol: React calls the composed ref with null on detach.
    composed(null);
    expect(calls).toEqual(["element", null]);
    expect(internal.current).toBeNull();
  });

  it("does not leak the previous attachment on re-attach without detach", () => {
    const cleanup = vi.fn();
    const consumer = vi.fn(() => cleanup);
    const composed = composeRefs<string>(consumer);

    composed("first");
    composed("second");
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(consumer).toHaveBeenLastCalledWith("second");
  });
});

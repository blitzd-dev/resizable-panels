import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANEL_ANIMATION,
  PANEL_TRANSITION,
  PANEL_TRANSITION_EASING,
  PANEL_TRANSITION_MS,
  resolvePanelAnimation,
} from "../timing";

describe("resolvePanelAnimation (R-16)", () => {
  it("resolves the library defaults when nothing is configured", () => {
    const resolved = resolvePanelAnimation(false, undefined, undefined);
    expect(resolved).toEqual({
      enabled: true,
      durationMs: PANEL_TRANSITION_MS,
      easing: PANEL_TRANSITION_EASING,
      transition: PANEL_TRANSITION,
    });
    expect(DEFAULT_PANEL_ANIMATION).toEqual(resolved);
  });

  it("disables while keeping the default numbers well-defined for dependent math", () => {
    const resolved = resolvePanelAnimation(true, undefined, undefined);
    expect(resolved.enabled).toBe(false);
    // The threshold spring divides by durationMs even when transitions are
    // disabled, so the resolved duration must stay a valid number.
    expect(resolved.durationMs).toBe(PANEL_TRANSITION_MS);
  });

  it("applies partial overrides independently", () => {
    expect(resolvePanelAnimation(false, 500, undefined)).toMatchObject({
      durationMs: 500,
      easing: PANEL_TRANSITION_EASING,
      transition: `500ms ${PANEL_TRANSITION_EASING}`,
    });
    expect(resolvePanelAnimation(false, undefined, "linear")).toMatchObject({
      durationMs: PANEL_TRANSITION_MS,
      easing: "linear",
      transition: `${PANEL_TRANSITION_MS}ms linear`,
    });
    expect(resolvePanelAnimation(false, 120, "ease-out")).toMatchObject({
      transition: "120ms ease-out",
    });
  });

  it("falls back to the default duration for non-positive or non-finite values", () => {
    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolvePanelAnimation(false, invalid, undefined).durationMs).toBe(
        PANEL_TRANSITION_MS,
      );
    }
    // Runtime misuse: a string smuggled through untyped code.
    expect(
      resolvePanelAnimation(false, "fast" as unknown as number, undefined)
        .durationMs,
    ).toBe(PANEL_TRANSITION_MS);
  });

  it("falls back to the default easing for non-string or blank values", () => {
    expect(resolvePanelAnimation(false, undefined, "").easing).toBe(
      PANEL_TRANSITION_EASING,
    );
    expect(resolvePanelAnimation(false, undefined, "   ").easing).toBe(
      PANEL_TRANSITION_EASING,
    );
    expect(
      resolvePanelAnimation(false, undefined, 5 as unknown as string).easing,
    ).toBe(PANEL_TRANSITION_EASING);
  });
});

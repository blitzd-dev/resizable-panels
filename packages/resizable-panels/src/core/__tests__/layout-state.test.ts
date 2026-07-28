import { describe, expect, it } from "vitest";
import {
  createPanelGroupLayout,
  panelGroupLayoutsEqual,
  panelValuesEqual,
  parsePersistedValue,
  reconcilePanelGroupLayout,
  serializePersistedValue,
} from "../layout-state";

describe("panel group layout state", () => {
  it("treats prototype-sensitive ids as ordinary own panel keys", () => {
    const panels = Object.fromEntries([
      ["__proto__", { size: 100 }],
      ["constructor", { size: 200, collapsed: true }],
      ["prototype", { size: 300 }],
    ]);
    const layout = createPanelGroupLayout(
      "horizontal",
      ["prototype", "__proto__", "constructor"],
      panels,
    );

    expect(layout.order).toEqual(["prototype", "__proto__", "constructor"]);
    expect(Object.keys(layout.panels)).toEqual([
      "__proto__",
      "constructor",
      "prototype",
    ]);
    expect(Object.hasOwn(layout.panels, "__proto__")).toBe(true);
    expect(layout.panels.__proto__).toEqual({ size: 100 });
    expect(layout.panels.constructor).toEqual({
      size: 200,
      collapsed: true,
    });
    expect(layout.panels.prototype).toEqual({ size: 300 });
  });

  it("does not read inherited properties as panel state", () => {
    const layout = createPanelGroupLayout("horizontal", ["constructor"], {});
    expect(layout.order).toEqual([]);
    expect(Object.keys(layout.panels)).toEqual([]);

    const reconciled = reconcilePanelGroupLayout(
      {
        orientation: "horizontal",
        order: ["constructor"],
        panels: {},
      },
      new Map([
        ["constructor", { minSize: 0, maxSize: 400, collapsible: true }],
      ]),
    );
    expect(Object.keys(reconciled)).toEqual([]);
  });

  it("creates a deterministic snapshot", () => {
    expect(
      createPanelGroupLayout("horizontal", ["b", "a", "b"], {
        a: { size: 100 },
        b: { size: 200, collapsed: true },
      }),
    ).toEqual({
      orientation: "horizontal",
      order: ["b", "a"],
      panels: { a: { size: 100 }, b: { size: 200, collapsed: true } },
    });
  });

  it("reconciles missing panels, kinds, and changed bounds", () => {
    const layout = createPanelGroupLayout(
      "horizontal",
      ["old", "nav", "main"],
      {
        old: { size: 10 },
        nav: { size: 20, collapsed: true },
        main: { size: 2000, collapsed: true },
      },
    );
    const available = new Map([
      ["nav", { minSize: 100, maxSize: 400, collapsible: true }],
      ["main", { minSize: 200, maxSize: 900, collapsible: false }],
    ]);
    expect(reconcilePanelGroupLayout(layout, available)).toEqual({
      nav: { size: 100, collapsed: true },
      main: { size: 900 },
    });
  });

  it("compares semantic values independently of key order and identity", () => {
    expect(
      panelValuesEqual(
        { a: { size: 100 }, b: { size: 200, collapsed: true } },
        { b: { size: 200, collapsed: true }, a: { size: 100 } },
      ),
    ).toBe(true);
    expect(panelValuesEqual({ a: { size: 100 } }, { a: { size: 101 } })).toBe(
      false,
    );
    expect(
      panelValuesEqual(
        { a: { size: 100 } },
        { a: { size: 100 }, b: { size: 1 } },
      ),
    ).toBe(false);

    const a = createPanelGroupLayout("vertical", ["a"], { a: { size: 100 } });
    const b = createPanelGroupLayout("vertical", ["a"], { a: { size: 100 } });
    expect(panelGroupLayoutsEqual(a, b)).toBe(true);
    b.panels.a.size = 101;
    expect(panelGroupLayoutsEqual(a, b)).toBe(false);
  });
});

describe("persisted value document (v1)", () => {
  it("round-trips through serialize/parse with prototype-sensitive ids", () => {
    const panels = Object.fromEntries([
      ["__proto__", { size: 80 }],
      ["nav", { size: 240, collapsed: true }],
    ]);
    const raw = serializePersistedValue("horizontal", panels);
    expect(JSON.parse(raw).version).toBe(1);
    const parsed = parsePersistedValue(JSON.parse(raw), "horizontal");
    expect(parsed).not.toBeNull();
    expect(Object.hasOwn(parsed!, "__proto__")).toBe(true);
    expect(parsed!.__proto__).toEqual({ size: 80 });
    expect(parsed!.nav).toEqual({ size: 240, collapsed: true });
  });

  it("rejects an orientation mismatch", () => {
    const raw = serializePersistedValue("horizontal", { nav: { size: 240 } });
    expect(parsePersistedValue(JSON.parse(raw), "vertical")).toBeNull();
  });

  it("rejects every pre-release format instead of migrating", () => {
    // Unversioned {open} shape.
    expect(
      parsePersistedValue(
        { nav: { size: 240, open: false }, main: { size: 760 } },
        "horizontal",
      ),
    ).toBeNull();
    // Pre-release version 2 envelope with order.
    expect(
      parsePersistedValue(
        {
          version: 2,
          orientation: "horizontal",
          order: ["nav"],
          panels: { nav: { size: 240 } },
        },
        "horizontal",
      ),
    ).toBeNull();
    // Unknown future version.
    expect(
      parsePersistedValue(
        { version: 7, orientation: "horizontal", panels: {} },
        "horizontal",
      ),
    ).toBeNull();
  });

  it("rejects malformed documents rather than partially accepting them", () => {
    expect(parsePersistedValue(null, "horizontal")).toBeNull();
    expect(parsePersistedValue([1, 2], "horizontal")).toBeNull();
    expect(
      parsePersistedValue(
        {
          version: 1,
          orientation: "horizontal",
          panels: { nav: { size: "wide" } },
        },
        "horizontal",
      ),
    ).toBeNull();
    expect(
      parsePersistedValue(
        {
          version: 1,
          orientation: "horizontal",
          panels: { nav: { size: 240, collapsed: "yes" } },
        },
        "horizontal",
      ),
    ).toBeNull();
    // One bad entry invalidates the whole document — partial acceptance
    // would drop persisted panels and then overwrite the record.
    expect(
      parsePersistedValue(
        {
          version: 1,
          orientation: "horizontal",
          panels: { good: { size: 100 }, bad: {} },
        },
        "horizontal",
      ),
    ).toBeNull();
  });
});

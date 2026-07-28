import { describe, expect, it, vi } from "vitest";
import type { PanelControls } from "../../types";
import { createKeyedStore } from "../keyed-store";
import { createPanelStore } from "../panel-store";

describe("createKeyedStore", () => {
  it("notifies only listeners of the changed key", () => {
    const store = createKeyedStore<string, number>();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribeKey("a", a);
    store.subscribeKey("b", b);

    store.set("a", 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("skips notification when the value is unchanged", () => {
    const store = createKeyedStore<string, number>();
    const a = vi.fn();
    const any = vi.fn();
    store.set("a", 1);
    store.subscribeKey("a", a);
    store.subscribeAny(any);

    store.set("a", 1);
    expect(a).not.toHaveBeenCalled();
    expect(any).not.toHaveBeenCalled();
    expect(store.version()).toBe(1);
  });

  it("respects a custom equality function", () => {
    const store = createKeyedStore<string, number>(
      (x, y) => Math.abs(x - y) <= 0.5,
    );
    const a = vi.fn();
    store.set("a", 10);
    store.subscribeKey("a", a);

    store.set("a", 10.3);
    expect(a).not.toHaveBeenCalled();
    expect(store.get("a")).toBe(10);

    store.set("a", 11);
    expect(a).toHaveBeenCalledTimes(1);
    expect(store.get("a")).toBe(11);
  });

  it("replaceAll notifies changed, added, and removed keys only", () => {
    const store = createKeyedStore<string, number>();
    store.replaceAll(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    );

    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const d = vi.fn();
    store.subscribeKey("a", a);
    store.subscribeKey("b", b);
    store.subscribeKey("c", c);
    store.subscribeKey("d", d);

    // a unchanged, b changed, c removed, d added.
    store.replaceAll(
      new Map([
        ["a", 1],
        ["b", 20],
        ["d", 4],
      ]),
    );
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
    expect(d).toHaveBeenCalledTimes(1);
    expect(store.get("c")).toBeUndefined();
    expect(store.get("d")).toBe(4);
  });

  it("replaceAll with identical contents is a no-op", () => {
    const store = createKeyedStore<string, number>();
    store.replaceAll(new Map([["a", 1]]));
    const versionBefore = store.version();
    const any = vi.fn();
    store.subscribeAny(any);

    store.replaceAll(new Map([["a", 1]]));
    expect(any).not.toHaveBeenCalled();
    expect(store.version()).toBe(versionBefore);
  });

  it("delete notifies and unsubscribe stops notifications", () => {
    const store = createKeyedStore<string, number>();
    store.set("a", 1);
    const a = vi.fn();
    const off = store.subscribeKey("a", a);

    store.delete("a");
    expect(a).toHaveBeenCalledTimes(1);
    expect(store.delete("a")).toBeUndefined(); // missing key: silent no-op

    off();
    store.set("a", 2);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("a listener that unsubscribes mid-notification doesn't break iteration", () => {
    const store = createKeyedStore<string, number>();
    const calls: string[] = [];
    const off1 = store.subscribeAny(() => {
      calls.push("first");
      off1();
    });
    store.subscribeAny(() => calls.push("second"));

    store.set("a", 1);
    expect(calls).toEqual(["first", "second"]);
  });
});

describe("createPanelStore", () => {
  const controls = (size: number): PanelControls => ({
    kind: "docked",
    side: "start",
    orientation: "horizontal",
    size,
    renderedSize: size,
    collapsed: false,
    collapsible: true,
    disabled: false,
    isReady: true,
    constraints: { minSize: 0, maxSize: 1000, collapsedSize: 0 },
    setSize: () => ({ applied: true, value: size, constrained: false }),
    maximize: () => ({ applied: true, value: size, constrained: false }),
    setCollapsed: (next) => ({ applied: true, value: next }),
    collapse: () => ({ applied: true, value: true }),
    expand: () => ({ applied: true, value: false }),
    toggle: () => ({ applied: true, value: true }),
    reset: () => ({ applied: true, value: { size } }),
  });

  /** A published group: returns its token after wiring it under `groupId`. */
  const publishGroup = (
    store: ReturnType<typeof createPanelStore>,
    groupId: string,
  ) => {
    const token = {};
    store.publishGroup(groupId, token, token);
    return token;
  };

  it("skips commit when controls are shallow-equal", () => {
    const store = createPanelStore();
    const owner = {};
    const group = publishGroup(store, "g");
    const cb = vi.fn();
    const c = controls(100);
    store.registerPanel(group, "p", owner, c);
    store.subscribe({ groupId: "g", panelId: "p" }, cb);

    // Fresh object, same fields + same constraint field values.
    store.registerPanel(group, "p", owner, {
      ...c,
      constraints: { ...c.constraints },
    });
    expect(cb).not.toHaveBeenCalled();
    expect(store.get({ groupId: "g", panelId: "p" })).toBe(c);

    store.registerPanel(group, "p", owner, controls(150));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("group snapshots are reference-stable between changes", () => {
    const store = createPanelStore();
    const owner = {};
    const group = publishGroup(store, "g");
    store.registerPanel(group, "p", owner, controls(100));
    const snap1 = store.getGroupSnapshot("g");
    expect(store.getGroupSnapshot("g")).toBe(snap1);

    store.registerPanel(group, "p", owner, controls(200));
    const snap2 = store.getGroupSnapshot("g");
    expect(snap2).not.toBe(snap1);
    expect(snap2.p.size).toBe(200);
    expect(snap1.p.size).toBe(100); // old snapshot untouched

    expect(store.getGroupSnapshot("unpublished")).toBe(
      store.getGroupSnapshot("also-unpublished"),
    ); // stable empty record
  });

  it("stores prototype-sensitive panelIds without exposing inherited phantom panels", () => {
    const store = createPanelStore();
    const owners = [{}, {}, {}];
    const group = publishGroup(store, "g");
    const ids = ["__proto__", "constructor", "prototype"];

    expect(store.getGroupSnapshot("g").constructor).toBeUndefined();
    ids.forEach((panelId, index) => {
      store.registerPanel(
        group,
        panelId,
        owners[index],
        controls((index + 1) * 100),
      );
    });

    const snapshot = store.getGroupSnapshot("g");
    expect(Object.getPrototypeOf(snapshot)).toBeNull();
    expect(Object.keys(snapshot)).toEqual(ids);
    expect(snapshot.__proto__.size).toBe(100);
    // biome-ignore lint/complexity/useLiteralKeys: bracket lookup selects the string index signature instead of Object.constructor.
    expect(snapshot["constructor"].size).toBe(200);
    expect(snapshot.prototype.size).toBe(300);

    ids.forEach((panelId, index) => {
      store.unregisterPanel(group, panelId, owners[index]);
    });
    expect(Object.keys(store.getGroupSnapshot("g"))).toEqual([]);
    expect(store.getGroupSnapshot("g").constructor).toBeUndefined();
  });

  it("repeated local panelIds in different groups resolve exactly, never by mount order", () => {
    const store = createPanelStore();
    const leftOwner = {};
    const rightOwner = {};
    const left = publishGroup(store, "left");
    const right = publishGroup(store, "right");
    const leftControls = controls(100);
    const rightControls = controls(200);

    store.registerPanel(left, "p", leftOwner, leftControls);
    store.registerPanel(right, "p", rightOwner, rightControls);

    expect(store.get({ groupId: "left", panelId: "p" })).toBe(leftControls);
    expect(store.get({ groupId: "right", panelId: "p" })).toBe(rightControls);
    expect(store.get({ groupId: "elsewhere", panelId: "p" })).toBeUndefined();
  });

  it("never retargets a locator after its panel unmounts", () => {
    const store = createPanelStore();
    const leftOwner = {};
    const rightOwner = {};
    const left = publishGroup(store, "left");
    const right = publishGroup(store, "right");
    const leftListener = vi.fn();

    store.registerPanel(left, "p", leftOwner, controls(100));
    store.registerPanel(right, "p", rightOwner, controls(200));
    store.subscribe({ groupId: "left", panelId: "p" }, leftListener);

    store.unregisterPanel(left, "p", leftOwner);
    expect(store.get({ groupId: "left", panelId: "p" })).toBeUndefined();
    // The other group's same-named panel is untouched and NOT adopted.
    expect(store.get({ groupId: "right", panelId: "p" })?.size).toBe(200);
    expect(leftListener).toHaveBeenCalledTimes(1);
  });

  it("diagnoses duplicate panelIds within one group and keeps the first owner authoritative", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createPanelStore();
    const firstOwner = {};
    const secondOwner = {};
    const group = publishGroup(store, "g");
    const first = controls(100);

    store.registerPanel(group, "p", firstOwner, first);
    // Strict Mode re-registration of the SAME owner is not a duplicate.
    store.registerPanel(group, "p", firstOwner, first);
    expect(warn).not.toHaveBeenCalled();

    store.registerPanel(group, "p", secondOwner, controls(200));
    store.registerPanel(group, "p", secondOwner, controls(250));
    expect(store.get({ groupId: "g", panelId: "p" })).toBe(first);
    expect(warn).toHaveBeenCalledTimes(1);

    store.unregisterPanel(group, "p", firstOwner);
    expect(store.get({ groupId: "g", panelId: "p" })?.size).toBe(250);

    store.unregisterPanel(group, "p", secondOwner);
    expect(store.get({ groupId: "g", panelId: "p" })).toBeUndefined();
    warn.mockRestore();
  });

  it("re-resolves locator subscriptions when the groupId publication changes", () => {
    const store = createPanelStore();
    const ownerA = {};
    const ownerB = {};
    const groupA = {};
    const groupB = {};
    const listener = vi.fn();

    store.registerPanel(groupA, "p", ownerA, controls(100));
    store.registerPanel(groupB, "p", ownerB, controls(200));
    store.subscribe({ groupId: "workspace", panelId: "p" }, listener);
    expect(store.get({ groupId: "workspace", panelId: "p" })).toBeUndefined();

    store.publishGroup("workspace", groupA, groupA);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get({ groupId: "workspace", panelId: "p" })?.size).toBe(100);

    // A later panel change in the newly resolved group notifies too.
    store.registerPanel(groupA, "p", ownerA, controls(150));
    expect(listener).toHaveBeenCalledTimes(2);

    store.unpublishGroup("workspace", groupA);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(store.get({ groupId: "workspace", panelId: "p" })).toBeUndefined();

    store.publishGroup("workspace", groupB, groupB);
    expect(store.get({ groupId: "workspace", panelId: "p" })?.size).toBe(200);
  });

  it("diagnoses duplicate groupIds and keeps the first publisher authoritative", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createPanelStore();
    const ownerA = {};
    const ownerB = {};
    const groupA = {};
    const groupB = {};

    store.registerPanel(groupA, "p", ownerA, controls(100));
    store.registerPanel(groupB, "p", ownerB, controls(200));

    store.publishGroup("workspace", groupA, groupA);
    // Strict Mode re-publication of the SAME owner is not a duplicate.
    store.publishGroup("workspace", groupA, groupA);
    expect(warn).not.toHaveBeenCalled();

    store.publishGroup("workspace", groupB, groupB);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(store.get({ groupId: "workspace", panelId: "p" })?.size).toBe(100);

    // First publisher unmounting hands resolution to the surviving one.
    store.unpublishGroup("workspace", groupA);
    expect(store.get({ groupId: "workspace", panelId: "p" })?.size).toBe(200);
    warn.mockRestore();
  });
});

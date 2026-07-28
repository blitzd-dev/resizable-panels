import { describe, expect, it } from "vitest";
import type { PanelStorage } from "../../types";
import { enqueuePersistenceWrite } from "../persistence-write";

type DeferredWrite = {
  key: string;
  value: string;
  status: "pending" | "resolved" | "rejected";
  resolve: () => void;
  reject: (error: unknown) => void;
};

function deferredStorage(name = "storage") {
  const writes: DeferredWrite[] = [];
  const stored = new Map<string, string>();
  const calls: string[] = [];
  let active = 0;
  let maxActive = 0;
  const storage: PanelStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem(key, value) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      calls.push(`${name}:${key}:${value}:start`);
      return new Promise<void>((resolve, reject) => {
        const write: DeferredWrite = {
          key,
          value,
          status: "pending",
          resolve() {
            if (write.status !== "pending") return;
            write.status = "resolved";
            active -= 1;
            stored.set(key, value);
            calls.push(`${name}:${key}:${value}:resolve`);
            resolve();
          },
          reject(error) {
            if (write.status !== "pending") return;
            write.status = "rejected";
            active -= 1;
            calls.push(`${name}:${key}:${value}:reject`);
            reject(error);
          },
        };
        writes.push(write);
      });
    },
  };
  return {
    storage,
    writes,
    stored,
    calls,
    get active() {
      return active;
    },
    get maxActive() {
      return maxActive;
    },
  };
}

async function tick(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("enqueuePersistenceWrite", () => {
  it("serializes adapter calls and fulfills requests in revision order", async () => {
    const adapter = deferredStorage();
    const older = enqueuePersistenceWrite(adapter.storage, "layout", "200");
    const newer = enqueuePersistenceWrite(adapter.storage, "layout", "300");

    expect(adapter.writes.map((write) => write.value)).toEqual(["200"]);
    expect(adapter.maxActive).toBe(1);
    adapter.writes[0].resolve();
    await tick();
    expect(adapter.writes.map((write) => write.value)).toEqual(["200", "300"]);
    expect(adapter.stored.get("layout")).toBe("200");

    adapter.writes[1].resolve();
    await expect(older).resolves.toEqual({
      status: "success",
      revision: 1,
      written: true,
    });
    await expect(newer).resolves.toEqual({
      status: "success",
      revision: 2,
      written: true,
    });
    expect(adapter.stored.get("layout")).toBe("300");
    expect(adapter.maxActive).toBe(1);
    expect(adapter.calls).toEqual([
      "storage:layout:200:start",
      "storage:layout:200:resolve",
      "storage:layout:300:start",
      "storage:layout:300:resolve",
    ]);
  });

  it("bounds a slow queue to one active and one replaceable latest request", async () => {
    const adapter = deferredStorage();
    const active = enqueuePersistenceWrite(adapter.storage, "layout", "200");
    const superseded = enqueuePersistenceWrite(
      adapter.storage,
      "layout",
      "250",
    );
    const latest = enqueuePersistenceWrite(adapter.storage, "layout", "300");

    await expect(superseded).resolves.toEqual({
      status: "superseded",
      revision: 2,
    });
    expect(adapter.writes.map((write) => write.value)).toEqual(["200"]);
    expect(adapter.active).toBe(1);
    adapter.writes[0].resolve();
    await tick();
    expect(adapter.writes.map((write) => write.value)).toEqual(["200", "300"]);
    expect(adapter.active).toBe(1);
    adapter.writes[1].resolve();
    await Promise.all([active, latest]);
    expect(adapter.stored.get("layout")).toBe("300");
    expect(adapter.maxActive).toBe(1);
  });

  it("dedupes only values that completed successfully", async () => {
    const adapter = deferredStorage();
    const first = enqueuePersistenceWrite(adapter.storage, "layout", "200");
    adapter.writes[0].resolve();
    await expect(first).resolves.toMatchObject({
      status: "success",
      written: true,
    });

    await expect(
      enqueuePersistenceWrite(adapter.storage, "layout", "200"),
    ).resolves.toEqual({
      status: "success",
      revision: 2,
      written: false,
    });
    expect(adapter.writes).toHaveLength(1);

    const failure = new Error("offline");
    const failed = enqueuePersistenceWrite(adapter.storage, "layout", "300");
    adapter.writes[1].reject(failure);
    await expect(failed).resolves.toEqual({
      status: "error",
      revision: 3,
      error: failure,
    });

    const retry = enqueuePersistenceWrite(adapter.storage, "layout", "300");
    expect(adapter.writes.map((write) => write.value)).toEqual([
      "200",
      "300",
      "300",
    ]);
    adapter.writes[2].resolve();
    await expect(retry).resolves.toMatchObject({
      status: "success",
      revision: 4,
      written: true,
    });
    expect(adapter.stored.get("layout")).toBe("300");
  });

  it("continues with the latest pending value after an active failure", async () => {
    const adapter = deferredStorage();
    const failed = enqueuePersistenceWrite(adapter.storage, "layout", "200");
    const latest = enqueuePersistenceWrite(adapter.storage, "layout", "300");
    const failure = new Error("first failed");
    adapter.writes[0].reject(failure);
    await tick();

    expect(adapter.writes.map((write) => write.value)).toEqual(["200", "300"]);
    adapter.writes[1].resolve();
    await expect(failed).resolves.toEqual({
      status: "error",
      revision: 1,
      error: failure,
    });
    await expect(latest).resolves.toMatchObject({ status: "success" });
    expect(adapter.stored.get("layout")).toBe("300");
  });

  it("retries the newest intent when it matches a failing active value", async () => {
    const adapter = deferredStorage();
    const active = enqueuePersistenceWrite(adapter.storage, "layout", "200");
    const superseded = enqueuePersistenceWrite(
      adapter.storage,
      "layout",
      "300",
    );
    const newest = enqueuePersistenceWrite(adapter.storage, "layout", "200");

    await expect(superseded).resolves.toEqual({
      status: "superseded",
      revision: 2,
    });
    adapter.writes[0].reject(new Error("active failed"));
    await tick();
    expect(adapter.writes.map((write) => write.value)).toEqual(["200", "200"]);
    adapter.writes[1].resolve();
    await expect(active).resolves.toMatchObject({ status: "error" });
    await expect(newest).resolves.toMatchObject({
      status: "success",
      revision: 3,
      written: true,
    });
    expect(adapter.stored.get("layout")).toBe("200");
  });

  it("isolates queues by both storage object identity and key", async () => {
    const first = deferredStorage("first");
    const second = deferredStorage("second");

    const firstA = enqueuePersistenceWrite(first.storage, "a", "first-a");
    const firstB = enqueuePersistenceWrite(first.storage, "b", "first-b");
    const secondA = enqueuePersistenceWrite(second.storage, "a", "second-a");

    expect(first.writes.map((write) => write.key)).toEqual(["a", "b"]);
    expect(first.active).toBe(2);
    expect(second.writes.map((write) => write.key)).toEqual(["a"]);
    expect(second.active).toBe(1);

    first.writes[0].resolve();
    first.writes[1].resolve();
    second.writes[0].resolve();
    await Promise.all([firstA, firstB, secondA]);
    expect(first.stored.get("a")).toBe("first-a");
    expect(first.stored.get("b")).toBe("first-b");
    expect(second.stored.get("a")).toBe("second-a");
  });

  it("turns synchronous adapter throws into fulfilled errors and recovers", async () => {
    let shouldThrow = true;
    const values: string[] = [];
    const storage: PanelStorage = {
      getItem: () => null,
      setItem(_key, value) {
        if (shouldThrow) {
          shouldThrow = false;
          throw new Error("quota");
        }
        values.push(value);
      },
    };

    await expect(
      enqueuePersistenceWrite(storage, "layout", "200"),
    ).resolves.toMatchObject({ status: "error", revision: 1 });
    await expect(
      enqueuePersistenceWrite(storage, "layout", "300"),
    ).resolves.toEqual({
      status: "success",
      revision: 2,
      written: true,
    });
    expect(values).toEqual(["300"]);
  });
});

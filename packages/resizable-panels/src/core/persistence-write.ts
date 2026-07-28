import type { PanelStorage } from "../types.js";

export type PersistenceWriteResult =
  | {
      status: "success";
      revision: number;
      /** False when the value already completed successfully for this queue. */
      written: boolean;
    }
  | { status: "superseded"; revision: number }
  | { status: "error"; revision: number; error: unknown };

type WriteRequest = {
  revision: number;
  value: string;
  promise: Promise<PersistenceWriteResult>;
  resolve: (result: PersistenceWriteResult) => void;
};

type WriteCoordinator = {
  storage: PanelStorage;
  key: string;
  nextRevision: number;
  active: WriteRequest | null;
  pending: WriteRequest | null;
  lastSuccessfulValue: string | undefined;
};

// Storage identity is part of persistence identity. A WeakMap lets a queue
// survive any individual PanelGroup without retaining an unused adapter.
const coordinators = new WeakMap<PanelStorage, Map<string, WriteCoordinator>>();

/**
 * Enqueue a storage write in the adapter/key-specific queue.
 *
 * There is at most one adapter call in flight and one pending request. A new
 * pending value supersedes the previous pending value, so a slow backend
 * cannot create an unbounded backlog. The returned promise never rejects.
 */
export function enqueuePersistenceWrite(
  storage: PanelStorage,
  key: string,
  value: string,
): Promise<PersistenceWriteResult> {
  const coordinator = getCoordinator(storage, key);
  const revision = coordinator.nextRevision++;

  if (
    !coordinator.active &&
    !coordinator.pending &&
    coordinator.lastSuccessfulValue === value
  ) {
    return Promise.resolve({ status: "success", revision, written: false });
  }

  if (coordinator.pending?.value === value) {
    return coordinator.pending.promise;
  }
  if (coordinator.active?.value === value) {
    if (!coordinator.pending) return coordinator.active.promise;

    // This value is newest again after a different value was queued. Keep a
    // retry request behind the active call: a successful active write will
    // dedupe it, while a failed active write must not lose the latest intent.
    const request = createRequest(revision, value);
    supersedePending(coordinator);
    coordinator.pending = request;
    return request.promise;
  }

  const request = createRequest(revision, value);
  if (coordinator.active) {
    supersedePending(coordinator);
    coordinator.pending = request;
  } else {
    startRequest(coordinator, request);
  }
  return request.promise;
}

function getCoordinator(storage: PanelStorage, key: string): WriteCoordinator {
  let storageCoordinators = coordinators.get(storage);
  if (!storageCoordinators) {
    storageCoordinators = new Map();
    coordinators.set(storage, storageCoordinators);
  }
  let coordinator = storageCoordinators.get(key);
  if (!coordinator) {
    coordinator = {
      storage,
      key,
      nextRevision: 1,
      active: null,
      pending: null,
      lastSuccessfulValue: undefined,
    };
    storageCoordinators.set(key, coordinator);
  }
  return coordinator;
}

function createRequest(revision: number, value: string): WriteRequest {
  let resolve!: (result: PersistenceWriteResult) => void;
  const promise = new Promise<PersistenceWriteResult>((settle) => {
    resolve = settle;
  });
  return { revision, value, promise, resolve };
}

function supersedePending(coordinator: WriteCoordinator): void {
  if (!coordinator.pending) return;
  coordinator.pending.resolve({
    status: "superseded",
    revision: coordinator.pending.revision,
  });
  coordinator.pending = null;
}

function startRequest(
  coordinator: WriteCoordinator,
  request: WriteRequest,
): void {
  coordinator.active = request;
  void performRequest(coordinator, request);
}

async function performRequest(
  coordinator: WriteCoordinator,
  request: WriteRequest,
): Promise<void> {
  try {
    await coordinator.storage.setItem(coordinator.key, request.value);
    coordinator.lastSuccessfulValue = request.value;
    request.resolve({
      status: "success",
      revision: request.revision,
      written: true,
    });
  } catch (error) {
    request.resolve({ status: "error", revision: request.revision, error });
  } finally {
    if (coordinator.active === request) coordinator.active = null;
    const next = coordinator.pending;
    coordinator.pending = null;
    if (next) {
      if (coordinator.lastSuccessfulValue === next.value) {
        next.resolve({
          status: "success",
          revision: next.revision,
          written: false,
        });
      } else {
        startRequest(coordinator, next);
      }
    }
  }
}

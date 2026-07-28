/**
 * Document-scoped pointer-session lease (§14).
 *
 * A pointer resize session saves, mutates, and restores document-global
 * state — `body.cursor` and `body.userSelect`. Provider-local locks are not
 * enough once providers can be implicit: two providers in one document could
 * each grant a session, and the second session's saved "previous" body style
 * would be the first session's override, corrupting the restore order.
 *
 * The lease is module-level and keyed by `ownerDocument`, so every provider
 * — explicit or implicit — competes for the same lock per document, while
 * separate documents (iframes, popups) stay independent. It is deliberately
 * NOT a registry: no panel or provider state lives here, only exclusive
 * ownership of one document's global interaction styles.
 */

const activeLeases = new WeakMap<Document, object>();

/** Acquire the exclusive pointer lease for `doc`. Returns false while any
 * other owner holds it; re-acquiring under the same owner is idempotent. */
export function acquirePointerLease(doc: Document, owner: object): boolean {
  const held = activeLeases.get(doc);
  if (held !== undefined && held !== owner) return false;
  activeLeases.set(doc, owner);
  return true;
}

/** Release the lease only while `owner` still holds it. Stale releases from
 * finished or superseded sessions are no-ops. */
export function releasePointerLease(doc: Document, owner: object): void {
  if (activeLeases.get(doc) === owner) activeLeases.delete(doc);
}

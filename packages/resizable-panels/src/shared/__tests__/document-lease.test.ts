// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { acquirePointerLease, releasePointerLease } from "../document-lease";

function createDocument(): Document {
  return document.implementation.createHTMLDocument();
}

describe("document pointer lease", () => {
  it("grants one owner per document at a time", () => {
    const doc = createDocument();
    const first = {};
    const second = {};
    expect(acquirePointerLease(doc, first)).toBe(true);
    expect(acquirePointerLease(doc, second)).toBe(false);
    releasePointerLease(doc, first);
    expect(acquirePointerLease(doc, second)).toBe(true);
    releasePointerLease(doc, second);
  });

  it("is idempotent for the holding owner", () => {
    const doc = createDocument();
    const owner = {};
    expect(acquirePointerLease(doc, owner)).toBe(true);
    expect(acquirePointerLease(doc, owner)).toBe(true);
    releasePointerLease(doc, owner);
  });

  it("ignores releases from non-holders", () => {
    const doc = createDocument();
    const holder = {};
    const stranger = {};
    expect(acquirePointerLease(doc, holder)).toBe(true);
    releasePointerLease(doc, stranger);
    expect(acquirePointerLease(doc, stranger)).toBe(false);
    releasePointerLease(doc, holder);
  });

  it("scopes leases per document", () => {
    const docA = createDocument();
    const docB = createDocument();
    const ownerA = {};
    const ownerB = {};
    expect(acquirePointerLease(docA, ownerA)).toBe(true);
    expect(acquirePointerLease(docB, ownerB)).toBe(true);
    releasePointerLease(docA, ownerA);
    releasePointerLease(docB, ownerB);
  });
});

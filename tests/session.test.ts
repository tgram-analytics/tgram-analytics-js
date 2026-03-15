import { describe, expect, it, vi } from "vitest";
import { clearSessionId, getOrCreateSessionId } from "../src/session.js";

// UUID v4 format: 8-4-4-4-12 hex characters separated by dashes.
const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

describe("getOrCreateSessionId", () => {
  it("returns a valid UUID v4", () => {
    const id = getOrCreateSessionId();
    expect(id).toMatch(UUID_RE);
  });

  it("returns the same ID on subsequent calls (session reuse)", () => {
    const first = getOrCreateSessionId();
    const second = getOrCreateSessionId();
    expect(first).toBe(second);
  });

  it("returns a new ID after clearSessionId()", () => {
    const before = getOrCreateSessionId();
    clearSessionId();
    const after = getOrCreateSessionId();
    expect(after).not.toBe(before);
    expect(after).toMatch(UUID_RE);
  });

  it("returns the custom ID as-is and does not touch sessionStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem");
    const id = getOrCreateSessionId("my-custom-id");
    expect(id).toBe("my-custom-id");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("falls back to an in-memory UUID when sessionStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });
    const id = getOrCreateSessionId();
    expect(id).toMatch(UUID_RE);
  });

  it("falls back gracefully when sessionStorage.setItem throws", () => {
    // Simulate a full or blocked storage.
    vi.spyOn(Storage.prototype, "getItem").mockReturnValueOnce(null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });
    // Should not throw even when write fails.
    expect(() => getOrCreateSessionId()).not.toThrow();
  });
});

describe("clearSessionId", () => {
  it("removes the stored session ID", () => {
    getOrCreateSessionId(); // store one
    clearSessionId();
    expect(sessionStorage.getItem("tga_sid")).toBeNull();
  });

  it("does not throw when sessionStorage.removeItem throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementationOnce(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearSessionId()).not.toThrow();
  });
});

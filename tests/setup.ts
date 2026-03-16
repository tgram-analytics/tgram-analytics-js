/**
 * Global test setup — runs before every test file.
 *
 * - Stubs `fetch` and `navigator.sendBeacon` so tests never make real requests.
 * - Resets all mocks and `sessionStorage` before each individual test.
 */

import { beforeEach, vi } from "vitest";

// ── Global stubs ─────────────────────────────────────────────────────────────

/** Stubbed fetch — returns a 202 Accepted response by default. */
export const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
vi.stubGlobal("fetch", fetchMock);

/** Stubbed sendBeacon — returns true (accepted) by default. */
export const beaconMock = vi.fn().mockReturnValue(true);

// Extend the existing navigator stub so other navigator properties still work.
Object.defineProperty(globalThis, "navigator", {
  value: {
    ...globalThis.navigator,
    sendBeacon: beaconMock,
    doNotTrack: null, // DNT off by default
    language: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  writable: true,
  configurable: true,
});

// ── Screen / viewport defaults for context.ts ────────────────────────────────

Object.defineProperty(globalThis, "screen", {
  value: { width: 1920, height: 1080 },
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "innerWidth", { value: 1440, writable: true, configurable: true });
Object.defineProperty(globalThis, "innerHeight", { value: 900, writable: true, configurable: true });

// ── Per-test reset ────────────────────────────────────────────────────────────

beforeEach(() => {
  fetchMock.mockClear();
  beaconMock.mockClear();
  sessionStorage.clear();
});

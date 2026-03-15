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
  },
  writable: true,
  configurable: true,
});

// ── Per-test reset ────────────────────────────────────────────────────────────

beforeEach(() => {
  fetchMock.mockClear();
  beaconMock.mockClear();
  sessionStorage.clear();
});

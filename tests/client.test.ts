/**
 * Tests for TGAClient — the core SDK class.
 *
 * Each test creates a fresh TGAClient instance to avoid cross-test state
 * pollution (the exported singleton in index.ts is not used here).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TGAClient } from "../src/client.js";
import { beaconMock, fetchMock } from "./setup.js";

const SERVER = "https://analytics.example.com";
const API_KEY = "proj_testkey123";

/** Helper: create and initialise a client with standard options. */
function makeClient(overrides: Partial<Parameters<TGAClient["init"]>[1]> = {}): TGAClient {
  const client = new TGAClient();
  client.init(API_KEY, { serverUrl: SERVER, autoPageview: false, ...overrides });
  return client;
}

/** Parse the JSON body from the last fetch call. */
function lastFetchBody(): Record<string, unknown> {
  const calls = fetchMock.mock.calls;
  const body = (calls[calls.length - 1] as [string, RequestInit])[1].body as string;
  return JSON.parse(body) as Record<string, unknown>;
}

describe("TGAClient.init()", () => {
  it("throws when apiKey is missing", () => {
    const client = new TGAClient();
    expect(() => client.init("", { serverUrl: SERVER })).toThrow(/Invalid API key/);
  });

  it("throws when apiKey does not start with 'proj_'", () => {
    const client = new TGAClient();
    expect(() => client.init("sk_wrong_prefix", { serverUrl: SERVER })).toThrow(/Invalid API key/);
  });

  it("throws when serverUrl is missing", () => {
    const client = new TGAClient();
    expect(() => client.init(API_KEY, { serverUrl: "" })).toThrow(/serverUrl is required/);
  });

  it("strips trailing slash from serverUrl", () => {
    const client = new TGAClient();
    client.init(API_KEY, { serverUrl: `${SERVER}/`, autoPageview: false });
    client.track("test");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${SERVER}/api/v1/track`);
  });

  it("warns (does not throw) on double-init", () => {
    const client = new TGAClient();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    client.init(API_KEY, { serverUrl: SERVER, autoPageview: false });
    client.init(API_KEY, { serverUrl: SERVER, autoPageview: false });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("already called");
    warnSpy.mockRestore();
  });

  it("sends an initial pageview when autoPageview is true", () => {
    const client = new TGAClient();
    client.init(API_KEY, { serverUrl: SERVER, autoPageview: true });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${SERVER}/api/v1/pageview`);
  });

  it("does not send a pageview when autoPageview is false", () => {
    makeClient({ autoPageview: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opts out silently when DNT is '1' and respectDNT is true", () => {
    Object.defineProperty(globalThis.navigator, "doNotTrack", {
      value: "1",
      writable: true,
      configurable: true,
    });
    const client = makeClient({ respectDNT: true });
    client.track("test");
    expect(fetchMock).not.toHaveBeenCalled();
    Object.defineProperty(globalThis.navigator, "doNotTrack", {
      value: null,
      writable: true,
      configurable: true,
    });
  });

  it("ignores DNT when respectDNT is false", () => {
    Object.defineProperty(globalThis.navigator, "doNotTrack", {
      value: "1",
      writable: true,
      configurable: true,
    });
    const client = makeClient({ respectDNT: false });
    client.track("test");
    expect(fetchMock).toHaveBeenCalledOnce();
    Object.defineProperty(globalThis.navigator, "doNotTrack", {
      value: null,
      writable: true,
      configurable: true,
    });
  });
});

describe("TGAClient.track()", () => {
  let client: TGAClient;

  beforeEach(() => {
    client = makeClient();
  });

  it("sends to /api/v1/track", () => {
    client.track("purchase");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${SERVER}/api/v1/track`);
  });

  it("uses 'event_name' field (matches server schema)", () => {
    client.track("purchase");
    expect(lastFetchBody()).toMatchObject({ event_name: "purchase" });
  });

  it("includes api_key, session_id, properties, and timestamp", () => {
    client.track("purchase", { amount: 49 });
    const body = lastFetchBody();
    expect(body.api_key).toBe(API_KEY);
    expect(typeof body.session_id).toBe("string");
    expect(body.properties).toMatchObject({ amount: 49 });
    expect(typeof body.timestamp).toBe("string");
  });

  it("merges identify() properties into event properties", () => {
    client.identify({ plan: "pro", locale: "en-US" });
    client.track("purchase", { amount: 49 });
    expect(lastFetchBody().properties).toMatchObject({ plan: "pro", locale: "en-US", amount: 49 });
  });

  it("per-event properties override identify() properties on conflict", () => {
    client.identify({ plan: "free" });
    client.track("upgrade", { plan: "pro" });
    expect((lastFetchBody().properties as Record<string, unknown>).plan).toBe("pro");
  });

  it("warns and does not throw when called before init()", () => {
    const uninitClient = new TGAClient();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => uninitClient.track("test")).not.toThrow();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("before TGA.init()");
    warnSpy.mockRestore();
  });

  it("does not send when opted out", () => {
    client.opt("out");
    client.track("test");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("TGAClient.pageview()", () => {
  let client: TGAClient;

  beforeEach(() => {
    client = makeClient();
  });

  it("sends to /api/v1/pageview", () => {
    client.pageview("/home");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${SERVER}/api/v1/pageview`);
  });

  it("includes url, referrer, api_key, session_id, timestamp", () => {
    client.pageview("/pricing", "https://google.com");
    const body = lastFetchBody();
    expect(body.url).toBe("/pricing");
    expect(body.referrer).toBe("https://google.com");
    expect(typeof body.api_key).toBe("string");
    expect(typeof body.session_id).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });

  it("defaults url to window.location.pathname + search", () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/blog", search: "?q=test" },
      writable: true,
      configurable: true,
    });
    client.pageview();
    expect(lastFetchBody().url).toBe("/blog?q=test");
  });
});

describe("TGAClient — visitor context", () => {
  it("includes context properties in track() payload", () => {
    const client = makeClient();
    client.track("test");
    const props = lastFetchBody().properties as Record<string, unknown>;
    expect(props.$os).toBe("macOS");
    expect(props.$browser).toBe("Chrome");
    expect(props.$language).toBe("en-US");
    expect(props.$screen).toBe("1920x1080");
    expect(props.$viewport).toBe("1440x900");
    expect(props.$timezone).toBeDefined();
    expect(props.$device_type).toBe("desktop");
  });

  it("includes context properties in pageview() payload", () => {
    const client = makeClient();
    client.pageview("/test");
    const body = lastFetchBody();
    const props = body.properties as Record<string, unknown>;
    expect(props.$os).toBe("macOS");
    expect(props.$browser).toBe("Chrome");
  });

  it("does not collect context when collectContext is false", () => {
    const client = new TGAClient();
    client.init(API_KEY, { serverUrl: SERVER, autoPageview: false, collectContext: false });
    client.track("test");
    const props = lastFetchBody().properties as Record<string, unknown>;
    expect(props.$os).toBeUndefined();
    expect(props.$browser).toBeUndefined();
  });

  it("per-event properties override context", () => {
    const client = makeClient();
    client.track("test", { $browser: "Custom" });
    const props = lastFetchBody().properties as Record<string, unknown>;
    expect(props.$browser).toBe("Custom");
  });
});

describe("TGAClient.identify()", () => {
  it("merges new properties into existing ones", () => {
    const client = makeClient();
    client.identify({ plan: "pro" });
    client.identify({ locale: "en-US" }); // second call should merge, not replace
    client.track("test");
    expect(lastFetchBody().properties).toMatchObject({ plan: "pro", locale: "en-US" });
  });
});

describe("TGAClient.opt()", () => {
  let client: TGAClient;

  beforeEach(() => {
    client = makeClient();
  });

  it("opt('out') prevents sends", () => {
    client.opt("out");
    client.track("test");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opt('in') re-enables sends after opt-out", () => {
    client.opt("out");
    client.opt("in");
    client.track("test");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("TGAClient.reset()", () => {
  it("generates a new session ID", () => {
    const client = makeClient();
    client.track("before");
    const sidBefore = lastFetchBody().session_id as string;

    // reset() clears initialized so we can call init() again with a fresh session.
    client.reset();
    client.init(API_KEY, { serverUrl: SERVER, autoPageview: false });
    fetchMock.mockClear();
    client.track("after");
    const sidAfter = lastFetchBody().session_id as string;

    expect(sidAfter).not.toBe(sidBefore);
  });

  it("clears identify() properties", () => {
    const client = makeClient();
    client.identify({ plan: "pro" });
    client.reset();
    client.init(API_KEY, { serverUrl: SERVER, autoPageview: false });
    client.track("test");
    expect((lastFetchBody().properties as Record<string, unknown>).plan).toBeUndefined();
  });
});

describe("TGAClient.flush()", () => {
  it("does not throw when batching is disabled", async () => {
    const client = makeClient();
    await expect(client.flush()).resolves.toBeUndefined();
  });

  it("sends buffered events when batching is enabled", async () => {
    const client = makeClient({ batch: { maxSize: 100, maxWait: 60_000 } });
    client.track("event-1");
    client.track("event-2");
    expect(fetchMock).not.toHaveBeenCalled(); // buffered

    await client.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("TGAClient — unload flush", () => {
  afterEach(() => {
    // Restore visibilityState.
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("flushes the queue on visibilitychange to 'hidden'", () => {
    const client = makeClient({ batch: { maxSize: 100, maxWait: 60_000 } });
    client.track("unload-event");
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // When visibilityState is "hidden", send() prefers sendBeacon over fetch.
    expect(beaconMock).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import { send } from "../src/transport.js";
import { beaconMock, fetchMock } from "./setup.js";

const URL = "https://analytics.example.com/api/v1/track";
const PAYLOAD = {
  api_key: "proj_xxx",
  event_name: "test",
  session_id: "sid",
  properties: {},
  timestamp: "2024-01-01T00:00:00.000Z",
};

describe("send (normal path)", () => {
  it("calls fetch with POST, correct headers and body", () => {
    send(URL, PAYLOAD);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(URL);
    expect(options.method).toBe("POST");
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(options.body).toBe(JSON.stringify(PAYLOAD));
  });

  it("sets keepalive: true and mode: 'cors'", () => {
    send(URL, PAYLOAD);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.keepalive).toBe(true);
    expect(options.mode).toBe("cors");
  });

  it("does not throw when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));
    // Should not throw.
    expect(() => send(URL, PAYLOAD)).not.toThrow();
    // Give the microtask queue a tick to ensure the rejection is handled.
    await Promise.resolve();
  });

  it("does not throw when fetch itself throws synchronously", () => {
    fetchMock.mockImplementationOnce(() => {
      throw new Error("fetch unavailable");
    });
    expect(() => send(URL, PAYLOAD)).not.toThrow();
  });
});

describe("send (page-hide path)", () => {
  it("uses sendBeacon when visibilityState is 'hidden'", () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });

    send(URL, PAYLOAD);

    expect(beaconMock).toHaveBeenCalledOnce();
    const [beaconUrl, beaconBody] = beaconMock.mock.calls[0] as [string, Blob];
    expect(beaconUrl).toBe(URL);
    expect(beaconBody).toBeInstanceOf(Blob);
    expect(beaconBody.type).toBe("application/json");
    // fetch should NOT have been called when beacon succeeded.
    expect(fetchMock).not.toHaveBeenCalled();

    // Restore.
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("falls back to fetch when sendBeacon returns false", () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    beaconMock.mockReturnValueOnce(false);

    send(URL, PAYLOAD);

    expect(beaconMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
});

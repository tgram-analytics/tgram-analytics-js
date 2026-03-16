import { afterEach, describe, expect, it } from "vitest";
import { collectContext } from "../src/context.js";

// Import setup so global mocks (screen, navigator, etc.) are in place.
import "./setup.js";

describe("collectContext", () => {
  const origNavigator = globalThis.navigator;
  const origScreen = globalThis.screen;
  const origInnerWidth = globalThis.innerWidth;
  const origInnerHeight = globalThis.innerHeight;

  afterEach(() => {
    // Restore defaults after each test.
    Object.defineProperty(globalThis, "navigator", {
      value: origNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "screen", {
      value: origScreen,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "innerWidth", {
      value: origInnerWidth,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "innerHeight", {
      value: origInnerHeight,
      writable: true,
      configurable: true,
    });
  });

  it("returns all context keys when browser APIs are available", () => {
    const ctx = collectContext();
    expect(ctx).toHaveProperty("$os");
    expect(ctx).toHaveProperty("$browser");
    expect(ctx).toHaveProperty("$language", "en-US");
    expect(ctx).toHaveProperty("$screen", "1920x1080");
    expect(ctx).toHaveProperty("$viewport", "1440x900");
    expect(ctx).toHaveProperty("$timezone");
    expect(ctx).toHaveProperty("$device_type", "desktop");
  });

  it("detects OS and browser from UA string fallback", () => {
    // Default setup has a Chrome/macOS UA string with no userAgentData.
    const ctx = collectContext();
    expect(ctx.$os).toBe("macOS");
    expect(ctx.$browser).toBe("Chrome");
  });

  it("prefers userAgentData when available", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...globalThis.navigator,
        userAgentData: {
          platform: "Windows",
          mobile: false,
          brands: [
            { brand: "Not A(Brand", version: "99" },
            { brand: "Chromium", version: "120" },
            { brand: "Microsoft Edge", version: "120" },
          ],
        },
      },
      writable: true,
      configurable: true,
    });

    const ctx = collectContext();
    expect(ctx.$os).toBe("Windows");
    expect(ctx.$browser).toBe("Microsoft Edge");
  });

  it("detects mobile device type from userAgentData.mobile", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...globalThis.navigator,
        userAgentData: {
          platform: "Android",
          mobile: true,
          brands: [{ brand: "Chrome", version: "120" }],
        },
      },
      writable: true,
      configurable: true,
    });

    const ctx = collectContext();
    expect(ctx.$device_type).toBe("mobile");
  });

  it("detects mobile from narrow screen width", () => {
    Object.defineProperty(globalThis, "screen", {
      value: { width: 375, height: 812 },
      writable: true,
      configurable: true,
    });

    const ctx = collectContext();
    expect(ctx.$device_type).toBe("mobile");
    expect(ctx.$screen).toBe("375x812");
  });

  it("detects tablet from medium screen with touch", () => {
    Object.defineProperty(globalThis, "screen", {
      value: { width: 768, height: 1024 },
      writable: true,
      configurable: true,
    });
    // Simulate touch support.
    (window as Record<string, unknown>).ontouchstart = null;

    const ctx = collectContext();
    expect(ctx.$device_type).toBe("tablet");

    delete (window as Record<string, unknown>).ontouchstart;
  });

  it("handles missing Intl gracefully", () => {
    const origIntl = globalThis.Intl;
    // @ts-expect-error -- intentionally removing Intl for test
    delete globalThis.Intl;

    const ctx = collectContext();
    expect(ctx).not.toHaveProperty("$timezone");
    // Other keys should still be present.
    expect(ctx).toHaveProperty("$os");
    expect(ctx).toHaveProperty("$browser");

    globalThis.Intl = origIntl;
  });

  it("detects Firefox from UA string", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...globalThis.navigator,
        userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0",
      },
      writable: true,
      configurable: true,
    });

    const ctx = collectContext();
    expect(ctx.$browser).toBe("Firefox");
    expect(ctx.$os).toBe("Linux");
  });

  it("detects Safari from UA string", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...globalThis.navigator,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
      writable: true,
      configurable: true,
    });

    const ctx = collectContext();
    expect(ctx.$browser).toBe("Safari");
    expect(ctx.$os).toBe("macOS");
  });

  it("detects iOS from UA string", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        ...globalThis.navigator,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
      writable: true,
      configurable: true,
    });

    const ctx = collectContext();
    expect(ctx.$os).toBe("iOS");
  });
});

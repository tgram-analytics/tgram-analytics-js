import { describe, expect, it } from "vitest";
import { extractUtmParams } from "../src/utm.js";

/** Helper: sets window.location.search for the duration of a test. */
function withSearch(search: string, fn: () => void): void {
  Object.defineProperty(window, "location", {
    value: { ...window.location, search },
    writable: true,
    configurable: true,
  });
  fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, search: "" },
    writable: true,
    configurable: true,
  });
}

describe("extractUtmParams", () => {
  it("returns all five UTM params when present", () => {
    withSearch(
      "?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_term=analytics&utm_content=banner",
      () => {
        expect(extractUtmParams()).toEqual({
          utm_source: "twitter",
          utm_medium: "social",
          utm_campaign: "launch",
          utm_term: "analytics",
          utm_content: "banner",
        });
      },
    );
  });

  it("returns an empty object when no UTM params are present", () => {
    withSearch("?ref=homepage&page=2", () => {
      expect(extractUtmParams()).toEqual({});
    });
  });

  it("ignores non-UTM query parameters", () => {
    withSearch("?utm_source=google&ref=email&id=42", () => {
      expect(extractUtmParams()).toEqual({ utm_source: "google" });
    });
  });

  it("returns only the UTM params that are present (partial set)", () => {
    withSearch("?utm_source=newsletter", () => {
      expect(extractUtmParams()).toEqual({ utm_source: "newsletter" });
    });
  });

  it("excludes UTM keys with empty string values", () => {
    withSearch("?utm_source=&utm_medium=social", () => {
      expect(extractUtmParams()).toEqual({ utm_medium: "social" });
    });
  });

  it("returns an empty object when search is empty", () => {
    withSearch("", () => {
      expect(extractUtmParams()).toEqual({});
    });
  });
});

/**
 * Tests for the runtime properties validator.
 *
 * The validator runs on every public path that accepts user-supplied
 * `EventProperties` (TGA.track, TGA.identify) — so any shape that
 * cannot be safely stored in the server's JSONB column is rejected
 * synchronously, with a helpful message, in the caller's code path.
 */

import { describe, expect, it } from "vitest";
import { validateProperties } from "../src/validate.js";

describe("validateProperties()", () => {
  describe("accepts scalar primitives", () => {
    it("accepts string, number, boolean, null", () => {
      expect(() =>
        validateProperties({ s: "x", n: 1, f: 1.5, t: true, fl: false, z: null }, "track"),
      ).not.toThrow();
    });

    it("accepts an empty object", () => {
      expect(() => validateProperties({}, "track")).not.toThrow();
    });
  });

  describe("accepts arrays of scalars", () => {
    it("accepts a string array", () => {
      expect(() => validateProperties({ tags: ["a", "b", "c"] }, "track")).not.toThrow();
    });

    it("accepts a number array", () => {
      expect(() => validateProperties({ scores: [1, 2, 3.5] }, "track")).not.toThrow();
    });

    it("accepts a boolean array", () => {
      expect(() => validateProperties({ flags: [true, false, true] }, "track")).not.toThrow();
    });

    it("accepts a heterogeneous array of scalars", () => {
      expect(() => validateProperties({ mixed: ["a", 1, true, null] }, "track")).not.toThrow();
    });

    it("accepts an empty array", () => {
      expect(() => validateProperties({ empty: [] }, "track")).not.toThrow();
    });
  });

  describe("rejects nested arrays", () => {
    it("throws when an array contains an array", () => {
      expect(() => validateProperties({ tags: [["nested"]] as never }, "track")).toThrow(/tags/);
    });

    it("error message mentions the bad index", () => {
      try {
        validateProperties({ tags: ["a", [1] as never] }, "track");
      } catch (e) {
        const msg = (e as Error).message;
        expect(msg).toContain("tags");
        expect(msg).toContain("1"); // index
        return;
      }
      throw new Error("expected throw");
    });
  });

  describe("rejects objects inside arrays", () => {
    it("throws when an array contains an object", () => {
      expect(() => validateProperties({ tags: [{} as never] }, "track")).toThrow(/tags/);
    });

    it("error message mentions the method name", () => {
      try {
        validateProperties({ tags: [{ x: 1 } as never] }, "identify");
      } catch (e) {
        expect((e as Error).message).toContain("identify");
        return;
      }
      throw new Error("expected throw");
    });
  });

  describe("rejects undefined inside arrays", () => {
    it("throws when an array contains undefined", () => {
      expect(() => validateProperties({ tags: [undefined as never] }, "track")).toThrow(/tags/);
    });
  });

  describe("rejects unsupported scalar types", () => {
    it("throws on a top-level object value", () => {
      expect(() => validateProperties({ nested: { a: 1 } as never }, "track")).toThrow(/nested/);
    });

    it("throws on a top-level undefined value", () => {
      expect(() => validateProperties({ x: undefined as never }, "track")).toThrow(/x/);
    });

    it("throws on a function value", () => {
      expect(() => validateProperties({ f: (() => 0) as never }, "track")).toThrow(/f/);
    });

    it("throws on a symbol value", () => {
      expect(() => validateProperties({ s: Symbol("x") as never }, "track")).toThrow(/s/);
    });

    it("throws on NaN (number is allowed, but not the JSON-unsafe NaN)", () => {
      expect(() => validateProperties({ n: Number.NaN }, "track")).toThrow(/n/);
    });

    it("throws on Infinity (not JSON-safe)", () => {
      expect(() => validateProperties({ n: Number.POSITIVE_INFINITY }, "track")).toThrow(/n/);
    });
  });
});

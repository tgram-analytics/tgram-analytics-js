import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import iifeDefault from "../src/iife.js";

// The jsdom environment rewrites `import.meta.url` to an http:// URL, so
// resolve from the project root instead. Vitest runs with cwd = project root.
const DIST_IIFE = join(process.cwd(), "dist", "index.iife.js");

describe("IIFE entry (src/iife.ts)", () => {
  it("default-exports the singleton itself, not a namespace object", () => {
    for (const method of ["init", "track", "pageview", "identify", "opt", "flush", "reset"]) {
      expect(typeof (iifeDefault as unknown as Record<string, unknown>)[method]).toBe("function");
    }
  });

  it("keeps TGAClient reachable as a property", () => {
    expect(typeof iifeDefault.TGAClient).toBe("function");
  });
});

// Guards the tsup `footer` that unwraps `TGA = TGA.default`. Without it the
// global would be `{ default: <singleton> }` and every README snippet
// (`TGA.init(...)`) would throw "TGA.init is not a function".
describe.skipIf(!existsSync(DIST_IIFE))("built IIFE bundle (dist/index.iife.js)", () => {
  it("exposes the singleton directly as the TGA global", () => {
    const sandbox: Record<string, unknown> = {};
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    runInNewContext(readFileSync(DIST_IIFE, "utf8"), sandbox);

    const TGA = sandbox.TGA as Record<string, unknown>;
    expect(TGA).toBeDefined();
    expect(typeof TGA.init).toBe("function");
    expect(typeof TGA.track).toBe("function");
    expect(typeof TGA.TGAClient).toBe("function");
    // The old broken shape was exactly `{ TGAClient, default }`.
    expect(TGA.default).toBeUndefined();
  });
});

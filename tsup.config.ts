import { defineConfig } from "tsup";

const shared = {
  splitting: false,
  sourcemap: true,
  minify: true,
} as const;

// NOTE: `clean` is deliberately not set on either config. tsup starts the two
// configs concurrently, so a `clean` on one can wipe output the other has
// already written. `npm run build` runs `npm run clean` first instead.
export default defineConfig([
  // npm builds: `import TGA from "tgram-analytics"` / `require("tgram-analytics")`
  {
    ...shared,
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
  },
  // <script> tag build: `window.TGA` IS the singleton (see src/iife.ts).
  //
  // esbuild emits `var TGA = (() => { ... })();` where the returned value is the
  // module namespace object, so without the footer the global would be
  // `{ default: <singleton> }` and `TGA.init` would be undefined. The footer
  // unwraps it, and also pins it onto globalThis so the global still lands when
  // the file happens to be loaded as `<script type="module">` (where `var` is
  // module-scoped and would otherwise never reach `window`).
  {
    ...shared,
    entry: { index: "src/iife.ts" },
    format: ["iife"],
    globalName: "TGA",
    dts: false,
    outExtension: () => ({ js: ".iife.js" }),
    footer: {
      js: "TGA=TGA.default;if(typeof globalThis!=='undefined')globalThis.TGA=TGA;",
    },
  },
]);

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: "TGA", // exposes window.TGA for <script> usage
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  outExtension({ format }) {
    if (format === "iife") return { js: ".iife.js" };
    return {};
  },
});

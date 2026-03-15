/**
 * tgram-analytics JS SDK
 *
 * Lightweight, privacy-first analytics for websites and SPAs.
 * Zero dependencies. < 2 KB gzipped.
 *
 * ---
 *
 * ## Install via npm
 * ```bash
 * npm install tgram-analytics
 * ```
 *
 * ## Install via `<script>` tag
 * ```html
 * <script src="https://your-server.com/sdk/tga.min.js"></script>
 * <!-- The global `TGA` object is now available. -->
 * ```
 *
 * ## Quick start (ESM / TypeScript)
 * ```ts
 * import TGA from "tgram-analytics";
 *
 * TGA.init("proj_xxx", { serverUrl: "https://analytics.example.com" });
 *
 * // Pageviews are tracked automatically on load and SPA route changes.
 * // Track custom events manually:
 * TGA.track("purchase", { amount: 49, plan: "pro" });
 * ```
 *
 * ## Quick start (`<script>` tag)
 * ```html
 * <script src="https://your-server.com/sdk/tga.min.js"></script>
 * <script>
 *   TGA.init("proj_xxx", { serverUrl: "https://your-server.com" });
 *   TGA.track("purchase", { amount: 49 });
 * </script>
 * ```
 *
 * @module tgram-analytics
 */

export { TGAClient } from "./client.js";
export type { BatchOptions, EventProperties, TGAOptions } from "./types.js";

import { TGAClient } from "./client.js";

/**
 * The global singleton SDK instance.
 *
 * Import this object and call `.init()` once at the top of your application.
 * Do **not** create a `new TGAClient()` — use this singleton instead.
 *
 * @example
 * import TGA from "tgram-analytics";
 * TGA.init("proj_xxx", { serverUrl: "https://analytics.example.com" });
 */
const TGA = new TGAClient();

export default TGA;

/**
 * Dedicated entry point for the `<script>` tag (IIFE) build.
 *
 * The npm entry (`src/index.ts`) exports the singleton as the *default* export
 * plus `TGAClient` as a named export. Bundled as an IIFE, that would expose the
 * module namespace object as `window.TGA` — i.e. `{ TGAClient, default }` — so
 * `TGA.init(...)` would throw `TypeError: TGA.init is not a function`.
 *
 * This entry exports the singleton itself as the sole default export, and the
 * IIFE build's footer unwraps `TGA = TGA.default`. The result is that
 * `window.TGA` *is* the singleton, exactly as the README documents:
 *
 * ```html
 * <script src="https://your-server.com/sdk/tga.min.js"></script>
 * <script>
 *   TGA.init("proj_xxx", { serverUrl: "https://your-server.com" });
 *   TGA.track("purchase", { amount: 49 });
 * </script>
 * ```
 *
 * `TGAClient` stays reachable as `TGA.TGAClient` for anyone who needs to build
 * an extra isolated client from a script tag.
 *
 * @module tgram-analytics/iife
 */

import { TGAClient } from "./client.js";
import TGA from "./index.js";

export default Object.assign(TGA, { TGAClient });

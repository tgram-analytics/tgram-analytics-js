/**
 * Public TypeScript types for the tgram-analytics SDK.
 *
 * Import these in your application to get full type safety:
 * @example
 * import type { TGAOptions, EventProperties } from "tgram-analytics";
 */

// ── Public API types ─────────────────────────────────────────────────────────

/**
 * A single JSON-safe scalar — the building block of {@link EventProperties}.
 */
export type EventPropertyScalar = string | number | boolean | null;

/**
 * The value side of an entry in {@link EventProperties}.
 *
 * Either a scalar primitive or an array of scalars. Nested arrays and
 * object-valued properties are intentionally not supported so the JSONB
 * column stays cheap to query (a per-element pie chart is one
 * `jsonb_array_elements_text` call away).
 */
export type EventPropertyValue = EventPropertyScalar | EventPropertyScalar[];

/**
 * Arbitrary key-value properties attached to events.
 *
 * Values must be JSON-serialisable primitives — or arrays of such
 * primitives — so they can be stored in the server's JSONB `properties`
 * column without transformation.
 *
 * @example Scalar properties
 * const props: EventProperties = { amount: 49, plan: "pro", trial: false };
 *
 * @example Array-valued property (e.g. multi-select onboarding answer)
 * const props: EventProperties = {
 *   role: "creator",
 *   interest_set: ["vertical_to_horizontal", "unsure"], // <-- array of strings
 * };
 *
 * @remarks
 * Keys ending in `_set` are sorted alphabetically at write time by the
 * server, which makes `GROUP BY properties->'interest_set'`-style "most
 * common combos" queries trivial. Other array properties are stored in
 * the order you sent them.
 */
export type EventProperties = Record<string, EventPropertyValue>;

/**
 * Fine-grained options for the event batching queue.
 * Passed as the `batch` option to {@link TGAOptions}.
 *
 * @example
 * TGA.init("proj_xxx", {
 *   serverUrl: "https://analytics.example.com",
 *   batch: { maxSize: 20, maxWait: 3000 },
 * });
 */
export interface BatchOptions {
  /**
   * Maximum number of events to buffer before the queue is force-flushed.
   * @default 10
   */
  maxSize?: number;
  /**
   * Maximum milliseconds to wait before the queue is automatically flushed,
   * even if `maxSize` has not been reached.
   * @default 5000
   */
  maxWait?: number;
}

/**
 * Configuration passed to {@link TGAClient.init}.
 *
 * Only `serverUrl` is required. All other options have sensible defaults
 * that work for most websites without any extra configuration.
 *
 * @example Minimal setup
 * TGA.init("proj_abc123", { serverUrl: "https://analytics.example.com" });
 *
 * @example Full setup
 * TGA.init("proj_abc123", {
 *   serverUrl: "https://analytics.example.com",
 *   autoPageview: true,
 *   respectDNT: true,
 *   batch: { maxSize: 10, maxWait: 5000 },
 * });
 */
export interface TGAOptions {
  /**
   * Base URL of your tgram-analytics server — no trailing slash.
   *
   * This is the URL where you deployed the server Docker image.
   * @example "https://analytics.example.com"
   */
  serverUrl: string;

  /**
   * When `true` (the default), the SDK automatically sends a pageview event:
   * - On initial page load.
   * - On every SPA route change (works with React Router, Vue Router, etc.).
   *
   * Set to `false` if you want to call `TGA.pageview()` manually.
   * @default true
   */
  autoPageview?: boolean;

  /**
   * When `true` (the default), the SDK checks the browser's
   * [Do Not Track](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/DNT)
   * setting. If DNT is enabled, **all** tracking is silently skipped — no
   * requests are sent.
   *
   * Set to `false` only if you have obtained explicit user consent through
   * other means (e.g. a cookie consent banner).
   * @default true
   */
  respectDNT?: boolean;

  /**
   * Enables event batching to reduce the number of network requests.
   *
   * - Pass `true` to use the default batch settings (maxSize: 10, maxWait: 5 s).
   * - Pass a {@link BatchOptions} object to customise the thresholds.
   * - Leave unset (or `false`) to send every event immediately.
   *
   * Batching is useful for high-frequency events (e.g. scroll depth, clicks).
   * For low-volume events like purchases, immediate sending is preferred.
   * @default false
   */
  batch?: boolean | BatchOptions;

  /**
   * Override the auto-generated session ID with your own value.
   *
   * The session ID is a UUID that groups events from the same browser tab.
   * Leave this unset unless you are managing sessions server-side.
   */
  sessionId?: string;

  /**
   * When `true` (the default), the SDK automatically collects visitor
   * context (OS, browser, language, screen, timezone, device type) and
   * includes it as `$`-prefixed properties on every event.
   *
   * Set to `false` to disable automatic context collection.
   * @default true
   */
  collectContext?: boolean;
}

// ── Internal payload shapes ──────────────────────────────────────────────────
// Generated from the server's OpenAPI spec (openapi.json → src/generated/api.ts).
// Run `npm run generate:api` to regenerate after server schema changes.

import type { components } from "./generated/api.js";

/**
 * Request body sent to `POST /api/v1/track`.
 * @internal
 */
export type TrackPayload = components["schemas"]["TrackEventRequest"];

/**
 * Request body sent to `POST /api/v1/pageview`.
 * @internal
 */
export type PageviewPayload = components["schemas"]["PageviewRequest"];

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
 *   interest: ["vertical_to_horizontal", "unsure"], // <-- array of strings
 * };
 *
 * @remarks
 * The server sorts every array property at write time so
 * `GROUP BY properties->'foo'`-style "most common combos" queries are
 * trivial — no naming convention needed. If insertion order matters for
 * some property, serialize the array to a string instead.
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

  /**
   * When `true`, the SDK records where visitors tap or click on each page and
   * how far they scroll, for tap heatmaps. Off by default.
   *
   * Per pageview the SDK sends at most one request to `POST /api/v1/taps` with
   * up to 50 taps. A tap holds only its position (x as a fraction of the
   * document width, y in CSS px from the page top) and a short element label
   * (`data-tga-label`, `aria-label`, `id`, or the tag plus up to 40 characters
   * of visible text). The request also holds the page path, the viewport
   * bucket and width, and the maximum scroll depth.
   *
   * The SDK never reads the value or the text of `input`, `textarea`,
   * `select`, or contenteditable elements. Taps on elements inside a
   * `data-tga-ignore` element are not recorded.
   * @default false
   */
  heatmaps?: boolean;
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

/**
 * Request body sent to `POST /api/v1/taps` (only when `heatmaps: true`).
 * One request per pageview.
 * @internal
 */
export interface TapsPayload {
  api_key: string;
  /** Used by the server for the request only; not stored with the taps. */
  session_id: string;
  /** `location.pathname + location.search`, the same string as the pageview URL. */
  path: string;
  /** From `window.innerWidth`: < 768 mobile, < 1024 tablet, else desktop. */
  viewport: "mobile" | "tablet" | "desktop";
  /** `window.innerWidth` in CSS px. */
  vw: number;
  /** 0 to 50 taps. */
  taps: TapPoint[];
  /** Maximum scroll depth, 0..1. Sent once per pageview. */
  scroll?: number;
}

/**
 * One tap in a {@link TapsPayload}.
 * @internal
 */
export interface TapPoint {
  /** Fraction of the document width, 0..1, 3 decimals. */
  x: number;
  /** CSS px from the document top (viewport px for fixed or sticky targets). */
  y: number;
  /** Element label, at most 80 characters. */
  el?: string;
}

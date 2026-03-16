/**
 * Core SDK client.
 *
 * `TGAClient` implements all public SDK methods. It is instantiated once as a
 * module-level singleton in `index.ts` and exported as `TGA`. You almost never
 * need to import this class directly — use the singleton instead:
 *
 * @example
 * import TGA from "tgram-analytics";
 *
 * TGA.init("proj_xxx", { serverUrl: "https://analytics.example.com" });
 * TGA.track("purchase", { amount: 49 });
 */

import { EventQueue, type QueueConfig } from "./queue.js";
import { clearSessionId, getOrCreateSessionId } from "./session.js";
import { installSpaListeners } from "./spa.js";
import { send } from "./transport.js";
import type { EventProperties, PageviewPayload, TGAOptions, TrackPayload } from "./types.js";
import { collectContext } from "./context.js";
import { extractUtmParams } from "./utm.js";

export class TGAClient {
  private apiKey = "";
  private serverUrl = "";
  private sessionId = "";
  private initialized = false;
  private optedOut = false;
  private globalProperties: EventProperties = {};
  private queue: EventQueue | null = null;
  private teardownSpa: (() => void) | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Initialises the SDK. **Must be called once** before using any other method.
   *
   * What `init()` does:
   * 1. Validates the API key and `serverUrl`.
   * 2. Generates (or restores) a session ID from `sessionStorage`.
   * 3. Checks Do Not Track — silently disables all tracking if enabled.
   * 4. Reads UTM parameters from the current URL and stores them as global
   *    properties so they appear on every event in this session.
   * 5. Sends an initial pageview and installs SPA route-change listeners
   *    (when `autoPageview` is `true`, which is the default).
   * 6. Installs `visibilitychange` / `pagehide` listeners to flush any
   *    pending queue when the user leaves the page.
   *
   * Calling `init()` a second time logs a warning and does nothing — it is
   * not an error. Call {@link reset} first if you need a clean slate.
   *
   * @param apiKey  - Your project API key. Must start with `"proj_"`.
   *                  Get it from the Telegram bot with `/projects`.
   * @param options - Configuration options. See {@link TGAOptions}.
   *
   * @throws {Error} If `apiKey` is missing, does not start with `"proj_"`, or
   *                 if `options.serverUrl` is not provided.
   *
   * @example
   * TGA.init("proj_abc123", {
   *   serverUrl: "https://analytics.example.com",
   * });
   */
  init(apiKey: string, options: TGAOptions): void {
    if (this.initialized) {
      console.warn(
        "[tgram-analytics] TGA.init() was already called. " +
          "Call TGA.reset() first if you need a fresh session.",
      );
      return;
    }

    // Fail loudly on misconfiguration — these errors should be caught in dev.
    if (!apiKey || !apiKey.startsWith("proj_")) {
      throw new Error(
        "[tgram-analytics] Invalid API key. " +
          'API keys must start with "proj_". ' +
          "Find your key in the Telegram bot with /projects.",
      );
    }
    if (!options.serverUrl) {
      throw new Error(
        "[tgram-analytics] options.serverUrl is required. " +
          'Example: "https://analytics.example.com"',
      );
    }

    this.apiKey = apiKey;
    // Strip trailing slash so we can always safely append endpoint paths.
    this.serverUrl = options.serverUrl.replace(/\/+$/, "");
    this.sessionId = getOrCreateSessionId(options.sessionId);
    this.initialized = true;

    // ── Privacy: Do Not Track ──────────────────────────────────────────────
    // When respectDNT is true (the default) and the browser signals DNT,
    // we mark the client as opted-out and skip all further setup.
    const respectDNT = options.respectDNT !== false;
    if (respectDNT && typeof navigator !== "undefined" && navigator.doNotTrack === "1") {
      this.optedOut = true;
      return;
    }

    // ── Batching queue ─────────────────────────────────────────────────────
    if (options.batch) {
      const cfg: QueueConfig =
        typeof options.batch === "object"
          ? { maxSize: options.batch.maxSize ?? 10, maxWait: options.batch.maxWait ?? 5000 }
          : { maxSize: 10, maxWait: 5000 };
      this.queue = new EventQueue(this.serverUrl, cfg);
    }

    // ── UTM parameters ─────────────────────────────────────────────────────
    // Capture acquisition channel data from the landing-page URL.
    const utms = extractUtmParams();
    if (Object.keys(utms).length > 0) {
      this.globalProperties = { ...this.globalProperties, ...utms };
    }

    // ── Visitor context ─────────────────────────────────────────────────────
    // Collect device, browser, and environment information once per session.
    if (options.collectContext !== false) {
      const ctx = collectContext();
      if (Object.keys(ctx).length > 0) {
        this.globalProperties = { ...this.globalProperties, ...ctx };
      }
    }

    // ── Auto-pageview + SPA listeners ──────────────────────────────────────
    const autoPageview = options.autoPageview !== false;
    if (autoPageview && typeof window !== "undefined") {
      this.pageview();
      this.teardownSpa = installSpaListeners(() => this.pageview());
    }

    // ── Page-unload flush ──────────────────────────────────────────────────
    // Ensure queued events are sent before the browser discards the page.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void this.flush();
      });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => void this.flush());
    }
  }

  // ── Tracking ───────────────────────────────────────────────────────────────

  /**
   * Tracks a custom named event.
   *
   * The event is sent to `POST /api/v1/track` on the server.
   * Properties from {@link identify} are automatically merged in.
   *
   * @param eventName  - A string identifier for the event, e.g. `"purchase"`,
   *                     `"signup"`, `"button_click"`. Use snake_case for
   *                     consistency with the server's query patterns.
   * @param properties - Optional key-value metadata for this specific event.
   *                     Values must be strings, numbers, booleans, or `null`.
   *
   * @example Track a purchase
   * TGA.track("purchase", { amount: 49, currency: "USD", plan: "pro" });
   *
   * @example Track a signup with no extra properties
   * TGA.track("signup");
   */
  track(eventName: string, properties?: EventProperties): void {
    if (!this.guardReady("track")) return;

    const payload: TrackPayload = {
      api_key: this.apiKey,
      event_name: eventName,
      session_id: this.sessionId,
      // Per-event properties override global ones (identify() values).
      properties: { ...this.globalProperties, ...properties },
      timestamp: new Date().toISOString(),
    };

    this.dispatch("/api/v1/track", payload);
  }

  /**
   * Tracks a pageview event.
   *
   * You rarely need to call this manually — when `autoPageview` is `true`
   * (the default), pageviews are sent automatically on init and on every
   * SPA route change.
   *
   * The event is sent to `POST /api/v1/pageview` on the server.
   *
   * @param url      - The page URL or path to record. Defaults to
   *                   `window.location.pathname + window.location.search`.
   * @param referrer - The referring URL. Defaults to `document.referrer`.
   *
   * @example Manual pageview for a custom URL
   * TGA.pageview("/virtual/checkout-step-2");
   *
   * @example With explicit referrer
   * TGA.pageview("/pricing", "https://twitter.com");
   */
  pageview(url?: string, referrer?: string): void {
    if (!this.guardReady("pageview")) return;

    const resolvedUrl =
      url ??
      (typeof window !== "undefined" ? window.location.pathname + window.location.search : "");

    const resolvedReferrer =
      referrer ?? (typeof document !== "undefined" ? document.referrer || null : null);

    const payload: PageviewPayload = {
      api_key: this.apiKey,
      session_id: this.sessionId,
      url: resolvedUrl,
      referrer: resolvedReferrer,
      timestamp: new Date().toISOString(),
      properties: { ...this.globalProperties },
    };

    this.dispatch("/api/v1/pageview", payload);
  }

  /**
   * Attaches persistent properties to every subsequent {@link track} call.
   *
   * Properties set via `identify()` are merged into the `properties` field of
   * each event. Per-event properties (passed directly to `track()`) take
   * precedence over identified properties when keys conflict.
   *
   * Use `identify()` for attributes that apply to the whole session, such as
   * the user's subscription plan, locale, or A/B test variant.
   *
   * @param properties - Key-value pairs to merge into global session properties.
   *
   * @example
   * TGA.identify({ plan: "pro", locale: "en-US", ab_variant: "B" });
   * TGA.track("purchase"); // => properties includes plan, locale, ab_variant
   */
  identify(properties: EventProperties): void {
    this.globalProperties = { ...this.globalProperties, ...properties };
  }

  // ── Privacy ────────────────────────────────────────────────────────────────

  /**
   * Opts the current user in or out of analytics.
   *
   * - Opting **out** immediately flushes any pending queue and silently
   *   suppresses all future `track()` and `pageview()` calls.
   * - Opting **in** re-enables tracking for the rest of the page session.
   *
   * **The opt-out state is not persisted.** If you want persistence across
   * page loads, store the preference yourself (e.g. in `localStorage`) and
   * call `TGA.opt("out")` on every page load when the preference is set.
   *
   * @param status - `"in"` to enable tracking, `"out"` to disable it.
   *
   * @example Honour a consent flag stored in localStorage
   * if (localStorage.getItem("analytics_consent") === "false") {
   *   TGA.opt("out");
   * }
   */
  opt(status: "in" | "out"): void {
    if (status === "out") {
      void this.flush(); // drain the queue before silencing further sends
      this.optedOut = true;
    } else {
      this.optedOut = false;
    }
  }

  // ── Queue / lifecycle ──────────────────────────────────────────────────────

  /**
   * Immediately sends all buffered events.
   *
   * This is a no-op when batching is disabled (the default). When batching is
   * enabled, call `flush()` before programmatic navigations or logout to ensure
   * no events are lost.
   *
   * @returns A Promise that resolves once the flush is complete.
   *
   * @example Flush before navigating away
   * await TGA.flush();
   * window.location.href = "/thank-you";
   */
  async flush(): Promise<void> {
    this.queue?.flush();
  }

  /**
   * Starts a new session.
   *
   * Clears the current session ID from `sessionStorage` and generates a fresh
   * one. Also clears all properties set via {@link identify}.
   *
   * Call this after a user logs out to ensure subsequent events are not
   * attributed to the previous user's session.
   *
   * @example
   * function onLogout() {
   *   TGA.reset();
   *   // Now tracking continues under a new anonymous session.
   * }
   */
  reset(): void {
    // Remove SPA listeners installed by the previous init() so a subsequent
    // init() call can install them fresh without duplicating them.
    this.teardownSpa?.();
    this.teardownSpa = null;

    this.initialized = false;
    clearSessionId();
    this.sessionId = getOrCreateSessionId();
    this.globalProperties = {};
    this.optedOut = false;
    this.queue = null;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Guards all public tracking methods.
   *
   * Returns `false` (and logs a warning) when called before `init()`, so that
   * misconfiguration fails visibly in development. Returns `false` silently
   * when the user has opted out.
   *
   * @param method - Name of the calling method, used in the warning message.
   * @returns `true` when it is safe to proceed with the send.
   */
  private guardReady(method: string): boolean {
    if (!this.initialized) {
      console.warn(
        `[tgram-analytics] TGA.${method}() was called before TGA.init(). Initialise the SDK first.`,
      );
      return false;
    }
    return !this.optedOut;
  }

  /**
   * Routes a payload to either the batching queue or the transport layer,
   * depending on whether batching is enabled.
   *
   * @param endpoint - API path relative to `serverUrl` (e.g. `"/api/v1/track"`).
   * @param payload  - JSON-serialisable request body.
   */
  private dispatch(endpoint: string, payload: unknown): void {
    if (this.queue) {
      this.queue.push(endpoint, payload);
    } else {
      send(`${this.serverUrl}${endpoint}`, payload);
    }
  }
}

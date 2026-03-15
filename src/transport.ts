/**
 * Low-level event transport layer.
 *
 * **Design principle:** all sends are fire-and-forget. This module never
 * throws, never rejects, and never returns a meaningful value. Analytics
 * must never interrupt or break the host application.
 *
 * ## Transport selection
 *
 * | Situation | Mechanism |
 * |-----------|-----------|
 * | Page is being hidden / unloaded | `navigator.sendBeacon` |
 * | sendBeacon unavailable or refused | `fetch` with `keepalive: true` |
 * | fetch unavailable (very rare) | silent no-op |
 *
 * ### Why sendBeacon on page hide?
 * Regular `fetch` calls are cancelled when the browser navigates away.
 * `sendBeacon` queues the request at the OS level and guarantees delivery
 * even if the page is destroyed immediately after.
 *
 * ### Why keepalive on fetch?
 * `keepalive: true` tells the browser to keep the request alive even if the
 * page is unloaded — a reliable fallback when `sendBeacon` refuses (e.g.
 * when the payload exceeds the 64 KB beacon limit).
 *
 * ### Why mode: "cors"?
 * The browser includes the `Origin` header only on CORS requests. The server
 * reads that header to enforce the per-project `domain_allowlist`.
 */

/**
 * Sends a JSON payload to the given URL, choosing the best available transport.
 *
 * This function is safe to call at any time, including during page unload.
 * Errors are silently swallowed — analytics must never break the host page.
 *
 * @param url     - The full endpoint URL, e.g. `"https://srv.com/api/v1/track"`.
 * @param payload - Any JSON-serialisable value (object, array, primitive).
 *
 * @example
 * send("https://analytics.example.com/api/v1/track", {
 *   api_key: "proj_xxx",
 *   event_name: "purchase",
 *   session_id: "550e8400-...",
 *   properties: { amount: 49 },
 *   timestamp: "2024-01-01T12:00:00.000Z",
 * });
 */
export function send(url: string, payload: unknown): void {
  const body = JSON.stringify(payload);

  // During page hide, prefer Beacon for guaranteed delivery.
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "hidden" &&
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    // sendBeacon requires a Blob with the correct MIME type so that the server
    // reads the body as JSON. Using text/plain would avoid a CORS preflight but
    // the server requires application/json.
    const blob = new Blob([body], { type: "application/json" });
    const accepted = navigator.sendBeacon(url, blob);
    if (accepted) return;
    // sendBeacon can return false when the payload is too large (> 64 KB) or
    // the browser is in a state that disallows queueing. Fall through to fetch.
  }

  // Normal path — fetch with keepalive so the request outlives navigations.
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true, // keep alive across soft navigations
      mode: "cors", // include Origin header for server-side allowlist check
    }).catch(() => {
      // Network failure or CORS rejection. Swallow silently.
    });
  } catch {
    // fetch itself can throw synchronously in very unusual environments.
    // Swallow silently — we must never throw from the analytics layer.
  }
}

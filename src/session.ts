/**
 * Session ID management.
 *
 * A "session" in tgram-analytics maps to a single browser tab.
 * We use `sessionStorage` so that:
 * - Each tab gets its own independent session ID.
 * - The ID is automatically cleared when the tab is closed.
 * - No cookies or `localStorage` are ever written (privacy-first).
 *
 * If `sessionStorage` is unavailable (e.g. sandboxed iframes, private
 * browsing with strict settings), the module silently falls back to
 * an in-memory ID that persists only for the current page load.
 */

/** The key used to store the session ID in sessionStorage. */
const STORAGE_KEY = "tga_sid";

/**
 * Returns the current session ID, creating and persisting a new UUID v4 if
 * one does not already exist in `sessionStorage`.
 *
 * @param customId - When provided, this value is returned as-is and
 *                   `sessionStorage` is not read or written. Use this when
 *                   you manage sessions server-side and want to pass an ID in.
 * @returns A UUID v4 string that identifies the current session.
 *
 * @example Auto-generated session
 * const sid = getOrCreateSessionId(); // "550e8400-e29b-41d4-a716-446655440000"
 *
 * @example Custom session ID
 * const sid = getOrCreateSessionId("my-server-session-id");
 */
export function getOrCreateSessionId(customId?: string): string {
  if (customId) return customId;

  // Attempt to reuse an existing session from the same tab.
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // sessionStorage may throw in sandboxed iframes or very strict
    // private-browsing modes. Fall through to create a new in-memory ID.
  }

  const id = generateUUID();

  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Write failed — the ID exists only for this call. Subsequent calls
    // will generate a new ID, which is an acceptable degradation.
  }

  return id;
}

/**
 * Removes the session ID from `sessionStorage` so that the next call to
 * {@link getOrCreateSessionId} generates a fresh UUID.
 *
 * Called by `TGA.reset()` after a user logs out, ensuring subsequent events
 * are not attributed to the previous user's session.
 */
export function clearSessionId(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear, or storage unavailable. Safe to ignore.
  }
}

// ── UUID generation ──────────────────────────────────────────────────────────

/**
 * Generates a random UUID v4 string using the Web Crypto API.
 *
 * Prefers `crypto.randomUUID()` (available in all modern browsers since 2021).
 * Falls back to a manual implementation using `crypto.getRandomValues()` for
 * older environments (e.g. Safari < 15.4, some older Chromium-based browsers).
 *
 * @returns A standard UUID v4 string,
 *          e.g. `"550e8400-e29b-41d4-a716-446655440000"`.
 */
function generateUUID(): string {
  // Fast path: native randomUUID (Chrome 92+, Firefox 95+, Safari 15.4+).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: build UUID v4 manually via getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set the version nibble to 4 (bits 12-15 of byte 6).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set the variant bits to 0b10 (bits 6-7 of byte 8, RFC 4122 §4.1.1).
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Format as 8-4-4-4-12 UUID string.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * UTM parameter extraction.
 *
 * UTM (Urchin Tracking Module) parameters are query-string values added to
 * URLs by marketing tools to identify the source, medium, and campaign that
 * drove a visitor to the page.
 *
 * The SDK reads them once on initialisation from `window.location.search` and
 * merges them into `globalProperties` via `TGA.identify()`. This way, every
 * event in the session — not just the first pageview — carries the acquisition
 * channel information.
 *
 * **Standard UTM parameters:**
 * | Parameter      | Example value  | Meaning              |
 * |----------------|----------------|----------------------|
 * | utm_source     | `"twitter"`    | Traffic source       |
 * | utm_medium     | `"social"`     | Marketing medium     |
 * | utm_campaign   | `"launch-2024"`| Campaign name        |
 * | utm_term       | `"analytics"`  | Paid search keyword  |
 * | utm_content    | `"banner-cta"` | Ad variant / content |
 */

/** The five standard UTM query-string keys. */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/**
 * Reads UTM parameters from the current page URL (`window.location.search`).
 *
 * Only parameters that are present **and non-empty** are included in the
 * returned object. Non-UTM query parameters are ignored.
 *
 * Returns an empty object when:
 * - No UTM parameters are present in the URL.
 * - The function is called outside a browser environment (`window` undefined).
 *
 * @returns A plain object mapping UTM key → value for each present parameter.
 *
 * @example URL with source and medium
 * // Current URL: https://example.com/?utm_source=twitter&utm_medium=social
 * extractUtmParams();
 * // => { utm_source: "twitter", utm_medium: "social" }
 *
 * @example URL with no UTM params
 * // Current URL: https://example.com/pricing
 * extractUtmParams();
 * // => {}
 */
export function extractUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value !== null && value !== "") {
      result[key] = value;
    }
  }

  return result;
}

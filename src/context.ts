/**
 * Automatic visitor context collection.
 *
 * Gathers device, browser, and environment information from standard browser
 * APIs and returns them as `$`-prefixed properties. These are merged into
 * `globalProperties` once on {@link TGAClient.init} so every event in the
 * session carries the visitor context automatically.
 *
 * **Collected properties:**
 * | Key            | Source                        | Example          |
 * |----------------|-------------------------------|------------------|
 * | `$os`          | User-Agent Client Hints / UA  | `"macOS"`        |
 * | `$browser`     | User-Agent Client Hints / UA  | `"Chrome"`       |
 * | `$language`    | `navigator.language`          | `"en-US"`        |
 * | `$screen`      | `screen.width` × `height`     | `"1920x1080"`    |
 * | `$viewport`    | `innerWidth` × `innerHeight`  | `"1440x900"`     |
 * | `$timezone`    | `Intl.DateTimeFormat`         | `"Europe/Rome"`  |
 * | `$device_type` | Screen width + touch heuristic| `"desktop"`      |
 */

// ── UA Client Hints types (not yet in all TS libs) ──────────────────────────

interface NavigatorUABrandVersion {
  brand: string;
  version: string;
}

interface NavigatorUAData {
  brands: NavigatorUABrandVersion[];
  mobile: boolean;
  platform: string;
}

/**
 * Detects the operating system.
 *
 * Prefers the User-Agent Client Hints API (`navigator.userAgentData.platform`)
 * which returns clean values like `"Windows"`, `"macOS"`, `"Android"`.
 * Falls back to pattern-matching the legacy `navigator.userAgent` string.
 */
function detectOS(uaData: NavigatorUAData | undefined, ua: string): string | undefined {
  if (uaData?.platform) return uaData.platform;

  if (/Windows/.test(ua)) return "Windows";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Macintosh|Mac OS/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  if (/CrOS/.test(ua)) return "ChromeOS";

  return undefined;
}

/**
 * Detects the browser name.
 *
 * From Client Hints, picks the first brand that is not the generic `"Chromium"`
 * engine and not a GREASE brand (those contain `"Not"` in the name).
 * Falls back to UA string matching.
 */
function detectBrowser(uaData: NavigatorUAData | undefined, ua: string): string | undefined {
  if (uaData?.brands?.length) {
    const real = uaData.brands.find(
      (b) => !b.brand.includes("Chromium") && !b.brand.includes("Not"),
    );
    if (real) return real.brand;
  }

  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";

  return undefined;
}

/**
 * Classifies the device as mobile, tablet, or desktop using a simple heuristic.
 *
 * - `navigator.userAgentData.mobile` is authoritative when available.
 * - Otherwise: screen width < 768 → mobile; < 1024 with touch → tablet.
 */
function detectDeviceType(uaData: NavigatorUAData | undefined): string {
  if (uaData?.mobile) return "mobile";

  const width = typeof screen !== "undefined" ? screen.width : 1024;
  const hasTouch = typeof window !== "undefined" && "ontouchstart" in window;

  if (width < 768) return "mobile";
  if (width < 1024 && hasTouch) return "tablet";
  return "desktop";
}

/**
 * Collects visitor context from browser APIs.
 *
 * Returns an empty object when called outside a browser environment
 * (`window` is undefined), making it safe to call during SSR.
 *
 * Only keys with non-empty values are included in the returned object.
 *
 * @returns A plain object mapping `$`-prefixed key → value.
 *
 * @example
 * collectContext();
 * // => { $os: "macOS", $browser: "Chrome", $language: "en-US", ... }
 */
export function collectContext(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";

  const result: Record<string, string> = {};

  const os = detectOS(uaData, ua);
  if (os) result.$os = os;

  const browser = detectBrowser(uaData, ua);
  if (browser) result.$browser = browser;

  if (typeof navigator !== "undefined" && navigator.language) {
    result.$language = navigator.language;
  }

  if (typeof screen !== "undefined") {
    result.$screen = `${screen.width}x${screen.height}`;
  }

  result.$viewport = `${window.innerWidth}x${window.innerHeight}`;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) result.$timezone = tz;
  } catch {
    // Intl may be unavailable in exotic environments.
  }

  result.$device_type = detectDeviceType(uaData);

  return result;
}

/**
 * SPA (Single-Page Application) route change detection.
 *
 * Traditional multi-page websites trigger a full page reload on every
 * navigation, so the SDK's `init()` call on each new page is enough to
 * track pageviews. SPAs, however, update the URL and render new content
 * **without** reloading the page, so we need to intercept the History API.
 *
 * ## How it works
 *
 * The browser's History API exposes three ways to change the URL without
 * reloading the page:
 * - `history.pushState(...)` — navigate to a new URL (creates a history entry)
 * - `history.replaceState(...)` — update the current URL in-place (no new entry)
 * - `popstate` event — fired on browser back/forward button clicks
 *
 * None of these emit a native `load` or `navigate` event, so we intercept
 * `pushState` and `replaceState` by wrapping them, and listen for `popstate`.
 *
 * ## Deduplication
 *
 * Some frameworks call `replaceState` repeatedly to sync query params without
 * actually navigating (e.g. updating a `?page=2` filter). To avoid counting
 * these as separate pageviews, consecutive navigations to the **same URL**
 * (path + search) are deduplicated.
 *
 * ## Cleanup
 *
 * The function returns a teardown callback. Always call it before re-running
 * `TGA.init()` (e.g. in tests or framework hot-reload scenarios) to restore
 * the original `history` methods and remove event listeners.
 */

/**
 * Installs intercepts for SPA route changes and calls `onNavigate` after each
 * distinct URL change.
 *
 * @param onNavigate - Callback invoked after every distinct navigation.
 *                     Typically `() => TGA.pageview()`.
 * @returns A teardown function. Call it to remove all hooks and restore the
 *          original `history.pushState` / `history.replaceState`.
 *
 * @example
 * const teardown = installSpaListeners(() => TGA.pageview());
 *
 * // When the SDK is reset or the app is unmounted:
 * teardown();
 */
export function installSpaListeners(onNavigate: () => void): () => void {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  // Track the URL at install time so we can deduplicate same-URL navigations.
  let lastUrl = currentUrl();

  /**
   * Called after every `pushState`, `replaceState`, or `popstate`.
   * Skips the callback when the URL has not actually changed.
   */
  function handleNavigation(): void {
    const next = currentUrl();
    if (next === lastUrl) return; // same URL — nothing to track
    lastUrl = next;
    onNavigate();
  }

  // Wrap pushState — called by frameworks on every "navigate to new route".
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    handleNavigation();
  };

  // Wrap replaceState — called on in-place URL updates (query-string changes,
  // hash updates, etc.).
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args);
    handleNavigation();
  };

  // popstate fires when the user presses the browser Back or Forward button.
  const onPopState = (): void => handleNavigation();
  window.addEventListener("popstate", onPopState);

  // Return the teardown function so callers can clean up when needed.
  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onPopState);
  };
}

/**
 * Returns the current URL as `pathname + search`, used for deduplication.
 * The hash fragment is intentionally excluded — hash changes alone should
 * not be counted as new pageviews.
 */
function currentUrl(): string {
  return window.location.pathname + window.location.search;
}

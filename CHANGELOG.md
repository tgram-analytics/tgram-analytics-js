# Changelog

All notable changes to `tgram-analytics` (the JS SDK) are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-10-04

### Added
- **Test mode.** New `test` option in `TGA.init()`, `false` by default. When `true`, every request body (track, pageview, taps) includes `"test": true`. The server stores test events but leaves them out of analytics; recent activity still shows them, marked as test. Test taps are not stored. When `false`, the field is not sent. Servers without test-event support ignore the field. See [Test mode](./README.md#test-mode).

## [0.3.1] — 2026-09-29

### Changed
- Releases publish to npm through trusted publishing (OIDC) instead of a stored token. No code changes. 0.3.0 was tagged but not published to npm; 0.3.1 is the first npm release with tap heatmaps.

## [0.3.0] — 2026-09-29

### Added
- **Tap heatmaps (opt-in).** New `heatmaps` option in `TGA.init()`, `false` by default. When `true`, the SDK sends one request per pageview to `POST /api/v1/taps` with up to 50 taps and the maximum scroll depth. A tap holds its position (`x` as a fraction of the document width, `y` in CSS px from the page top, viewport px for fixed or sticky targets) and a short element label (`data-tga-label`, `aria-label`, `id`, else the tag; links, buttons, labels, summaries, `role="button"` and `role="link"` add up to 40 characters of visible text from text nodes, skipping `script`, `style`, `noscript`, `template` and hidden elements). The SDK never reads the value or the text of `input`, `textarea`, `select`, or contenteditable elements. Taps inside `data-tga-ignore` elements are not recorded. `opt("out")` discards pending taps and scroll depth at once. See [Tap heatmaps (opt-in)](./README.md#tap-heatmaps-opt-in).
- `npm run size`: prints the gzip size of each bundle and fails when `dist/index.js` is above 4,096 B. CI runs it after the build.

### Changed
- README size claim corrected. The ESM build was 2,814 B gzip at 0.2.0, not "< 2 KB". It is 3,816 B gzip at 0.3.0.

### Unchanged
- With `heatmaps` off (the default), the SDK sends the same requests as 0.2.0.

## [0.2.0] — 2026-05-16

### Added
- **Array-valued event properties.** `EventProperties` now accepts arrays of scalars (`string | number | boolean | null`), enabling multi-select onboarding answers, A/B variant memberships, and any set-style attribute that previously needed lossy workarounds (CSV strings, one boolean per option, or N events).

  ```ts
  TGA.track("onboarding_completed", {
    role: "creator",
    interest_set: ["vertical_to_horizontal", "unsure"], // new!
  });
  ```

  Arrays whose key ends in `_set` are sorted alphabetically by the server at write time, so `GROUP BY properties->'interest_set'` lands `["a","b"]` and `["b","a"]` in the same bucket. Other array properties keep insertion order. See the [Multi-value properties](./README.md#multi-value-properties) section for the canonical pie-chart and combo queries.

- **Runtime validation** on `track()` and `identify()` properties. Nested objects, nested arrays, `undefined`, `NaN`, and `Infinity` now throw synchronously with a clear error that names the bad key — surfacing developer mistakes in dev rather than silently storing garbage server-side.

### Changed
- `EventProperties` widened from `Record<string, Scalar>` to `Record<string, Scalar | Scalar[]>`. **Non-breaking:** all existing scalar-only code continues to typecheck and round-trip unchanged.

## [0.1.1]

Initial public release.

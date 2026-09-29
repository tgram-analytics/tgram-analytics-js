# Changelog

All notable changes to `tgram-analytics` (the JS SDK) are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-09-29

### Added
- **Tap heatmaps (opt-in).** New `heatmaps` option in `TGA.init()`, `false` by default. When `true`, the SDK sends one request per pageview to `POST /api/v1/taps` with up to 50 taps and the maximum scroll depth. A tap holds its position (`x` as a fraction of the document width, `y` in CSS px from the page top, viewport px for fixed or sticky targets) and a short element label (`data-tga-label`, `aria-label`, `id`, or the tag plus up to 40 characters of visible text). The SDK never reads the value or the text of `input`, `textarea`, `select`, or contenteditable elements. Taps inside `data-tga-ignore` elements are not recorded. See [Tap heatmaps (opt-in)](./README.md#tap-heatmaps-opt-in).
- `npm run size`: prints the gzip size of each bundle and fails when `dist/index.js` is above 4,096 B. CI runs it after the build.

### Changed
- README size claim corrected. The ESM build was 2,814 B gzip at 0.2.0, not "< 2 KB". It is 3,693 B gzip at 0.3.0.

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

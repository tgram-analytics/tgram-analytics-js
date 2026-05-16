# Changelog

All notable changes to `tgram-analytics` (the JS SDK) are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

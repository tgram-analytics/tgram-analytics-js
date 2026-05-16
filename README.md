# tgram-analytics JS SDK

Lightweight, privacy-first analytics SDK for [tgram-analytics](https://github.com/tgram-analytics/server).

- **Zero dependencies** — only browser APIs
- **< 2 KB gzipped** — won't slow your page down
- **TypeScript-first** — full type definitions included, no `@types` package needed
- **Privacy-friendly** — no cookies, no fingerprinting, respects Do Not Track
- **SPA-ready** — auto-tracks route changes with React Router, Vue Router, Next.js, etc.

---

## Prerequisites

Before using this SDK you need:

1. A running tgram-analytics server. See the [server repo](https://github.com/tgram-analytics/server) for setup instructions.
2. A project API key. Create one by sending `/add myapp.com` to the Telegram bot. The bot replies with a key that starts with `proj_`.

Get a free `proj_` API key from [@MyTelegramAnalyticsBot](https://t.me/MyTelegramAnalyticsBot) on Telegram (1 project free), or [self-host the server](https://github.com/tgram-analytics/server) and create keys via your own bot.

---

## Installation

### npm / yarn / pnpm

```bash
npm install tgram-analytics
```

### `<script>` tag (no build step needed)

Host `dist/index.iife.js` from your server (or a CDN) and load it on your page. It exposes the global `TGA` object.

```html
<script src="https://your-server.com/sdk/tga.min.js"></script>
<script>
  TGA.init("proj_xxx", { serverUrl: "https://your-server.com" });
</script>
```

---

## Quick start

### ESM / TypeScript

```ts
import TGA from "tgram-analytics";

// Step 1 — initialise once, at the top of your app.
TGA.init("proj_abc123", {
  serverUrl: "https://analytics.example.com",
});

// Step 2 — track custom events anywhere in your code.
TGA.track("purchase", { amount: 49, currency: "USD", plan: "pro" });
```

Pageviews are sent automatically on load and on every SPA route change — no extra code needed.

### CommonJS

```js
const { default: TGA } = require("tgram-analytics");

TGA.init("proj_abc123", { serverUrl: "https://analytics.example.com" });
TGA.track("signup");
```

---

## API reference

### `TGA.init(apiKey, options)`

Initialises the SDK. **Call this once**, before using any other method.

```ts
TGA.init("proj_abc123", {
  serverUrl: "https://analytics.example.com",
  autoPageview: true,
  respectDNT: true,
});
```

Throws an `Error` if `apiKey` is invalid or `serverUrl` is missing.

---

### `TGA.track(eventName, properties?)`

Tracks a custom named event.

```ts
TGA.track("purchase", { amount: 49, currency: "USD", plan: "pro" });
TGA.track("signup"); // properties are optional
```

| Parameter    | Type               | Description |
|--------------|--------------------|-------------|
| `eventName`  | `string`           | Event identifier, e.g. `"purchase"`, `"signup"`. |
| `properties` | `EventProperties?` | Optional key-value metadata. Values must be `string`, `number`, `boolean`, `null`, or an **array of those scalars**. See [Multi-value properties](#multi-value-properties). |

---

### `TGA.pageview(url?, referrer?)`

Tracks a pageview. You rarely need this — `autoPageview: true` (the default) handles it automatically.

```ts
// Use defaults (current URL and document.referrer).
TGA.pageview();

// Pass explicit values.
TGA.pageview("/checkout", "https://example.com/cart");
```

| Parameter  | Type      | Default |
|------------|-----------|---------|
| `url`      | `string?` | `window.location.pathname + search` |
| `referrer` | `string?` | `document.referrer` |

---

### `TGA.identify(properties)`

Attaches persistent properties to every subsequent `track()` call.

```ts
// After a user logs in:
TGA.identify({ plan: "pro", locale: "en-US" });

// Every subsequent track() call now includes plan and locale automatically.
TGA.track("purchase", { amount: 49 }); // => properties: { plan, locale, amount }
```

Per-event properties (passed directly to `track()`) override `identify()` properties when keys conflict.

---

### `TGA.opt("in" | "out")`

Manually opts the current user in or out of tracking.

```ts
// Disable all tracking (e.g. user declined consent banner).
TGA.opt("out");

// Re-enable tracking.
TGA.opt("in");
```

> **Note:** The opt-out state is not persisted across page loads. If you want persistence, store the preference yourself (e.g. in `localStorage`) and call `TGA.opt("out")` on every page load when needed.

---

### `TGA.flush()`

Force-sends all buffered events immediately. Only relevant when `batch` is enabled.

```ts
// Ensure no events are lost before a programmatic navigation.
await TGA.flush();
router.push("/thank-you");
```

Returns `Promise<void>`.

---

### `TGA.reset()`

Starts a new session. Clears the session ID from `sessionStorage` and generates a fresh one. Also clears all properties set via `identify()`.

```ts
function onLogout() {
  TGA.reset();
  // Future events are now attributed to a new anonymous session.
}
```

---

## Configuration options

All options are passed as the second argument to `TGA.init()`.

| Option         | Type                          | Default | Description |
|----------------|-------------------------------|---------|-------------|
| `serverUrl`    | `string`                      | —       | **Required.** Base URL of your tgram-analytics server. No trailing slash. |
| `autoPageview` | `boolean`                     | `true`  | Automatically track pageviews on load and SPA navigations. |
| `respectDNT`   | `boolean`                     | `true`  | Honour the browser's Do Not Track setting. |
| `batch`        | `boolean \| BatchOptions`     | `false` | Buffer events before sending. See [Batching](#batching). |
| `sessionId`    | `string`                      | —       | Override the auto-generated session ID. Rarely needed. |

### `BatchOptions`

| Option    | Type     | Default | Description |
|-----------|----------|---------|-------------|
| `maxSize` | `number` | `10`    | Send when the buffer reaches this many events. |
| `maxWait` | `number` | `5000`  | Send after this many milliseconds, even if `maxSize` is not reached. |

---

## SPA support

When `autoPageview` is `true` (the default), the SDK automatically sends a pageview after every distinct URL change — no configuration required. It works with:

- **React Router** — `pushState` / `popstate`
- **Vue Router** — `pushState` / `replaceState`
- **Next.js App Router** — `pushState`
- **Svelte Kit** — `pushState`
- **Any other framework** that uses the History API

Consecutive navigations to the **same URL** are deduplicated, so rapid `replaceState` calls (e.g. syncing query params) do not generate duplicate pageviews.

---

## Batching

Batching is useful when you track many events in a short time (e.g. scroll depth, click heatmaps). Instead of one request per event, the SDK buffers events and sends them together.

```ts
TGA.init("proj_xxx", {
  serverUrl: "https://analytics.example.com",
  batch: { maxSize: 20, maxWait: 3000 },
});
```

The queue flushes automatically when:
- The buffer reaches `maxSize` events.
- `maxWait` milliseconds have passed since the first event in the batch.
- The user navigates away from the page (`visibilitychange`, `pagehide`).
- You call `TGA.flush()` manually.

---

## Multi-value properties

Properties accept **arrays of scalars** in addition to single scalars — useful for multi-select inputs, A/B variant memberships, or any set-style attribute that would otherwise be lossy to flatten into one column.

```ts
TGA.track("onboarding_completed", {
  role: "creator",
  frequency: "weekly",
  interest_set: ["vertical_to_horizontal", "unsure"], // <-- array
});
```

The server stores the array natively in the JSONB `properties` column, so a single event powers two complementary dashboards:

```sql
-- 1. Per-element counts (e.g. a pie chart of how often each interest is picked):
SELECT elem, count(*) AS n
FROM events,
     jsonb_array_elements_text(properties->'interest_set') AS elem
WHERE name = 'onboarding_completed'
GROUP BY elem
ORDER BY n DESC;

-- 2. Most common combinations of selected values:
SELECT properties->'interest_set' AS combo, count(*) AS n
FROM events
WHERE name = 'onboarding_completed'
GROUP BY combo
ORDER BY n DESC
LIMIT 20;
```

### Sort behaviour

The server applies **write-time sorting** to array properties whose key ends in `_set` (e.g. `interest_set`, `feature_flags_set`). This makes the "combo" query above a trivial `GROUP BY` — `["a", "b"]` and `["b", "a"]` land in the same bucket.

Other array properties are stored in the order you sent them, so any insertion-ordered list (e.g. `recent_searches: ["pizza", "pasta"]`) keeps its meaning.

### Allowed value shapes

| Shape                          | Allowed? | Example                               |
|--------------------------------|----------|---------------------------------------|
| Scalar                         | ✅       | `{ amount: 49 }`                      |
| Array of strings               | ✅       | `{ tags_set: ["a", "b"] }`            |
| Array of numbers / booleans    | ✅       | `{ scores: [1, 2, 3] }`               |
| Heterogeneous array of scalars | ✅       | `{ misc: ["a", 1, true] }`            |
| Nested object                  | ❌       | `{ user: { id: 1 } }`                 |
| Nested array                   | ❌       | `{ matrix: [[1, 2]] }`                |
| `undefined` / `NaN` / `Infinity` | ❌     | `{ x: undefined }`                    |

Bad shapes throw a clear error synchronously from `track()` / `identify()` so they surface in dev rather than silently corrupting your data.

---

## Privacy

- **No cookies.** Session IDs are stored in `sessionStorage` only, which is scoped to a single tab and cleared automatically when the tab closes.
- **No fingerprinting.** The SDK does not access canvas, WebGL, audio, or any other fingerprinting surface.
- **Do Not Track.** When `respectDNT: true` (the default), the SDK checks `navigator.doNotTrack` on init. If DNT is enabled, all tracking is silently disabled — no requests are sent.
- **Write-only API.** The server's ingestion endpoints are write-only. No user data can be read back via the API key.

---

## CORS and domain allowlist

The server enforces a **domain allowlist** per project. When the allowlist is not empty, requests from origins not on the list are rejected with `403 Forbidden`.

To add your domain:
1. Open the Telegram bot.
2. Send `/projects` and select your project.
3. Tap **⚙️ Settings** → **Domain allowlist** and add your domain.

If you are developing locally, either leave the allowlist empty (allows all origins) or add `http://localhost:3000` (or whichever port you use).

The server must also have CORS middleware enabled. If you deployed using the official server image, CORS is configured automatically.

---

## TypeScript

Full type definitions are included in the package — no separate `@types` package is needed.

```ts
import TGA from "tgram-analytics";
import type { TGAOptions, EventProperties } from "tgram-analytics";

const options: TGAOptions = {
  serverUrl: "https://analytics.example.com",
  autoPageview: true,
};

TGA.init("proj_xxx", options);

const props: EventProperties = { amount: 49, plan: "pro" };
TGA.track("purchase", props);
```

---

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

### Development setup

```bash
git clone https://github.com/tgram-analytics/tgram-analytics-js
cd tgram-analytics-js
npm install
```

### Available commands

| Command           | Description |
|-------------------|-------------|
| `npm run build`   | Build all output formats to `dist/` |
| `npm test`        | Run the test suite |
| `npm run typecheck` | Check TypeScript types (no emit) |
| `npm run check`   | Lint + format with Biome (auto-fixes) |
| `npm run lint`    | Lint only |
| `npm run format`  | Format only |

### Before submitting a PR

1. Run `npm run check` — fixes linting and formatting automatically.
2. Run `npm test` — all tests must pass.
3. Run `npm run typecheck` — zero TypeScript errors.
4. Run `npm run build` — the build must succeed.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Links

- Website: <https://tgram-analytics.com>
- Server (API): <https://github.com/tgram-analytics/server>
- JS SDK: <https://github.com/tgram-analytics/tgram-analytics-js>
- Python SDK: <https://github.com/tgram-analytics/tgram-analytics-py>
- Flutter SDK: <https://github.com/tgram-analytics/tgram-analytics-flutter>

/**
 * Tests for the opt-in tap heatmap collector (src/heatmap.ts) and its wiring
 * into TGAClient.
 *
 * Clicks are driven with `dispatchEvent(new MouseEvent("click", ...))`.
 * jsdom has no layout, so `pageX` / `pageY` and the document size are stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TGAClient } from "../src/client.js";
import { labelFor, viewportBucket } from "../src/heatmap.js";
import type { TapsPayload } from "../src/types.js";
import { beaconMock, fetchMock } from "./setup.js";

const SERVER = "https://analytics.example.com";
const API_KEY = "proj_testkey123";
const TAPS_URL = `${SERVER}/api/v1/taps`;

const clients: TGAClient[] = [];

function makeClient(overrides: Partial<Parameters<TGAClient["init"]>[1]> = {}): TGAClient {
  const client = new TGAClient();
  client.init(API_KEY, { serverUrl: SERVER, autoPageview: false, heatmaps: true, ...overrides });
  clients.push(client);
  return client;
}

/** Dispatches a click on `el` with the given page / client coordinates. */
function click(el: Element, pageX = 10, pageY = 10, clientX = pageX, clientY = pageY): void {
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(ev, "pageX", { value: pageX });
  Object.defineProperty(ev, "pageY", { value: pageY });
  el.dispatchEvent(ev);
}

/** Simulates the page being hidden, which makes the SDK flush pending taps. */
function hidePage(): void {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
}

/** All payloads sent with fetch to the taps endpoint. */
function tapFetchBodies(): TapsPayload[] {
  return fetchMock.mock.calls
    .filter(([url]) => url === TAPS_URL)
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as TapsPayload);
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });
}

/** Payloads sent to the taps endpoint with sendBeacon. */
async function tapBeaconBodies(): Promise<TapsPayload[]> {
  const calls = beaconMock.mock.calls.filter(([url]) => url === TAPS_URL);
  const texts = await Promise.all(calls.map(([, blob]) => blobText(blob as Blob)));
  return texts.map((t) => JSON.parse(t) as TapsPayload);
}

function stubDoc(width: number, height: number): void {
  Object.defineProperty(document.documentElement, "scrollWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: height,
    configurable: true,
  });
}

function html(markup: string): void {
  document.body.innerHTML = markup;
}

function $(selector: string): Element {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

beforeEach(() => {
  history.replaceState(null, "", "/start");
  stubDoc(1000, 3000);
  Object.defineProperty(globalThis, "innerWidth", { value: 1440, configurable: true });
  Object.defineProperty(globalThis, "scrollY", { value: 0, configurable: true });
});

afterEach(() => {
  while (clients.length) clients.pop()?.reset();
  document.body.innerHTML = "";
});

describe("heatmaps opt-in", () => {
  it("heatmaps_off_by_default_sends_no_taps", () => {
    const client = new TGAClient();
    client.init(API_KEY, { serverUrl: SERVER, autoPageview: false });
    clients.push(client);
    html("<button>Buy</button>");
    click($("button"));
    hidePage();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(beaconMock).not.toHaveBeenCalled();
  });
});

describe("labels", () => {
  it("label_prefers_data_tga_label", () => {
    html(`<button data-tga-label="cta" aria-label="Aria" id="b1">Text</button>`);
    expect(labelFor($("button"))).toBe("cta");
  });

  it("label_falls_back_to_aria_label", () => {
    html(`<button aria-label="Close dialog" id="b1">X</button>`);
    expect(labelFor($("button"))).toBe("Close dialog");
  });

  it("label_falls_back_to_id", () => {
    html(`<div id="hero"><span>Hello</span></div>`);
    expect(labelFor($("span"))).toBe("div#hero");
  });

  it("label_uses_tag_and_visible_text_truncated_to_40", () => {
    const long = "Browse   all\n the   albums ".repeat(4);
    html(`<a href="/x"><span>${long}</span></a>`);
    const text = long.replace(/\s+/g, " ").trim().slice(0, 40);
    expect(labelFor($("span"))).toBe(`a "${text}"`);
    expect(text).toHaveLength(40);
  });

  it("label_is_bare_tag_when_there_is_no_text", () => {
    html("<button><svg></svg></button>");
    expect(labelFor($("svg"))).toBe("button");
  });

  it("label_is_capped_at_80_chars", () => {
    html(`<button aria-label="${"a".repeat(200)}">x</button>`);
    expect(labelFor($("button"))).toHaveLength(80);
  });
});

describe("form fields and editable content", () => {
  it("input_value_never_leaves_the_browser", async () => {
    makeClient();
    html(`<form><input name="pw"><button type="button">Go</button></form>`);
    const input = $("input") as HTMLInputElement;
    input.value = "hunter2-secret";
    input.setAttribute("value", "hunter2-secret");
    click(input);
    click($("button"));
    hidePage(); // flush through sendBeacon
    // A second round through fetch (route change), to cover both transports.
    input.dispatchEvent(new Event("input", { bubbles: true }));
    click(input);
    clients[0].track("form_submit");
    clients[0].pageview("/next");

    const fetchTexts = fetchMock.mock.calls.map(([, init]) => String((init as RequestInit).body));
    const beaconTexts = await Promise.all(
      beaconMock.mock.calls.map(([, blob]) => blobText(blob as Blob)),
    );
    expect(beaconTexts.length).toBeGreaterThan(0);
    expect(fetchTexts.length).toBeGreaterThan(0);
    for (const text of [...fetchTexts, ...beaconTexts]) {
      expect(text).not.toContain("hunter2");
    }
    const [beacon] = await tapBeaconBodies();
    expect(beacon.taps[0].el).toBe("input[type=text]");
  });

  it("textarea_select_contenteditable_send_tag_only", () => {
    html(`
      <textarea>secret draft</textarea>
      <select><option>secret option</option></select>
      <div contenteditable="true"><p>secret note</p></div>
      <input type="email" value="me@example.com">
    `);
    expect(labelFor($("textarea"))).toBe("textarea");
    expect(labelFor($("option"))).toBe("select");
    expect(labelFor($("[contenteditable] p"))).toBe("p");
    expect(labelFor($("input"))).toBe("input[type=email]");
  });

  it("ancestor_contenteditable_text_is_not_read", () => {
    html(`
      <button id="outer-1"><span contenteditable>typed words</span></button>
      <a href="/x"><span contenteditable="">typed words</span> more</a>
      <label>Name <textarea>draft words</textarea></label>
    `);
    // The chosen element holds an editable descendant: no text at all.
    expect(labelFor($("a"))).toBe("a");
    // The chosen element holds a textarea (whose text is its value): no text.
    expect(labelFor($("label"))).toBe("label");
    // Target inside an editable region never contributes text.
    expect(labelFor($("a span"))).not.toContain("typed");
  });
});

describe("data-tga-ignore", () => {
  it("skips_data_tga_ignore_on_self", () => {
    makeClient();
    html("<button data-tga-ignore>Pay</button>");
    click($("button"));
    hidePage();
    expect(beaconMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips_data_tga_ignore_on_ancestor", async () => {
    makeClient();
    html("<section data-tga-ignore><div><button>Pay</button></div></section><a>Ok</a>");
    click($("button"));
    click($("a"));
    hidePage();
    const [body] = await tapBeaconBodies();
    expect(body.taps).toHaveLength(1);
    expect(body.taps[0].el).toBe('a "Ok"');
  });
});

describe("tap collection", () => {
  it("caps_at_50_taps_per_pageview", () => {
    makeClient();
    html("<button>Tap</button>");
    for (let i = 0; i < 60; i++) click($("button"), 10, i);
    // The 50th tap flushes at once; later taps on the same page are dropped.
    let bodies = tapFetchBodies();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].taps).toHaveLength(50);
    hidePage();
    expect(beaconMock).not.toHaveBeenCalled();
    // A new page starts a new budget.
    clients[0].pageview("/other");
    click($("button"));
    clients[0].pageview("/third");
    bodies = tapFetchBodies();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({ path: "/other", taps: [{ el: 'button "Tap"' }] });
  });

  it("x_is_document_fraction_y_is_css_px", () => {
    stubDoc(400, 5000);
    makeClient();
    html("<button>Browse albums</button>");
    click($("button"), 100, 1330, 100, 200);
    clients[0].pageview("/next");
    const [body] = tapFetchBodies();
    expect(body.taps[0]).toEqual({ x: 0.25, y: 1330, el: 'button "Browse albums"' });
  });

  it("x_is_clamped_and_rounded", () => {
    stubDoc(300, 5000);
    makeClient();
    html("<button>b</button>");
    click($("button"), 100, 5);
    click($("button"), 900, 5);
    clients[0].pageview("/next");
    const [body] = tapFetchBodies();
    expect(body.taps.map((t) => t.x)).toEqual([0.333, 1]);
  });

  it("sticky_target_uses_viewport_y", () => {
    makeClient();
    html("<header><nav><a>Home</a></nav></header><main><p>Body</p></main>");
    const header = $("header");
    const real = window.getComputedStyle.bind(window);
    const spy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((el: Element) =>
        el === header ? ({ position: "sticky" } as CSSStyleDeclaration) : real(el),
      );
    click($("a"), 50, 3000, 50, 20);
    click($("p"), 50, 3000, 50, 20);
    spy.mockRestore();
    clients[0].pageview("/next");
    const [body] = tapFetchBodies();
    expect(body.taps.map((t) => t.y)).toEqual([20, 3000]);
  });

  it("payload_carries_viewport_width", () => {
    Object.defineProperty(globalThis, "innerWidth", { value: 390, configurable: true });
    makeClient();
    html("<button>b</button>");
    click($("button"));
    clients[0].pageview("/next");
    const [body] = tapFetchBodies();
    expect(body).toMatchObject({
      api_key: API_KEY,
      path: "/start",
      viewport: "mobile",
      vw: 390,
    });
    expect(typeof body.session_id).toBe("string");
    expect(Object.keys(body).sort()).toEqual(
      ["api_key", "path", "session_id", "taps", "viewport", "vw"].sort(),
    );
  });

  it("viewport_bucket_from_inner_width", () => {
    expect(viewportBucket(390)).toBe("mobile");
    expect(viewportBucket(767)).toBe("mobile");
    expect(viewportBucket(768)).toBe("tablet");
    expect(viewportBucket(800)).toBe("tablet");
    expect(viewportBucket(1024)).toBe("desktop");
    expect(viewportBucket(1440)).toBe("desktop");
  });

  it("flushes_on_visibility_hidden_with_beacon", async () => {
    makeClient();
    html("<button>b</button>");
    click($("button"));
    expect(beaconMock).not.toHaveBeenCalled();
    hidePage();
    const bodies = await tapBeaconBodies();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].taps).toHaveLength(1);
    // Nothing pending: a second hide sends nothing more.
    hidePage();
    expect(beaconMock).toHaveBeenCalledTimes(1);
  });

  it("flushes_on_pagehide", () => {
    makeClient();
    html("<button>b</button>");
    click($("button"));
    window.dispatchEvent(new Event("pagehide"));
    expect(tapFetchBodies()).toHaveLength(1);
  });

  it("flushes_old_path_on_spa_navigation_then_tracks_new_path", () => {
    makeClient({ autoPageview: true });
    html("<button>b</button>");
    click($("button"), 10, 11);
    history.pushState(null, "", "/next?q=1");
    const urls = fetchMock.mock.calls.map(([url]) => url);
    // Initial pageview, then the old page's taps, then the new pageview.
    expect(urls).toEqual([`${SERVER}/api/v1/pageview`, TAPS_URL, `${SERVER}/api/v1/pageview`]);
    click($("button"), 10, 22);
    history.pushState(null, "", "/last");
    const bodies = tapFetchBodies();
    expect(bodies.map((b) => [b.path, b.taps[0].y])).toEqual([
      ["/start", 11],
      ["/next?q=1", 22],
    ]);
  });

  it("sends_max_scroll_depth_once_per_pageview", () => {
    stubDoc(1000, 2000);
    Object.defineProperty(globalThis, "innerHeight", { value: 500, configurable: true });
    makeClient();
    const scrollTo = (y: number) => {
      Object.defineProperty(globalThis, "scrollY", { value: y, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    };
    scrollTo(500);
    scrollTo(740); // (740 + 500) / 2000 = 0.62
    scrollTo(100);
    hidePage();
    Object.defineProperty(globalThis, "innerHeight", { value: 900, configurable: true });
    scrollTo(1500);
    html("<button>b</button>");
    click($("button"));
    clients[0].pageview("/next");
    return tapBeaconBodies().then((beacons) => {
      expect(beacons).toHaveLength(1);
      expect(beacons[0].scroll).toBe(0.62);
      expect(beacons[0].taps).toEqual([]);
      const [later] = tapFetchBodies();
      expect(later.scroll).toBeUndefined();
      expect(later.taps).toHaveLength(1);
    });
  });

  it("sends_nothing_when_there_is_no_tap_and_no_scroll", () => {
    makeClient();
    hidePage();
    clients[0].pageview("/next");
    expect(beaconMock).not.toHaveBeenCalled();
    expect(tapFetchBodies()).toHaveLength(0);
  });

  it("opt_out_stops_taps", () => {
    makeClient();
    html("<button>b</button>");
    clients[0].opt("out");
    click($("button"));
    window.dispatchEvent(new Event("scroll"));
    clients[0].opt("in");
    hidePage();
    clients[0].pageview("/next");
    expect(beaconMock).not.toHaveBeenCalled();
    expect(tapFetchBodies()).toHaveLength(0);
  });

  it("does_not_install_when_do_not_track_is_on", () => {
    Object.defineProperty(globalThis.navigator, "doNotTrack", { value: "1", configurable: true });
    try {
      makeClient();
      html("<button>b</button>");
      click($("button"));
      hidePage();
      expect(beaconMock).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis.navigator, "doNotTrack", {
        value: null,
        configurable: true,
      });
    }
  });

  it("uses_the_batch_queue_when_batching_is_on", async () => {
    makeClient({ batch: { maxSize: 100, maxWait: 60_000 } });
    html("<button>b</button>");
    click($("button"));
    clients[0].pageview("/next");
    expect(fetchMock).not.toHaveBeenCalled();
    await clients[0].flush();
    expect(tapFetchBodies()).toHaveLength(1);
  });
});

describe("opt-out and navigation", () => {
  it("pageview_while_opted_out_still_moves_the_tap_path", () => {
    makeClient();
    html("<button>b</button>");
    clients[0].opt("out");
    clients[0].pageview("/while-out");
    clients[0].opt("in");
    click($("button"));
    clients[0].pageview("/after");
    const bodies = tapFetchBodies();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].path).toBe("/while-out");
  });

  it("pending_taps_are_dropped_after_opt_out", () => {
    makeClient();
    html("<button>b</button>");
    click($("button"));
    clients[0].opt("out");
    hidePage();
    clients[0].opt("in");
    clients[0].pageview("/next");
    expect(beaconMock).not.toHaveBeenCalled();
    expect(tapFetchBodies()).toHaveLength(0);
  });
});

describe("review follow-up", () => {
  it("script_style_and_hidden_text_never_reach_the_label", () => {
    html(`
      <button><script>var token = "abc123";</script><style>.x{}</style>Save<span hidden>secret</span><span aria-hidden="true">icon</span> now</button>
    `);
    const label = labelFor($("button"));
    expect(label).toBe('button "Save now"');
    expect(label).not.toContain("token");
    expect(label).not.toContain("secret");
  });

  it("non_interactive_element_gives_tag_only", () => {
    html("<p>Email: leo@example.com</p><div><span>Some private text</span></div>");
    expect(labelFor($("p"))).toBe("p");
    expect(labelFor($("span"))).toBe("span");
  });

  it("role_link_gives_text", () => {
    html('<div role="link"><span>Open album</span></div>');
    expect(labelFor($("span"))).toBe('div "Open album"');
  });

  it("opt_out_discards_pending_taps_and_scroll_at_once", () => {
    makeClient();
    html("<button>b</button>");
    click($("button"));
    Object.defineProperty(globalThis, "scrollY", { value: 900, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    clients[0].opt("out");
    clients[0].opt("in");
    hidePage();
    clients[0].pageview("/next");
    expect(beaconMock).not.toHaveBeenCalled();
    expect(tapFetchBodies()).toHaveLength(0);
  });

  it("scroll_depth_uses_page_height_at_flush_time", () => {
    stubDoc(1000, 1000);
    Object.defineProperty(globalThis, "innerHeight", { value: 500, configurable: true });
    makeClient();
    Object.defineProperty(globalThis, "scrollY", { value: 500, configurable: true });
    window.dispatchEvent(new Event("scroll")); // bottom = 1000 px
    stubDoc(1000, 4000); // the page grew after the scroll
    clients[0].pageview("/next");
    expect(tapFetchBodies()[0].scroll).toBe(0.25);
  });
});

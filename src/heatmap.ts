/**
 * Opt-in tap heatmaps (`TGAOptions.heatmaps`).
 *
 * Records the position and a short label of each tap or click on the page,
 * plus the maximum scroll depth, and sends them as one request per pageview
 * to `POST /api/v1/taps`.
 *
 * ## What a tap contains
 * - `x`: `pageX / document width`, 0..1, 3 decimals.
 * - `y`: `pageY` in CSS px from the page top. For a target inside a
 *   `position: fixed` or `sticky` element, `clientY` (viewport px), so taps on
 *   a sticky header stay at the top of the page.
 * - `el`: a label, see {@link labelFor}.
 *
 * ## What is never read
 * The value or text of `input`, `textarea`, `select`, and contenteditable
 * elements. Taps inside an element with `data-tga-ignore` are dropped.
 *
 * ## When it sends
 * On route change (the next pageview), when the page is hidden, and when a
 * page reaches 50 taps. Later taps on the same page are dropped. The scroll
 * depth is sent once per pageview.
 */

import type { TapPoint, TapsPayload } from "./types.js";

/** Endpoint for tap batches, relative to `serverUrl`. */
export const TAPS_ENDPOINT = "/api/v1/taps";

const MAX_TAPS = 50;

/** Interactive elements: the only ones whose visible text can be a label. */
const TEXTUAL = 'a,button,label,summary,[role="button"],[role="link"]';

/** Elements that make a useful tap label, nearest ancestor wins. */
const LABELLED = `[data-tga-label],[aria-label],[id],input,select,textarea,${TEXTUAL}`;

/** Elements whose content may hold what the visitor typed. */
const EDITABLE = '[contenteditable]:not([contenteditable="false"])';
const NO_TEXT = `input,textarea,select,${EDITABLE}`;

/** Text inside these is not visible text. */
const HIDDEN = 'script,style,noscript,template,[hidden],[aria-hidden="true"]';

/** Controls one installed collector. */
export interface HeatmapController {
  /** Sends the taps of the current page, then starts a new page at `path`. */
  rotate(path: string): void;
  /** Sends pending taps and the scroll depth, if any. */
  flush(): void;
  /** Sends pending taps, then removes all listeners. */
  teardown(): void;
  /** Discards pending taps and the pending scroll depth without sending. */
  discard(): void;
}

/** Viewport bucket from a width in CSS px: < 768 mobile, < 1024 tablet. */
export function viewportBucket(width: number): TapsPayload["viewport"] {
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

/**
 * Label for a tapped element.
 *
 * The labelled element is the nearest ancestor (or self) that is a link,
 * button, form field, label, summary, `role="button"`, `role="link"`, or has
 * `data-tga-label`, `aria-label`, or `id`. Its label is, in order:
 * `data-tga-label`, `aria-label`, `tag#id`, else the tag. Only for a link,
 * button, label, summary, `role="button"`, or `role="link"` is the tag
 * followed by up to 40 characters of its visible text (`button "Buy now"`).
 *
 * Visible text comes from text nodes only, skipping `script`, `style`,
 * `noscript`, `template`, `[hidden]`, and `[aria-hidden="true"]`. No text is
 * read when the tap is inside an editable element, or when the element
 * contains a form field or an editable element. An `input` gives
 * `input[type=…]`. The result is at most 80 characters.
 */
export function labelFor(target: Element): string {
  const el = target.closest(LABELLED) || target;
  const tag = el.tagName.toLowerCase();
  const id = el.id;
  let label =
    el.getAttribute("data-tga-label") || el.getAttribute("aria-label") || (id && `${tag}#${id}`);
  if (!label) {
    label = tag === "input" ? `input[type=${(el as HTMLInputElement).type}]` : tag;
    if (el.matches(TEXTUAL) && !target.closest(EDITABLE) && !el.querySelector(NO_TEXT)) {
      const walk = document.createTreeWalker(el, 4); // NodeFilter.SHOW_TEXT
      let text = "";
      while (text.length < 200 && walk.nextNode()) {
        const node = walk.currentNode;
        if (!node.parentElement?.closest(HIDDEN)) text += ` ${node.nodeValue}`;
      }
      text = text.replace(/\s+/g, " ").trim().slice(0, 40);
      if (text) label += ` "${text}"`;
    }
  }
  return label.slice(0, 80);
}

/** True when `el` or one of its first 12 ancestors is fixed or sticky. */
function isFixed(target: Element): boolean {
  for (let el: Element | null = target, i = 0; el && i < 12; i++, el = el.parentElement) {
    const p = getComputedStyle(el).position;
    if (p === "fixed" || p === "sticky") return true;
  }
  return false;
}

/**
 * Installs the click and scroll listeners.
 *
 * @param dispatch - Sends a payload to an endpoint (the client's dispatch).
 * @param ctx      - Request fields, plus `on()`, which returns `false` while
 *                   the visitor is opted out (nothing is recorded or sent).
 */
export function installHeatmap(
  dispatch: (endpoint: string, payload: TapsPayload) => void,
  ctx: { apiKey: string; sessionId: string; on: () => boolean },
): HeatmapController {
  const root = document.documentElement;
  let path = location.pathname + location.search;
  let taps: TapPoint[] = [];
  let count = 0;
  let bottom = 0; // max of scrollY + innerHeight, in CSS px
  let scrollSent = false;

  const flush = (): void => {
    const h = root.scrollHeight;
    const scroll = scrollSent || !h ? 0 : Math.min(1, Math.round((bottom / h) * 100) / 100);
    if (ctx.on() && (taps.length || scroll)) {
      const w = innerWidth;
      const payload: TapsPayload = {
        api_key: ctx.apiKey,
        session_id: ctx.sessionId,
        path,
        viewport: viewportBucket(w),
        vw: Math.round(w),
        taps,
      };
      if (scroll) {
        payload.scroll = scroll;
        scrollSent = true;
      }
      dispatch(TAPS_ENDPOINT, payload);
    }
    taps = [];
  };

  const onClick = (e: MouseEvent): void => {
    const t = e.target as Element | null;
    if (!ctx.on() || count >= MAX_TAPS || !t?.closest || t.closest("[data-tga-ignore]")) return;
    const x = Math.round((e.pageX / (root.scrollWidth || innerWidth)) * 1000) / 1000;
    const y = Math.round(isFixed(t) ? e.clientY : e.pageY);
    taps.push({
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1e5, Math.max(0, y)),
      el: labelFor(t),
    });
    if (++count >= MAX_TAPS) flush();
  };

  const onScroll = (): void => {
    if (ctx.on()) bottom = Math.max(bottom, scrollY + innerHeight);
  };

  const opts = { capture: true, passive: true };
  document.addEventListener("click", onClick, opts);
  addEventListener("scroll", onScroll, { passive: true });

  return {
    rotate(next) {
      flush();
      path = next;
      count = bottom = 0;
      scrollSent = false;
    },
    flush,
    discard() {
      taps = [];
      bottom = 0;
    },
    teardown() {
      flush();
      document.removeEventListener("click", onClick, opts);
      removeEventListener("scroll", onScroll);
    },
  };
}

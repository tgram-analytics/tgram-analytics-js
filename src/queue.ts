/**
 * In-memory event batching queue.
 *
 * When batching is enabled (via `TGAOptions.batch`), events are buffered here
 * rather than being sent immediately. The queue flushes — sending all buffered
 * events — when either:
 * 1. The buffer reaches `maxSize` events, or
 * 2. `maxWait` milliseconds have passed since the first event was buffered.
 *
 * **Why batch?**
 * Batching is useful when you track many events in a short burst (e.g. user
 * interactions, scroll depth checkpoints). Instead of firing one `fetch` per
 * event, the queue coalesces them into a single burst sent on the next flush.
 *
 * **Note:** The server has no batch endpoint, so each event is still sent as
 * its own HTTP request when the queue flushes. The benefit is reducing the
 * number of requests fired during rapid event sequences.
 */

import { send } from "./transport.js";

/** Required configuration for the {@link EventQueue}. */
export interface QueueConfig {
  /**
   * Maximum number of events to buffer before the queue is force-flushed.
   * @default 10
   */
  maxSize: number;
  /**
   * Maximum milliseconds to wait before the queue is automatically flushed.
   * @default 5000
   */
  maxWait: number;
}

/** A single event waiting to be sent. */
interface QueuedEvent {
  /** API endpoint path, relative to serverUrl (e.g. `"/api/v1/track"`). */
  endpoint: string;
  /** JSON-serialisable request body. */
  payload: unknown;
}

/**
 * A simple in-memory event queue that flushes on size or time threshold.
 *
 * @example
 * const queue = new EventQueue("https://analytics.example.com", {
 *   maxSize: 10,
 *   maxWait: 5000,
 * });
 *
 * queue.push("/api/v1/track", { api_key: "proj_xxx", event_name: "click", ... });
 * queue.flush(); // send all buffered events immediately
 */
export class EventQueue {
  private readonly serverUrl: string;
  private readonly config: QueueConfig;
  private buffer: QueuedEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param serverUrl - Base server URL (no trailing slash). Prepended to each
   *                    endpoint path when building the full request URL.
   * @param config    - Queue thresholds.
   */
  constructor(serverUrl: string, config: QueueConfig) {
    this.serverUrl = serverUrl;
    this.config = config;
  }

  /**
   * Adds an event to the buffer.
   *
   * - If the buffer now equals `maxSize`, flushes immediately.
   * - Otherwise, starts the auto-flush timer if it isn't already running.
   *
   * @param endpoint - API path relative to `serverUrl`, e.g. `"/api/v1/track"`.
   * @param payload  - JSON-serialisable request body.
   */
  push(endpoint: string, payload: unknown): void {
    this.buffer.push({ endpoint, payload });

    if (this.buffer.length >= this.config.maxSize) {
      // Buffer is full — flush now.
      this.flush();
    } else if (this.timer === null) {
      // Start the countdown timer for the first event in a new batch.
      this.timer = setTimeout(() => this.flush(), this.config.maxWait);
    }
  }

  /**
   * Sends all buffered events immediately and resets the buffer and timer.
   *
   * Safe to call when the buffer is empty — it is a no-op in that case.
   * Also called automatically by the SDK on page hide / unload.
   */
  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Drain the buffer atomically so that events pushed during flush are not lost.
    const events = this.buffer.splice(0);
    for (const { endpoint, payload } of events) {
      send(`${this.serverUrl}${endpoint}`, payload);
    }
  }
}

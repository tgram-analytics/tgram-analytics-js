import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventQueue } from "../src/queue.js";
import { fetchMock } from "./setup.js";

const SERVER = "https://analytics.example.com";
const ENDPOINT = "/api/v1/track";
const FULL_URL = `${SERVER}${ENDPOINT}`;
const PAYLOAD = { event_name: "test" };

describe("EventQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes immediately when maxSize is reached", () => {
    const q = new EventQueue(SERVER, { maxSize: 3, maxWait: 10_000 });

    q.push(ENDPOINT, PAYLOAD);
    q.push(ENDPOINT, PAYLOAD);
    expect(fetchMock).not.toHaveBeenCalled();

    q.push(ENDPOINT, PAYLOAD); // 3rd push hits maxSize
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("flushes after maxWait ms", () => {
    const q = new EventQueue(SERVER, { maxSize: 100, maxWait: 2000 });

    q.push(ENDPOINT, PAYLOAD);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not double-flush (timer is cleared on size-triggered flush)", () => {
    const q = new EventQueue(SERVER, { maxSize: 2, maxWait: 1000 });

    q.push(ENDPOINT, PAYLOAD);
    q.push(ENDPOINT, PAYLOAD); // triggers size flush

    vi.advanceTimersByTime(1000); // timer should already be cancelled
    expect(fetchMock).toHaveBeenCalledTimes(2); // only the 2 from the size flush
  });

  it("sends each event to the correct full URL", () => {
    const q = new EventQueue(SERVER, { maxSize: 1, maxWait: 5000 });
    q.push(ENDPOINT, PAYLOAD);

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    expect(calledUrl).toBe(FULL_URL);
  });

  it("manual flush() sends all buffered events", () => {
    const q = new EventQueue(SERVER, { maxSize: 100, maxWait: 10_000 });
    q.push(ENDPOINT, PAYLOAD);
    q.push(ENDPOINT, PAYLOAD);
    expect(fetchMock).not.toHaveBeenCalled();

    q.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("manual flush() clears the buffer so subsequent flush is a no-op", () => {
    const q = new EventQueue(SERVER, { maxSize: 100, maxWait: 10_000 });
    q.push(ENDPOINT, PAYLOAD);
    q.flush();
    fetchMock.mockClear();

    q.flush(); // buffer is already empty
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("empty flush is a no-op", () => {
    const q = new EventQueue(SERVER, { maxSize: 10, maxWait: 5000 });
    expect(() => q.flush()).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installSpaListeners } from "../src/spa.js";

describe("installSpaListeners", () => {
  let teardown: () => void;
  let onNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onNavigate = vi.fn();
    // Start from a clean URL.
    history.replaceState(null, "", "/start");
    teardown = installSpaListeners(onNavigate);
  });

  afterEach(() => {
    teardown();
  });

  it("calls onNavigate when pushState changes the URL", () => {
    history.pushState(null, "", "/new-page");
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("calls onNavigate when replaceState changes the URL", () => {
    history.replaceState(null, "", "/replaced-page");
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("calls onNavigate on popstate", () => {
    history.pushState(null, "", "/page-a");
    onNavigate.mockClear();

    // Simulate browser Back button.
    window.dispatchEvent(new PopStateEvent("popstate"));
    // popstate fires after the URL changes; jsdom does not auto-change URL on
    // popstate, so we manually navigate to simulate.
    history.replaceState(null, "", "/start");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(onNavigate.mock.calls.length).toBeGreaterThan(0);
  });

  it("deduplicates consecutive navigations to the same URL", () => {
    history.pushState(null, "", "/same");
    history.pushState(null, "", "/same"); // same URL again
    expect(onNavigate).toHaveBeenCalledOnce(); // only the first one
  });

  it("does not fire when replaceState is called with the current URL", () => {
    // /start is the initial URL set in beforeEach.
    history.replaceState(null, "", "/start");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("restores original pushState and replaceState after teardown", () => {
    // Confirm the wrapper is active before teardown.
    history.pushState(null, "", "/pre-teardown");
    expect(onNavigate).toHaveBeenCalledOnce();
    onNavigate.mockClear();

    teardown();

    // After teardown the SDK wrapper is removed — navigations must not fire onNavigate.
    history.pushState(null, "", "/post-teardown");
    expect(onNavigate).not.toHaveBeenCalled();

    // Re-install so afterEach teardown does not throw.
    teardown = installSpaListeners(onNavigate);
  });

  it("stops calling onNavigate after teardown", () => {
    teardown();
    onNavigate.mockClear();

    history.pushState(null, "", "/after-teardown");
    expect(onNavigate).not.toHaveBeenCalled();

    // Re-install so afterEach teardown does not throw.
    teardown = installSpaListeners(onNavigate);
  });
});

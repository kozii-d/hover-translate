import { describe, expect, it } from "vitest";
import { installFakeChrome } from "./fakeChrome.ts";

// The fake has to behave like the browser where the extension's code depends
// on it; otherwise a test passes here and the code fails in Chrome.

describe("the fake chrome.storage", () => {
  it("onChanged: only for values that changed, none at all when nothing did", async () => {
    installFakeChrome({ sync: { settings: { translator: "google" }, installedAt: 1 } });
    const events: Record<string, unknown>[] = [];
    chrome.storage.onChanged.addListener((changes) => events.push(changes));

    await chrome.storage.sync.set({ settings: { translator: "google" }, installedAt: 1 });
    await chrome.storage.sync.set({ settings: { translator: "google" }, installedAt: 2 });
    await chrome.storage.sync.remove("absent");

    expect(events).toEqual([{ installedAt: { oldValue: 1, newValue: 2 } }]);
  });
});

describe("the fake chrome.runtime messaging", () => {
  it("sendResponse called at once, without `return true`, is delivered", async () => {
    installFakeChrome();
    chrome.runtime.onMessage.addListener((_message, _sender, sendResponse) => {
      sendResponse({ answer: 42 });
    });

    expect(await chrome.runtime.sendMessage({ action: "ask" })).toEqual({ answer: 42 });
  });

  it("a promise returned instead of `return true` is ignored, as Chrome did before 147", async () => {
    installFakeChrome();
    chrome.runtime.onMessage.addListener((() => Promise.resolve({ answer: 42 })) as never);

    expect(await chrome.runtime.sendMessage({ action: "ask" })).toBeUndefined();
  });

  it("`return true` keeps the channel open for a later sendResponse", async () => {
    installFakeChrome();
    chrome.runtime.onMessage.addListener((_message, _sender, sendResponse) => {
      setTimeout(() => sendResponse({ answer: 42 }), 5);
      return true;
    });

    expect(await chrome.runtime.sendMessage({ action: "ask" })).toEqual({ answer: 42 });
  });
});

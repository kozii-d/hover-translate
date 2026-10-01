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

  describe("failingReads: a read that asks for a failing key fails, as on a broken profile", () => {
    const STORED = { settings: { translator: "google" }, installedAt: 1 };
    const MESSAGE = "The sync storage could not be read";

    it("awaited: the promise rejects, also for get(null), which asks for every key; other reads work", async () => {
      installFakeChrome({ sync: STORED, local: { savedTranslations: [] }, failingReads: { sync: ["settings"] } });

      await expect(chrome.storage.sync.get("settings")).rejects.toThrow(MESSAGE);
      await expect(chrome.storage.sync.get(["installedAt", "settings"])).rejects.toThrow(MESSAGE);
      await expect(chrome.storage.sync.get(null)).rejects.toThrow(MESSAGE);
      expect(await chrome.storage.sync.get("installedAt")).toEqual({ installedAt: 1 });
      expect(await chrome.storage.local.get(null)).toEqual({ savedTranslations: [] });
    });

    it("with a callback: called with nothing, `runtime.lastError` set during the call only", async () => {
      installFakeChrome({ sync: STORED, failingReads: { sync: ["settings"] } });

      const seen = await new Promise((resolve) => {
        chrome.storage.sync.get("settings", (result) => resolve({ result, lastError: chrome.runtime.lastError }));
      });

      expect(seen).toEqual({ result: undefined, lastError: { message: MESSAGE } });
      expect(chrome.runtime.lastError).toBeUndefined();
    });

    it("emptied on the returned fake, the reads work again", async () => {
      const fake = installFakeChrome({ sync: STORED, failingReads: { sync: ["settings"] } });
      await expect(chrome.storage.sync.get("settings")).rejects.toThrow(MESSAGE);

      fake.failingReads.sync = [];

      expect(await chrome.storage.sync.get("settings")).toEqual({ settings: STORED.settings });
    });
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

describe("the fake chrome.permissions", () => {
  const YOUTUBE = "*://*.youtube.com/*";
  const WWW_YOUTUBE = "https://www.youtube.com/*";
  const BING = "https://www.bing.com/*";

  it("the content scripts' hosts are granted by default, as after an install; the option withholds them", async () => {
    installFakeChrome();
    expect(await chrome.permissions.contains({ origins: [YOUTUBE] })).toBe(true);

    installFakeChrome({ contentScriptAccess: false });
    expect(await chrome.permissions.contains({ origins: [YOUTUBE] })).toBe(false);
    expect(await chrome.permissions.contains({ origins: [WWW_YOUTUBE] })).toBe(false);
  });

  it("a granted pattern covers the narrower ones inside it", async () => {
    installFakeChrome();

    expect(await chrome.permissions.contains({ origins: [WWW_YOUTUBE] })).toBe(true);
    expect(await chrome.permissions.contains({ origins: ["http://m.youtube.com/*"] })).toBe(true);
    expect(await chrome.permissions.contains({ origins: ["https://youtube.com/watch"] })).toBe(true);
    expect(await chrome.permissions.contains({ origins: ["https://notyoutube.com/*"] })).toBe(false);
    expect(await chrome.permissions.contains({ origins: ["ftp://www.youtube.com/*"] })).toBe(false);
    expect(await chrome.permissions.contains({ origins: [BING] })).toBe(false);
  });

  it("a narrow grant does not cover the wider pattern: Chrome's \"On this site\" grants www.youtube.com only", async () => {
    installFakeChrome({ contentScriptAccess: false, grantedOrigins: [WWW_YOUTUBE] });

    expect(await chrome.permissions.contains({ origins: [WWW_YOUTUBE] })).toBe(true);
    expect(await chrome.permissions.contains({ origins: [YOUTUBE] })).toBe(false);
    expect(await chrome.permissions.contains({ origins: ["https://m.youtube.com/*"] })).toBe(false);
  });

  it("request: the withheld content scripts' hosts may be asked for, and the answer is kept", async () => {
    const fake = installFakeChrome({ contentScriptAccess: false, answerPermissionPrompt: () => true });

    expect(await chrome.permissions.request({ origins: [YOUTUBE] })).toBe(true);

    expect(fake.permissionPrompts).toEqual([[YOUTUBE]]);
    expect(await chrome.permissions.contains({ origins: [WWW_YOUTUBE] })).toBe(true);
  });

  it("request: a host the manifest does not declare is rejected as by Chrome, with no prompt", async () => {
    const fake = installFakeChrome({ answerPermissionPrompt: () => true });

    await expect(chrome.permissions.request({ origins: ["https://example.com/*"] }))
      .rejects.toThrow("Only permissions specified in the manifest may be requested.");
    await expect(chrome.permissions.request({ origins: [BING, "*://*/*"] }))
      .rejects.toThrow("Only permissions specified in the manifest may be requested.");

    expect(fake.permissionPrompts).toEqual([]);
    expect(await chrome.permissions.contains({ origins: ["https://example.com/*"] })).toBe(false);
    expect(await chrome.permissions.contains({ origins: [BING] })).toBe(false);
  });
});

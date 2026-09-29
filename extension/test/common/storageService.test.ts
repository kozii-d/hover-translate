import { describe, expect, it } from "vitest";
import { StorageService } from "../../src/common/services/storageService.ts";
import { installFakeChrome } from "../fakeChrome.ts";

describe("StorageService", () => {
  it("reads a key, null when absent, everything with null", async () => {
    installFakeChrome({ sync: { settings: { translator: "bing" }, installedAt: 1 } });
    const storage = new StorageService();

    expect(await storage.get("settings", "sync")).toEqual({ translator: "bing" });
    expect(await storage.get("nothing", "sync")).toBeNull();
    expect(await storage.get(null, "sync")).toEqual({ settings: { translator: "bing" }, installedAt: 1 });
  });

  it("setMany writes the keys in one operation: one change event with both", async () => {
    const fake = installFakeChrome();
    const events: string[][] = [];
    chrome.storage.onChanged.addListener((changes) => events.push(Object.keys(changes)));

    await new StorageService().setMany({ settings: { translator: "google" }, settingsVersion: 4 }, "sync");

    expect(fake.storage.sync).toEqual({ settings: { translator: "google" }, settingsVersion: 4 });
    expect(events).toEqual([["settings", "settingsVersion"]]);
  });

  it("rejects with the browser's message when the operation fails", async () => {
    installFakeChrome();
    const local = chrome.storage.local as unknown as Record<string, unknown>;
    local.set = (_items: unknown, callback: () => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: "QUOTA_BYTES quota exceeded" };
      callback();
      (chrome.runtime as { lastError?: unknown }).lastError = undefined;
    };

    await expect(new StorageService().set("translationCache", [], "local")).rejects.toThrow("QUOTA_BYTES quota exceeded");
  });

  it("a failure without a message from the browser is still named", async () => {
    installFakeChrome();
    const failing = (_keys: unknown, callback: (result?: object) => void) => {
      (chrome.runtime as { lastError?: object }).lastError = {};
      callback({});
      (chrome.runtime as { lastError?: unknown }).lastError = undefined;
    };
    Object.assign(chrome.storage.sync, { get: failing, remove: failing });
    const storage = new StorageService();

    await expect(storage.get("settings", "sync")).rejects.toThrow("Failed to get settings from sync storage.");
    await expect(storage.remove("settings", "sync")).rejects.toThrow("Failed to remove settings from sync storage.");
  });

  it("update(): overlapping updates of one key keep every entry", async () => {
    const fake = installFakeChrome();
    const translators = Array.from({ length: 20 }, (_, index) => `translator${index}`);

    // Separate instances, as separate callers would have: the queue is per context.
    await Promise.all(translators.map((key) => new StorageService().update<Record<string, string>>(
      "apiKeys", "local", (keys) => ({ ...keys, [key]: `key-${key}` }),
    )));

    expect(Object.keys(fake.storage.local.apiKeys as object).sort()).toEqual([...translators].sort());
  });

  it("update(): returning null removes the key", async () => {
    const fake = installFakeChrome({ local: { apiKeys: { deepl: "k" } } });
    await new StorageService().update("apiKeys", "local", () => null);
    expect(fake.storage.local).toEqual({});
  });

  it("update(): a failed update rejects, and the ones queued behind it still run", async () => {
    const fake = installFakeChrome({ local: { apiKeys: {} } });
    const storage = new StorageService();

    const failing = storage.update("apiKeys", "local", () => {
      throw new Error("updater failed");
    });
    const next = storage.update<Record<string, string>>("apiKeys", "local", (keys) => ({ ...keys, deepl: "k" }));

    await expect(failing).rejects.toThrow("updater failed");
    await next;
    expect(fake.storage.local.apiKeys).toEqual({ deepl: "k" });
  });

  it("remove", async () => {
    const fake = installFakeChrome({ local: { a: 1, b: 2 } });
    await new StorageService().remove("a", "local");
    expect(fake.storage.local).toEqual({ b: 2 });
  });
});

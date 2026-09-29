// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranslationCore } from "../../src/content/core/translationCore.ts";
import { BaseTranslator, TranslatedData } from "../../src/common/translators/baseTranslator.ts";
import { state } from "../../src/content/state/stateManager.ts";
import { defaultSettings } from "../../src/common/consts/defaultValues.ts";
import { hashString } from "../../src/content/utils/hash.ts";
import { FakeChrome, installFakeChrome } from "../fakeChrome.ts";

/** A translator that answers at once and records what it was asked. */
class RecordingTranslator extends BaseTranslator {
  calls: { text: string; context?: string }[] = [];

  constructor(private readonly usesContext = false, private readonly failWith?: Error) {
    super();
  }

  get name() {
    return "Recording";
  }

  get key() {
    return this.usesContext ? "deepl" : "google";
  }

  get supportsContext() {
    return this.usesContext;
  }

  async translate(text: string, _source: string, _target: string, _signal?: AbortSignal, context?: string): Promise<TranslatedData> {
    this.calls.push({ text, context });
    if (this.failWith) throw this.failWith;
    return { detectedLanguageCode: "en", translatedText: `«${text}»` };
  }

  async getAvailableLanguages() {
    return { sourceLanguages: [], targetLanguages: [] };
  }
}

type StoredCache = { key: string; value: { translatedText: string } }[];

let fake: FakeChrome;
const cores: TranslationCore[] = [];

const createCore = async (translator: BaseTranslator) => {
  const core = new TranslationCore(translator);
  cores.push(core);
  await core.loadTranslationCache();
  return core;
};
const storedKeys = () => ((fake.storage.local.translationCache ?? []) as StoredCache).map(({ key }) => key);

beforeEach(() => {
  fake = installFakeChrome();
  state.settings = { ...defaultSettings, sourceLanguageCode: "auto", targetLanguageCode: "ru" };
});

afterEach(() => {
  cores.splice(0).forEach((core) => core.destroy());
  vi.useRealTimers();
});

describe("the cache key", () => {
  it("text, languages and translator; no context for a translator that does not use it", async () => {
    const translator = new RecordingTranslator(false);
    const core = await createCore(translator);

    await core.translateText("  run ", "people run and jump");
    await core.flushTranslationCache();

    expect(translator.calls).toEqual([{ text: "run", context: undefined }]);
    expect(storedKeys()).toEqual(["run_auto_ru_google"]);
  });

  it("a translator that uses context gets it normalised, and its hash joins the key", async () => {
    const translator = new RecordingTranslator(true);
    const core = await createCore(translator);

    await core.translateText("bank", "  We sat  on the\tbank \n\n of the river ");
    await core.flushTranslationCache();

    const context = "We sat on the bank\nof the river";
    expect(translator.calls).toEqual([{ text: "bank", context }]);
    expect(storedKeys()).toEqual([`bank_auto_ru_deepl_${hashString(context)}`]);
  });

  it("the same word in another context is another entry", async () => {
    const translator = new RecordingTranslator(true);
    const core = await createCore(translator);

    await core.translateText("bank", "the bank of the river");
    await core.translateText("bank", "money in the bank");
    await core.translateText("bank", "the bank of the river");

    expect(translator.calls).toHaveLength(2);
  });

  it("a context of whitespace only is no context", async () => {
    const translator = new RecordingTranslator(true);
    const core = await createCore(translator);

    await core.translateText("bank", " \n\t ");

    expect(translator.calls).toEqual([{ text: "bank", context: undefined }]);
  });

  it("a context that is only the selection again is dropped (whitespace ignored)", async () => {
    const translator = new RecordingTranslator(true);
    const core = await createCore(translator);

    await core.translateText("我喜欢 视频", "我喜欢\n视频");
    await core.flushTranslationCache();

    expect(translator.calls).toEqual([{ text: "我喜欢 视频", context: undefined }]);
    expect(storedKeys()).toEqual(["我喜欢 视频_auto_ru_deepl"]);
  });

  it("a long context is cut to 500 characters around the selection", async () => {
    const translator = new RecordingTranslator(true);
    const core = await createCore(translator);
    const context = `${"a ".repeat(400)}needle${" b".repeat(400)}`;

    await core.translateText("needle", context);

    const sent = translator.calls[0].context!;
    expect(sent.length).toBeLessThanOrEqual(500);
    expect(sent).toContain("needle");
  });
});

describe("the cache", () => {
  it("a second request for the same text is answered without the translator", async () => {
    const translator = new RecordingTranslator();
    const core = await createCore(translator);

    expect(core.hasCachedTranslation("run")).toBe(false);
    const first = await core.translateText("run");
    const second = await core.translateText("run");

    expect(translator.calls).toHaveLength(1);
    expect(second).toBe(first);
    expect(core.hasCachedTranslation("run")).toBe(true);
    expect(core.cachedTranslationsCount).toBe(1);
  });

  it("other languages are another entry", async () => {
    const translator = new RecordingTranslator();
    const core = await createCore(translator);

    await core.translateText("run");
    state.settings = { ...state.settings, targetLanguageCode: "de" };
    await core.translateText("run");

    expect(translator.calls).toHaveLength(2);
  });

  it("keeps the most recent entries: 5000, and up to 5000 older ones", async () => {
    const stored: StoredCache = Array.from({ length: 10_000 }, (_, index) => ({ key: `w${index}_auto_ru_google`, value: { translatedText: `${index}` } }));
    fake = installFakeChrome({ local: { translationCache: stored } });
    const core = await createCore(new RecordingTranslator());

    expect(core.hasCachedTranslation("w9999")).toBe(true);
    expect(core.hasCachedTranslation("w5000")).toBe(true);
    expect(core.hasCachedTranslation("w4999")).toBe(false);
    expect(core.hasCachedTranslation("w0")).toBe(false);
  });

  it("the stored cache is loaded; what was translated meanwhile wins", async () => {
    fake = installFakeChrome({ local: { translationCache: [
      { key: "run_auto_ru_google", value: { translatedText: "stored" } },
      { key: "jump_auto_ru_google", value: { translatedText: "stored" } },
    ] } });
    const translator = new RecordingTranslator();
    const core = new TranslationCore(translator);
    cores.push(core);

    // Translated before the stored cache has been read.
    const fresh = await core.translateText("run");
    await vi.waitFor(() => expect(core.cachedTranslationsCount).toBe(2));

    expect((await core.translateText("run"))?.translatedText).toBe(fresh?.translatedText);
    expect((await core.translateText("jump"))?.translatedText).toBe("stored");
    expect(translator.calls).toHaveLength(1);
  });
});

describe("writing the cache back to storage", () => {
  it("5 seconds after a new entry, not before", async () => {
    const core = await createCore(new RecordingTranslator());
    vi.useFakeTimers();

    await core.translateText("run");
    await vi.advanceTimersByTimeAsync(4_900);
    expect(fake.storage.local.translationCache).toBeUndefined();

    await vi.advanceTimersByTimeAsync(200);
    expect(storedKeys()).toEqual(["run_auto_ru_google"]);
  });

  it("at once when the tab is hidden or left, and on destroy", async () => {
    const core = await createCore(new RecordingTranslator());

    await core.translateText("run");
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(storedKeys()).toEqual(["run_auto_ru_google"]));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    await core.translateText("jump");
    window.dispatchEvent(new Event("pagehide"));
    await vi.waitFor(() => expect(storedKeys()).toEqual(["run_auto_ru_google", "jump_auto_ru_google"]));

    await core.translateText("swim");
    core.destroy();
    await vi.waitFor(() => expect(storedKeys()).toHaveLength(3));
  });

  it("a stored cache that cannot be read: the new entries are still written", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(chrome.storage.local, "get").mockImplementation(((_key: unknown, callback: (items: object) => void) => {
      (chrome.runtime as { lastError?: object }).lastError = { message: "corrupted" };
      callback({});
      (chrome.runtime as { lastError?: unknown }).lastError = undefined;
    }) as never);
    const core = await createCore(new RecordingTranslator());

    await core.translateText("run");
    await core.flushTranslationCache();

    expect(errors).toHaveBeenCalledWith("Could not read the translation cache", expect.any(Error));
    expect(storedKeys()).toEqual(["run_auto_ru_google"]);
  });

  it("nothing new, nothing written", async () => {
    const core = await createCore(new RecordingTranslator());
    const writes = vi.spyOn(chrome.storage.local, "set");

    await core.flushTranslationCache();

    expect(writes).not.toHaveBeenCalled();
  });

  it("a failed write is retried by the next flush", async () => {
    const core = await createCore(new RecordingTranslator());
    const set = chrome.storage.local.set;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    (chrome.storage.local as unknown as { set: unknown }).set = (_items: unknown, callback: () => void) => {
      (chrome.runtime as { lastError?: { message: string } }).lastError = { message: "quota" };
      callback();
      (chrome.runtime as { lastError?: unknown }).lastError = undefined;
    };

    await core.translateText("run");
    await core.flushTranslationCache();
    expect(fake.storage.local.translationCache).toBeUndefined();
    expect(errors).toHaveBeenCalledOnce();

    chrome.storage.local.set = set;
    await core.flushTranslationCache();
    expect(storedKeys()).toEqual(["run_auto_ru_google"]);
  });
});

describe("what the translator returns or throws", () => {
  it("empty text: no request", async () => {
    const translator = new RecordingTranslator();
    const core = await createCore(translator);

    expect(core.hasCachedTranslation("   ")).toBe(false);
    expect(await core.translateText("   ")).toBeNull();
    expect(translator.calls).toEqual([]);
  });

  it("no translation from the translator: nothing cached", async () => {
    const translator = new RecordingTranslator();
    vi.spyOn(translator, "translate").mockResolvedValue(null as unknown as TranslatedData);
    const core = await createCore(translator);

    expect(await core.translateText("run")).toBeNull();
    expect(core.hasCachedTranslation("run")).toBe(false);
  });

  it("an aborted request is not an error", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const core = await createCore(new RecordingTranslator(false, abort));

    expect(await core.translateText("run")).toBeNull();
    expect(core.hasCachedTranslation("run")).toBe(false);
  });

  it("any other failure reaches the caller and is not cached", async () => {
    const core = await createCore(new RecordingTranslator(false, new Error("Google answered 429")));

    await expect(core.translateText("run")).rejects.toThrow("Google answered 429");
    expect(core.hasCachedTranslation("run")).toBe(false);
  });
});

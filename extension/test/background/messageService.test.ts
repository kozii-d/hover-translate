import { beforeEach, describe, expect, it } from "vitest";
import { MessageService } from "../../src/background/services/messageService.ts";
import { ProxyTranslator } from "../../src/common/translators/proxyTranslator.ts";
import { TranslatorFactory } from "../../src/common/translators/TranslatorFactory.ts";
import { BING_ORIGIN } from "../../src/common/translators/bing/bing.ts";
import { sendMessageToBackground } from "../../src/common/services/messagingService.ts";
import { isTranslatorError } from "../../src/common/translators/translatorError.ts";
import { ExtensionMessage } from "../../src/common/types/messages.ts";
import { CHROME_WEB_STORE_ID, FakeChrome, FakeChromeOptions, UNPACKED_ID, installFakeChrome } from "../fakeChrome.ts";
import { installFakeNetwork } from "../fakeNetwork.ts";

const FREE_KEY = "0123abcd-4567-89ef-0123-456789abcdef:fx";
const DEEPL_ORIGINS = ["https://api-free.deepl.com/*", "https://api.deepl.com/*"];

let fake: FakeChrome;

/** A browser profile with the real background listening; messages go through the fake `runtime`. */
const startBackground = (options: FakeChromeOptions = {}) => {
  fake = installFakeChrome(options);
  new MessageService();
};

const send = <T>(message: ExtensionMessage) => sendMessageToBackground<T>(message);
const proxied = (key: string) => new ProxyTranslator(TranslatorFactory.create(key));

beforeEach(() => startBackground());

describe("MessageService: translators, through the content script's proxy", () => {
  it("getAvailableLanguages", async () => {
    const languages = await proxied("google").getAvailableLanguages();
    expect(languages.targetLanguages).toContainEqual({ code: "uk", name: "Ukrainian" });
  });

  it("translate: Bing with its permission", async () => {
    startBackground({ grantedOrigins: [BING_ORIGIN] });
    installFakeNetwork();

    expect(await proxied("bing").translate("hello", "auto", "de")).toEqual({
      detectedLanguageCode: "en",
      translatedText: "hello (bing)",
    });
  });

  it("translate: DeepL gets the context the proxy forwards", async () => {
    startBackground({ local: { apiKeys: { deepl: FREE_KEY } }, grantedOrigins: DEEPL_ORIGINS });
    const network = installFakeNetwork();
    const translator = proxied("deepl");

    expect(translator.supportsContext).toBe(true);
    await translator.translate("bank", "auto", "de", undefined, "the bank of the river");

    expect(JSON.parse(network.requests[0].body).context).toBe("the bank of the river");
  });

  it("a translator's failure arrives as a TranslatorError with its code", async () => {
    const error = await proxied("deepl").translate("hello", "auto", "de").catch((failure) => failure);

    expect(isTranslatorError(error)).toBe(true);
    expect(error.code).toBe("api-key-missing");
  });

  it("a failure without a code arrives as a plain Error", async () => {
    const error = await send({ action: "getAvailableLanguages", value: "yandex" }).catch((failure: Error) => failure);

    expect(isTranslatorError(error)).toBe(false);
    expect((error as Error).message).toBe("Unknown translator: yandex");
  });

  it("abortTranslate: aborting the hover stops the request in the background too", async () => {
    startBackground({ local: { apiKeys: { deepl: FREE_KEY } }, grantedOrigins: DEEPL_ORIGINS });
    const network = installFakeNetwork({
      "api-free.deepl.com": ({ signal }) => new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
    });
    const hover = new AbortController();

    const translation = proxied("deepl").translate("hello", "auto", "de", hover.signal);
    await expect.poll(() => network.requests.length).toBe(1);
    hover.abort();

    await expect(translation).rejects.toMatchObject({ name: "AbortError" });
    await expect.poll(() => network.requests[0].signal.aborted).toBe(true);
  });

  it("abortTranslate of a request that has finished is harmless", async () => {
    expect(await send({ action: "abortTranslate", value: { requestId: "gone" } })).toEqual({ success: true });
  });
});

describe("MessageService: API keys, for the popup", () => {
  it("setApiKey stores the key trimmed; keys set together are all kept", async () => {
    await Promise.all([
      send({ action: "setApiKey", value: { translatorKey: "deepl", apiKey: ` ${FREE_KEY} ` } }),
      send({ action: "setApiKey", value: { translatorKey: "other", apiKey: "other-key" } }),
    ]);

    expect(fake.storage.local.apiKeys).toEqual({ deepl: FREE_KEY, other: "other-key" });
  });

  it("removeApiKey drops the object with the last key", async () => {
    startBackground({ local: { apiKeys: { deepl: FREE_KEY, other: "k" } } });

    expect(await send({ action: "removeApiKey", value: { translatorKey: "deepl" } })).toEqual({ success: true });
    expect(fake.storage.local.apiKeys).toEqual({ other: "k" });
    await send({ action: "removeApiKey", value: { translatorKey: "other" } });
    expect(fake.storage.local).not.toHaveProperty("apiKeys");
  });

  it("verifyApiKey and getApiKeyUsage", async () => {
    startBackground({ local: { apiKeys: { deepl: FREE_KEY } }, grantedOrigins: DEEPL_ORIGINS });
    installFakeNetwork();

    const verification = await send<{ usage: object }>({ action: "verifyApiKey", value: { translatorKey: "deepl", apiKey: FREE_KEY } });
    expect(verification.usage).toEqual({ characterCount: 1250, characterLimit: 500000 });
    expect(await send({ action: "getApiKeyUsage", value: { translatorKey: "deepl" } })).toEqual({ characterCount: 1250, characterLimit: 500000 });
    await expect(send({ action: "verifyApiKey", value: { translatorKey: "google", apiKey: "k" } }))
      .rejects.toThrow("does not use an API key");
  });
});

describe("MessageService: the content script's other questions", () => {
  it("hasPermissions", async () => {
    startBackground({ grantedOrigins: [BING_ORIGIN] });

    expect(await send({ action: "hasPermissions", value: { origins: [BING_ORIGIN] } })).toEqual({ granted: true });
    expect(await send({ action: "hasPermissions", value: { origins: DEEPL_ORIGINS } })).toEqual({ granted: false });
  });

  it("claimSessionNotice: the first page of the session only", async () => {
    const claim = () => send({ action: "claimSessionNotice", value: { noticeId: "bingPermissionFallback" } });

    expect(await claim()).toEqual({ claimed: true });
    expect(await claim()).toEqual({ claimed: false });
    expect(fake.storage.session).toEqual({ shownSessionNotices: { bingPermissionFallback: true } });
  });

  it("claimSessionNotice without storage.session: every page shows it", async () => {
    startBackground({ hasSessionStorage: false });
    const claim = () => send({ action: "claimSessionNotice", value: { noticeId: "bingPermissionFallback" } });

    expect(await claim()).toEqual({ claimed: true });
    expect(await claim()).toEqual({ claimed: true });
  });

  it("openReviewPage opens the store the copy came from", async () => {
    expect(await send({ action: "openReviewPage" })).toEqual({ success: true });
    expect(fake.createdTabs.map(({ url }) => url)).toEqual([`https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_ID}/reviews`]);
  });

  it("openReviewPage in an unpacked build: no store, no tab", async () => {
    startBackground({ id: UNPACKED_ID });

    expect(await send({ action: "openReviewPage" })).toEqual({ success: false });
    expect(fake.createdTabs).toEqual([]);
  });

  it("a message nobody handles gets no answer, which the sender reports", async () => {
    await expect(send({ action: "unknown" } as unknown as ExtensionMessage)).rejects.toThrow("did not handle \"unknown\"");
  });
});

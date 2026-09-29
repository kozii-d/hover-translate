import { describe, expect, it, vi } from "vitest";
import { DeepLTranslator, fromDeepLCode } from "../../../src/common/translators/deepl/deepl.ts";
import { TranslatorErrorCode } from "../../../src/common/translators/translatorError.ts";
import { installFakeChrome } from "../../fakeChrome.ts";
import { INVALID_DEEPL_KEY, installFakeNetwork, json } from "../../fakeNetwork.ts";

const FREE_KEY = "0123abcd-4567-89ef-0123-456789abcdef:fx";
const PRO_KEY = "0123abcd-4567-89ef-0123-456789abcdef";
const DEEPL_ORIGINS = ["https://api-free.deepl.com/*", "https://api.deepl.com/*"];

const withKey = (apiKey?: string, grantedOrigins = DEEPL_ORIGINS) =>
  installFakeChrome({ local: apiKey ? { apiKeys: { deepl: apiKey } } : {}, grantedOrigins });

const hosts = (network: ReturnType<typeof installFakeNetwork>) => network.requests.map(({ url }) => url.host);

describe("DeepLTranslator: requests", () => {
  it("no stored key → api-key-missing, without a request", async () => {
    withKey(undefined);
    const network = installFakeNetwork();

    await expect(new DeepLTranslator().translate("hello", "auto", "de")).rejects.toMatchObject({ code: "api-key-missing" });
    expect(network.requests).toEqual([]);
  });

  it("a free key goes to api-free.deepl.com, a Pro key to api.deepl.com", async () => {
    withKey(FREE_KEY);
    const network = installFakeNetwork();
    await new DeepLTranslator().translate("hello", "auto", "de");

    withKey(PRO_KEY);
    const proNetwork = installFakeNetwork();
    await new DeepLTranslator().translate("hello", "auto", "de");

    expect(hosts(network)).toEqual(["api-free.deepl.com"]);
    expect(hosts(proNetwork)).toEqual(["api.deepl.com"]);
    expect(proNetwork.requests[0].headers.get("Authorization")).toBe(`DeepL-Auth-Key ${PRO_KEY}`);
  });

  it("the body: target in DeepL's casing, the bare source language, context, preserve_formatting", async () => {
    withKey(FREE_KEY);
    const network = installFakeNetwork();

    const result = await new DeepLTranslator().translate("bank", "en-US", "zh-Hans", undefined, "the bank of the river");

    expect(JSON.parse(network.requests[0].body)).toEqual({
      text: ["bank"],
      target_lang: "ZH-HANS",
      source_lang: "EN",
      context: "the bank of the river",
      preserve_formatting: true,
    });
    expect(result).toEqual({ detectedLanguageCode: "en", translatedText: "bank (deepl)" });
  });

  it("auto and no context: neither is sent", async () => {
    withKey(FREE_KEY);
    const network = installFakeNetwork();

    await new DeepLTranslator().translate("bank", "auto", "de");

    expect(JSON.parse(network.requests[0].body)).toEqual({ text: ["bank"], target_lang: "DE", preserve_formatting: true });
  });

  it("\"Wrong endpoint\" → tried once on the other host, and that host is remembered", async () => {
    // A free key without its `:fx`.
    withKey(PRO_KEY);
    const network = installFakeNetwork({
      "api.deepl.com": () => json({ message: "Wrong endpoint" }, 403),
      "api-free.deepl.com": ({ url }) => url.pathname === "/v2/translate" ? json({ translations: [{ text: "hallo" }] }) : undefined,
    });
    const translator = new DeepLTranslator();

    expect((await translator.translate("hello", "auto", "de")).translatedText).toBe("hallo");
    await translator.translate("hello", "auto", "de");

    expect(hosts(network)).toEqual(["api.deepl.com", "api-free.deepl.com", "api-free.deepl.com"]);
  });

  it("\"Wrong endpoint\" on both hosts → api-key-invalid", async () => {
    withKey(PRO_KEY);
    const network = installFakeNetwork({
      "api.deepl.com": () => json({ message: "Wrong endpoint" }, 403),
      "api-free.deepl.com": () => json({ message: "Wrong endpoint" }, 403),
    });

    await expect(new DeepLTranslator().translate("hello", "auto", "de")).rejects.toMatchObject({ code: "api-key-invalid" });
    expect(network.requests).toHaveLength(2);
  });

  it("without the host permission → permission-missing, without a request", async () => {
    withKey(FREE_KEY, []);
    const network = installFakeNetwork();

    await expect(new DeepLTranslator().translate("hello", "auto", "de")).rejects.toMatchObject({ code: "permission-missing" });
    expect(network.requests).toEqual([]);
  });
});

describe("DeepLTranslator: what went wrong, as a code", () => {
  it.each<[string, () => Response, TranslatorErrorCode]>([
    ["401", () => json({ message: "Unauthorized" }, 401), "api-key-invalid"],
    ["403", () => json({ message: "Forbidden" }, 403), "api-key-invalid"],
    ["456", () => json({ message: "Quota exceeded" }, 456), "quota-exceeded"],
    ["429", () => json({ message: "Too many requests" }, 429), "rate-limited"],
    ["400 about target_lang", () => json({ message: "Value for 'target_lang' not supported." }, 400), "unsupported-language"],
    ["503 as plain text", () => new Response("Service Unavailable", { status: 503 }), "service-unavailable"],
  ])("%s → %s", async (_, respond, code) => {
    withKey(FREE_KEY);
    installFakeNetwork({ "api-free.deepl.com": respond });

    await expect(new DeepLTranslator().translate("hello", "auto", "de")).rejects.toMatchObject({ code });
  });

  it("an unreachable host → network", async () => {
    withKey(FREE_KEY);
    installFakeNetwork({ "api-free.deepl.com": () => { throw new TypeError("Failed to fetch"); } });

    await expect(new DeepLTranslator().translate("hello", "auto", "de")).rejects.toMatchObject({ code: "network" });
  });

  it("a 400 about something else has no code", async () => {
    withKey(FREE_KEY);
    installFakeNetwork({ "api-free.deepl.com": () => json({ message: "Bad request" }, 400) });

    const error = await new DeepLTranslator().translate("hello", "auto", "de").catch((failure) => failure);
    expect(error.code).toBeUndefined();
    expect(error.message).toBe("DeepL answered 400: Bad request");
  });
});

describe("DeepLTranslator: languages, usage, keys", () => {
  it.each([["EN-US", "en-US"], ["ZH-HANS", "zh-Hans"], ["PT-BR", "pt-BR"], ["ES-419", "es-419"], ["DE", "de"]])(
    "fromDeepLCode(%j) → %j", (code, expected) => {
      expect(fromDeepLCode(code)).toBe(expected);
    });

  it("the lists are normalised and kept as the offline fallback", async () => {
    const fake = withKey(FREE_KEY);
    installFakeNetwork();

    const languages = await new DeepLTranslator().getAvailableLanguages();

    expect(languages.targetLanguages.map(({ code }) => code)).toEqual(expect.arrayContaining(["en-US", "zh-Hant", "pt-PT", "nb"]));
    expect(languages.sourceLanguages.map(({ code }) => code)).toContain("en");
    await vi.waitFor(() => expect(fake.storage.local.translatorLanguages).toEqual({ deepl: languages }));
  });

  it("DeepL unreachable: the lists it returned last", async () => {
    const cached = { sourceLanguages: [{ code: "en", name: "English" }], targetLanguages: [{ code: "de", name: "German" }] };
    installFakeChrome({ local: { apiKeys: { deepl: FREE_KEY }, translatorLanguages: { deepl: cached } }, grantedOrigins: DEEPL_ORIGINS });
    installFakeNetwork({ "api-free.deepl.com": () => new Response("Bad gateway", { status: 502 }) });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await new DeepLTranslator().getAvailableLanguages()).toEqual(cached);
  });

  it("the key rejected: never the cached lists", async () => {
    const cached = { sourceLanguages: [{ code: "en", name: "English" }], targetLanguages: [{ code: "de", name: "German" }] };
    installFakeChrome({ local: { apiKeys: { deepl: INVALID_DEEPL_KEY }, translatorLanguages: { deepl: cached } }, grantedOrigins: DEEPL_ORIGINS });
    installFakeNetwork();

    await expect(new DeepLTranslator().getAvailableLanguages()).rejects.toMatchObject({ code: "api-key-invalid" });
  });

  it("verifyApiKey: usage and languages for a key that is not stored; an empty one is missing", async () => {
    withKey(undefined);
    installFakeNetwork();
    const translator = new DeepLTranslator();

    const verification = await translator.verifyApiKey(` ${FREE_KEY} `);
    expect(verification.usage).toEqual({ characterCount: 1250, characterLimit: 500000 });
    expect(verification.availableLanguages.targetLanguages.length).toBeGreaterThan(30);

    await expect(translator.verifyApiKey("  ")).rejects.toMatchObject({ code: "api-key-missing" });
    await expect(translator.verifyApiKey(INVALID_DEEPL_KEY)).rejects.toMatchObject({ code: "api-key-invalid" });
  });
});

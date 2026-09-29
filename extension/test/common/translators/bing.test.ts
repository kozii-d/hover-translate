import { describe, expect, it } from "vitest";
import { BING_ORIGIN, BingTranslator } from "../../../src/common/translators/bing/bing.ts";
import { installFakeChrome } from "../../fakeChrome.ts";
import { BING_TRANSLATOR_PAGE, installFakeNetwork, json } from "../../fakeNetwork.ts";

const HOST = "www.bing.com";
const pages = (network: ReturnType<typeof installFakeNetwork>) =>
  network.to(HOST).filter(({ url }) => url.pathname === "/translator");
const translations = (network: ReturnType<typeof installFakeNetwork>) =>
  network.to(HOST).filter(({ url }) => url.pathname === "/ttranslatev3");

describe("BingTranslator", () => {
  it("without access to www.bing.com: permission-missing, and no request at all", async () => {
    installFakeChrome({ grantedOrigins: [] });
    const network = installFakeNetwork();

    await expect(new BingTranslator().translate("hello", "auto", "de")).rejects.toMatchObject({ code: "permission-missing" });
    expect(network.requests).toEqual([]);
  });

  it("with access: the page's credentials, then the translation", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    const network = installFakeNetwork();

    const result = await new BingTranslator().translate("hello", "en", "de");

    expect(result).toEqual({ detectedLanguageCode: "en", translatedText: "hello (bing)", transliteration: undefined });
    const [request] = translations(network);
    expect(request.method).toBe("POST");
    expect(Object.fromEntries(request.url.searchParams)).toEqual({
      isVertical: "1",
      IG: "17D543C5CA5B4AAB88FA421EE4F683D8",
      IID: "translator.5023.1",
    });
    expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({
      fromLang: "en",
      text: "hello",
      to: "de",
      token: "wS0GaaMm7ORXVXFbqSpBa_9uL0BNc1cW",
      key: "1790666705661",
    });
  });

  it("auto becomes auto-detect", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    const network = installFakeNetwork();

    await new BingTranslator().translate("hello", "auto", "de");

    expect(new URLSearchParams(translations(network)[0].body).get("fromLang")).toBe("auto-detect");
  });

  it("the credentials are fetched once, also for requests made together", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    const network = installFakeNetwork();
    const translator = new BingTranslator();

    await Promise.all(["a", "b", "c"].map((text) => translator.translate(text, "auto", "de")));
    await translator.translate("d", "auto", "de");

    expect(pages(network)).toHaveLength(1);
    expect(translations(network).map(({ url }) => url.searchParams.get("IID"))).toEqual([
      "translator.5023.1", "translator.5023.2", "translator.5023.3", "translator.5023.4",
    ]);
  });

  it("stale credentials (401, or an error body with 200) → fetched again, once", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    let failures = 1;
    const network = installFakeNetwork({
      [HOST]: ({ url }) => url.pathname === "/ttranslatev3" && failures-- > 0 ? json({ ShowCaptcha: false }, 401) : undefined,
    });

    expect((await new BingTranslator().translate("hello", "auto", "de")).translatedText).toBe("hello (bing)");
    expect(pages(network)).toHaveLength(2);
    expect(translations(network)).toHaveLength(2);
  });

  it("a captcha after fresh credentials is reported as such", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    installFakeNetwork({
      [HOST]: ({ url }) => url.pathname === "/ttranslatev3" ? json({ ShowCaptcha: true }) : undefined,
    });

    await expect(new BingTranslator().translate("hello", "auto", "de")).rejects.toThrow("captcha");
  });

  it("a page without credentials is an error, not a request with empty ones", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    const network = installFakeNetwork({
      [HOST]: ({ url }) => url.pathname === "/translator" ? new Response(BING_TRANSLATOR_PAGE.replace(/IG:"\w+"/, "")) : undefined,
    });

    await expect(new BingTranslator().translate("hello", "auto", "de")).rejects.toThrow("expected credentials");
    expect(translations(network)).toEqual([]);
  });

  it("a page without a usable token is an error; a missing iid or lifetime has a default", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    installFakeNetwork({
      [HOST]: ({ url }) => url.pathname === "/translator" ? new Response(BING_TRANSLATOR_PAGE.replace(/"wS0\w+"/, "\"\"")) : undefined,
    });
    await expect(new BingTranslator().translate("hello", "auto", "de")).rejects.toThrow("usable anti-abuse token");

    const network = installFakeNetwork({
      [HOST]: ({ url }) => url.pathname === "/translator"
        ? new Response(BING_TRANSLATOR_PAGE.replace(/ data-iid="[^"]+"/, "").replace(",3600000]", ",soon]"))
        : undefined,
    });
    await new BingTranslator().translate("hello", "auto", "de");
    expect(translations(network)[0].url.searchParams.get("IID")).toBe("translator.5023.1");
  });

  it("an error envelope twice: its status and message in the error", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    installFakeNetwork({
      [HOST]: ({ url }) => url.pathname === "/ttranslatev3" ? json({ statusCode: 205, errorMessage: "Throttled" }) : undefined,
    });

    await expect(new BingTranslator().translate("hello", "auto", "de")).rejects.toThrow("Bing rejected the translation request (205: Throttled)");
  });

  it("no detected language: the source language asked for", async () => {
    installFakeChrome({ grantedOrigins: [BING_ORIGIN] });
    installFakeNetwork({
      [HOST]: ({ url }) => url.pathname === "/ttranslatev3" ? json([{ translations: [{ text: "hallo", to: "de", transliteration: { text: "hallo" } }] }]) : undefined,
    });

    expect(await new BingTranslator().translate("hello", "en", "de")).toEqual({ detectedLanguageCode: "en", translatedText: "hallo", transliteration: "hallo" });
  });

  it("its languages come from Microsoft's public list, without a permission", async () => {
    installFakeChrome({ grantedOrigins: [] });
    installFakeNetwork();

    const languages = await new BingTranslator().getAvailableLanguages();

    expect(languages.sourceLanguages).toBe(languages.targetLanguages);
    expect(languages.targetLanguages).toContainEqual({ code: "tlh-Latn", name: "Klingon (Latin)" });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplacementTranslator } from "../../../src/common/translators/replacementTranslator.ts";
import { GoogleTranslator } from "../../../src/common/translators/google/google.ts";
import { BingTranslator } from "../../../src/common/translators/bing/bing.ts";
import { DeepLTranslator } from "../../../src/common/translators/deepl/deepl.ts";
import { TranslatorFactory } from "../../../src/common/translators/TranslatorFactory.ts";
import {
  WITHDRAWN_TRANSLATORS,
  isTranslatorWithdrawn,
  resolveTranslatorKey,
} from "../../../src/common/translators/withdrawnTranslators.ts";
import { installFakeChrome } from "../../fakeChrome.ts";
import { installFakeNetwork } from "../../fakeNetwork.ts";

const googleParams = (network: ReturnType<typeof installFakeNetwork>) =>
  network.to("translate.googleapis.com").map(({ url }) => [url.searchParams.get("sl"), url.searchParams.get("tl")]);

describe("ReplacementTranslator: Google answering for Bing", () => {
  it("carries Bing's codes over to Google's; one Google does not have becomes the viewer's language", async () => {
    installFakeChrome({ uiLanguage: "ru-RU" });
    const network = installFakeNetwork();
    const translator = new ReplacementTranslator(new GoogleTranslator());

    // Google has no Literary Chinese or Klingon, and answers 400 to Bing's codes for them; Bing's Dari `prs` is its `fa-AF`.
    await translator.translate("hello", "lzh", "tlh-Latn");
    await translator.translate("hello", "auto", "zh-Hans");
    await translator.translate("hello", "nb", "pt-PT");
    await translator.translate("hello", "prs", "prs");

    expect(googleParams(network)).toEqual([["auto", "ru"], ["auto", "zh-CN"], ["no", "pt-PT"], ["fa-AF", "fa-AF"]]);
  });

  it("is the translator it wraps to everyone else", () => {
    const translator = new ReplacementTranslator(new DeepLTranslator());
    expect([translator.name, translator.key, translator.needsBackgroundProxy, translator.supportsContext]).toEqual(["DeepL", "deepl", true, true]);
  });

  it("asks for the languages once, and again after a failure", async () => {
    const google = new GoogleTranslator();
    const lists = vi.spyOn(google, "getAvailableLanguages")
      .mockRejectedValueOnce(new Error("offline"));
    const translator = new ReplacementTranslator(google);

    await expect(translator.translate("a", "auto", "de")).rejects.toThrow("offline");
    await translator.translate("b", "auto", "de");
    await translator.translate("c", "auto", "de");

    expect(lists).toHaveBeenCalledTimes(2);
  });
});

describe("TranslatorFactory and withdrawn translators", () => {
  afterEach(() => {
    delete WITHDRAWN_TRANSLATORS.bing;
  });

  it("builds each registered translator", () => {
    expect(TranslatorFactory.create("google")).toBeInstanceOf(GoogleTranslator);
    expect(TranslatorFactory.create("bing")).toBeInstanceOf(BingTranslator);
    expect(TranslatorFactory.create("deepl")).toBeInstanceOf(DeepLTranslator);
    expect(() => TranslatorFactory.create("yandex")).toThrow("Unknown translator: yandex");
  });

  it("nothing is withdrawn now", () => {
    expect(WITHDRAWN_TRANSLATORS).toEqual({});
    expect(isTranslatorWithdrawn("bing")).toBe(false);
    expect(resolveTranslatorKey("bing")).toBe("bing");
  });

  it("a withdrawn translator is answered by its replacement, with the languages carried over", async () => {
    WITHDRAWN_TRANSLATORS.bing = "google";
    const network = installFakeNetwork();

    const translator = TranslatorFactory.create("bing");

    expect(isTranslatorWithdrawn("bing")).toBe(true);
    expect(resolveTranslatorKey("bing")).toBe("google");
    expect(translator).toBeInstanceOf(ReplacementTranslator);
    expect(translator.name).toBe("Google");
    await translator.translate("hello", "auto", "tlh-Latn");
    expect(googleParams(network)).toEqual([["auto", "en"]]);
  });
});

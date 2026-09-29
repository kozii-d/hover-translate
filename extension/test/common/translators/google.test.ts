import { describe, expect, it } from "vitest";
import { HTTPError } from "ky";
import { GoogleTranslator } from "../../../src/common/translators/google/google.ts";
import googleLanguages from "../../../src/common/translators/google/availableLanguages.json";
import { installFakeNetwork, json } from "../../fakeNetwork.ts";

const HOST = "translate.googleapis.com";

describe("GoogleTranslator", () => {
  it("reads a real answer: translation, transliteration, transcription, dictionary", async () => {
    const network = installFakeNetwork();

    const result = await new GoogleTranslator().translate("run", "auto", "ru");

    expect(result).toEqual({
      detectedLanguageCode: "en",
      translatedText: "бегать",
      transliteration: "begat'",
      transcription: "rən",
      dictionary: "глагол: работать, бежать, управлять, бегать, идти;\nимя существительное: пробег, бег, прогон, ход, работа;\n",
    });

    const [request] = network.to(HOST);
    expect(request.url.pathname).toBe("/translate_a/single");
    expect(Object.fromEntries(request.url.searchParams)).toMatchObject({ client: "dict-chrome-ex", q: "run", sl: "auto", tl: "ru", hl: "ru", dj: "1" });
    expect(request.url.searchParams.getAll("dt")).toEqual(["t", "bd", "rm"]);
  });

  it("reads a real answer from Japanese: the reading goes to the transcription", async () => {
    installFakeNetwork();

    expect(await new GoogleTranslator().translate("猫", "auto", "en")).toEqual({
      detectedLanguageCode: "ja",
      translatedText: "cat",
      transliteration: "",
      transcription: "Neko",
      dictionary: "noun: cat;\n",
    });
  });

  it("a client id that is refused (429, 403) → the next one, remembered for the next request", async () => {
    const refused = new Set(["dict-chrome-ex"]);
    const network = installFakeNetwork({
      [HOST]: ({ url }) => refused.has(url.searchParams.get("client")!) ? new Response("", { status: 429 }) : undefined,
    });
    const translator = new GoogleTranslator();

    expect((await translator.translate("hello", "auto", "de")).translatedText).toBe("hello (google)");
    await translator.translate("world", "auto", "de");

    expect(network.to(HOST).map(({ url }) => url.searchParams.get("client"))).toEqual(["dict-chrome-ex", "at", "at"]);
  });

  it("every client id refused → the last refusal reaches the caller", async () => {
    const network = installFakeNetwork({ [HOST]: () => new Response("", { status: 403 }) });

    await expect(new GoogleTranslator().translate("hello", "auto", "de")).rejects.toBeInstanceOf(HTTPError);
    expect(network.to(HOST)).toHaveLength(3);
  });

  it("a refusal of the text itself (400) is not retried with another id", async () => {
    const network = installFakeNetwork();

    await expect(new GoogleTranslator().translate("hello", "auto", "tlh-Latn")).rejects.toBeInstanceOf(HTTPError);
    expect(network.to(HOST)).toHaveLength(1);
  });

  it("an answer without sentences is an error that says so", async () => {
    installFakeNetwork({ [HOST]: () => json({ src: "en", spell: {} }) });

    await expect(new GoogleTranslator().translate("hello", "auto", "de")).rejects.toThrow("returned no translation");
  });

  it("its languages ship with the extension", async () => {
    const network = installFakeNetwork();

    expect(await new GoogleTranslator().getAvailableLanguages()).toEqual(googleLanguages);
    expect(network.requests).toEqual([]);
  });
});

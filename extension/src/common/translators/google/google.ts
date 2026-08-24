import ky, { HTTPError } from "ky";
import { BaseTranslator } from "../baseTranslator.ts";
import availableLanguages from "./availableLanguages.json";
import { GoogleTranslation } from "./types.ts";

/**
 * The client ids Google's public endpoint accepts, in the order they are tried.
 *
 * The endpoint is keyed by this id, and `gtx` — the id this translator used from
 * the start, and the one every scraper uses — is now refused with 429 ("your
 * computer or network may be sending automated queries") for anything that does
 * not look like Chrome. The gate is not the address (a VPN does not move it) nor
 * anything in the request (user agent, `Origin`, `Referer` and cookies change
 * nothing): on one machine, in the same seconds, Chrome gets 200 while Firefox,
 * curl and Node all get 429, and a client that mimics Chrome's TLS handshake
 * gets 200 with the very headers that were just refused. The ids below are the
 * ones Google's own clients use, they are not gated that way, and they answer
 * the same `dj=1` shape, dictionary and transliteration included.
 */
const CLIENT_IDS = ["dict-chrome-ex", "at", "gtx"] as const;

/** Statuses that mean "not this client id" rather than "not this text". */
const CLIENT_REFUSED_STATUSES = [403, 429];

export class GoogleTranslator extends BaseTranslator {
  private apiUrl = "https://translate.googleapis.com";

  // The id that last answered, kept for the rest of the session so that one of
  // them going the way of `gtx` costs a single extra request instead of one on
  // every hover.
  private clientIdIndex = 0;

  get name() {
    return "Google";
  }

  get key() {
    return "google";
  }

  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
  ) {
    for (let attempt = 0; attempt < CLIENT_IDS.length; attempt++) {
      const clientIdIndex = (this.clientIdIndex + attempt) % CLIENT_IDS.length;

      try {
        const data = await this.requestTranslation(
          CLIENT_IDS[clientIdIndex],
          text,
          sourceLanguageCode,
          targetLanguageCode,
          signal,
        );

        this.clientIdIndex = clientIdIndex;

        return data;
      } catch (error) {
        const isLastAttempt = attempt === CLIENT_IDS.length - 1;

        if (isLastAttempt || !this.isClientRefused(error)) {
          throw error;
        }
      }
    }

    // Unreachable: the loop either returns or throws on its last attempt.
    throw new Error("The Google translator ran out of client ids to try");
  }

  private isClientRefused(error: unknown): boolean {
    return (
      error instanceof HTTPError &&
      CLIENT_REFUSED_STATUSES.includes(error.response.status)
    );
  }

  private async requestTranslation(
    clientId: string,
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams([
      ["client", clientId],
      ["q", text],
      ["sl", sourceLanguageCode], // sl: source language
      ["tl", targetLanguageCode], // tl: target language
      ["hl", targetLanguageCode], // hl: dictionary header language
      ["dj", "1"], // dj: 1 is for json response
      ["dt", "t"], // dt: t is for translation
      ["dt", "bd"], // dt: bd is for dictionary
      ["dt", "rm"], // dt: rm is for transliteration
      // ["dt", "qca"], // dt: qca is for spelling correction
    ]);

    // No retries, the same as Bing. This endpoint answers a network it has
    // decided is too busy with 429, and ky would retry that twice by default:
    // three requests per hover, which deepens the throttling that caused it,
    // and about a second of waiting before the viewer is told anything.
    const response = await ky.get<GoogleTranslation>(
      `${this.apiUrl}/translate_a/single?${params}`,
      { signal, retry: 0 },
    );

    const data = await response.json();

    // Google answers a request it declines — rate limiting, an unsupported
    // language pair — with a body that carries no sentences at all. Reading it as
    // a translation raised a bare TypeError, which told neither the log nor the
    // viewer anything.
    if (!Array.isArray(data.sentences)) {
      throw new Error(
        "The Google translator returned no translation for this text",
      );
    }

    const translatedText = data.sentences.reduce((acc, sentence) => {
      if (sentence.trans) {
        acc += sentence.trans;
      }
      return acc;
    }, "");

    const transliteration = data.sentences.reduce((acc, sentence) => {
      if (sentence.translit) {
        acc += sentence.translit;
      }
      return acc;
    }, "");

    const transcription = data.sentences.reduce((acc, sentence) => {
      if (sentence.src_translit) {
        acc += sentence.src_translit;
      }
      return acc;
    }, "");

    const dictionary =
      data.dict?.reduce((acc, dictEntry) => {
        const dictLine = `${dictEntry.pos}: ${dictEntry.terms.join(", ")};\n`;
        acc += dictLine;
        return acc;
      }, "") || "";

    return {
      detectedLanguageCode: data.src,
      translatedText,
      dictionary,
      transliteration,
      transcription,
    };
  }

  async getAvailableLanguages() {
    return availableLanguages;
  }
}

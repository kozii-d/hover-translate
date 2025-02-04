import { BaseTranslator } from "../baseTranslator.ts";
import ky from "ky";
import { jwtDecode } from "jwt-decode";
import {
  BingAvailableLanguagesResponse,
  // BingDictionaryResponse,
  BingTokenPayload,
  BingTranslationResponse,
  TokenData
} from "./types.ts";

export class BingTranslator extends BaseTranslator {
  private apiUrl = "https://api.cognitive.microsofttranslator.com";
  private authUrl = "https://edge.microsoft.com/translate/auth";

  private tokenData: TokenData | null = null;

  // private partOfSpeechMap = {
  //   ADJ:	"Adjectives",
  //   ADV:	"Adverbs",
  //   CONJ:	"Conjunctions",
  //   DET:	"Determiners",
  //   MODAL:	"Verbs",
  //   NOUN:	"Nouns",
  //   PREP:	"Prepositions",
  //   PRON:	"Pronouns",
  //   VERB:	"Verbs",
  //   OTHER:	"Other",
  // };

  private api = ky.create({
    prefixUrl: this.apiUrl,
    headers: {
      "Content-type": "application/json; charset=UTF-8",
      "User-Agent": navigator.userAgent,
    },
    searchParams: {
      "api-version": "3.0",
    },
    hooks: {
      beforeRequest: [
        async (request) => {
          if (this.checkIsTokenExpired()) {
            await this.getToken();
          }
          if (!this.tokenData) {
            throw new Error("Token is not available");
          }
          request.headers.set("Authorization", `Bearer ${this.tokenData.token}`);
        },
      ]
    },
  });

  get name() {
    return "Bing";
  }

  get key() {
    return "bing";
  }

  private async getToken() {
    const response = await ky.get<string>(this.authUrl);
    const token = await response.text();

    const tokenPayload = jwtDecode<BingTokenPayload>(token);

    this.tokenData = {
      token,
      expirationInMs: tokenPayload.exp * 1000,
    };
  }

  private checkIsTokenExpired() {
    if (!this.tokenData) return true;
    const currentTime = Date.now();
    return this.tokenData.expirationInMs < currentTime;
  }

  private async translationRequest(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal
  ) {
    const response = await this.api.post<BingTranslationResponse>("translate", {
      body: JSON.stringify([{ Text: text }]),
      searchParams: {
        "from": sourceLanguageCode !== "auto" ? sourceLanguageCode : "",
        "to": targetLanguageCode,
      },
      signal,
    });

    const [data] = await response.json();

    return {
      detectedLanguageCode: data.detectedLanguage?.language ?? sourceLanguageCode,
      translatedText: data.translations[0].text,
    };
  }

  // private async dictionaryRequest(
  //   text: string,
  //   sourceLanguageCode: string,
  //   targetLanguageCode: string,
  //   signal?: AbortSignal
  // ): Promise<string> {
  //   const response = await this.api.post<BingDictionaryResponse>("dictionary/lookup", {
  //     body: JSON.stringify([{ Text: text }]),
  //     searchParams: {
  //       "from": sourceLanguageCode,
  //       "to": targetLanguageCode,
  //     },
  //     signal,
  //   });
  //
  //   const [data] = await response.json();
  //   const translations = data.translations;
  //
  //   const groupedDictionary = Object.groupBy(translations, (item) => item.posTag);
  //
  //   return Object.entries(groupedDictionary).reduce((acc, entry) => {
  //     const [posTag, dictTranslation] = entry;
  //     const words = dictTranslation?.map((dictEntry) => dictEntry.displayTarget).join(", ") || "";
  //     const dictLine = `${this.partOfSpeechMap[posTag as keyof typeof this.partOfSpeechMap]}: ${words};\n`;
  //     acc += dictLine;
  //     return acc;
  //   }, "");
  // }

  public async getAvailableLanguages() {
    const response = await this.api.get<BingAvailableLanguagesResponse>("languages", {
      searchParams: {
        scope: "translation"
      }
    });
    const data = await response.json();

    const languages = Object.entries(data.translation).map(([code, lang]) => ({
      code,
      name: lang.name,
    }));

    return {
      targetLanguages: languages,
      sourceLanguages: languages,
    };
  };

  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal
  ) {
    const translation = await this.translationRequest(text, sourceLanguageCode, targetLanguageCode, signal);
    // const dictionary = await this.dictionaryRequest(text, translation.detectedLanguageCode, targetLanguageCode, signal);

    return {
      ...translation,
      // dictionary,
    };
  }
}
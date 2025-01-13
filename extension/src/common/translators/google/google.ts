import ky from "ky";
import { BaseTranslator } from "../baseTranslator.ts";
import availableLanguages from "./availableLanguages.json";

interface GoogleTranslateResponse {
  sentences: {
    trans: string;
    orig: string;
  }[];
  src: string;
}

export class GoogleTranslator extends BaseTranslator {
  private apiUrl = "https://translate.googleapis.com";

  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal
  ) {
    const params = new URLSearchParams([
      ["client", "gtx"],
      ["q", text],
      ["sl", sourceLanguageCode],
      ["tl", targetLanguageCode],
      ["dj", "1"], // dj: 1 is for json response
      ["dt", "t"], // dt: t is for translation
      // ["dt", "rm"], // dt: rm is for transliteration
      // ["dt", "bd"], // dt: bd is for dictionary
      // ["dt", "rw"], // dt: rw is for related words
      // ["dt", "qca"], // dt: qca is for spelling correction
    ]);
    
    const response = await ky.get<GoogleTranslateResponse>(
      `${this.apiUrl}/translate_a/single?${params}`,
      { signal }
    );

    const data = await response.json();

    const translatedText = data.sentences.reduce((acc, sentence) => {
      if (sentence.trans) {
        acc += sentence.trans;
      }
      return acc;
    }, "");

    return {
      detectedLanguageCode: data.src,
      translatedText,
    };
  }

  async getAvailableLanguages() {
    return availableLanguages;
  }
}
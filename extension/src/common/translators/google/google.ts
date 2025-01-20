import ky from "ky";
import { BaseTranslator } from "../baseTranslator.ts";
import availableLanguages from "./availableLanguages.json";
import { GoogleTranslation } from "./types.ts";

export class GoogleTranslator extends BaseTranslator {
  private apiUrl = "https://translate.googleapis.com";

  get name() {
    return "Google";
  }

  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal
  ) {
    const params = new URLSearchParams([
      ["client", "gtx"],
      ["q", text],
      ["sl", sourceLanguageCode], // sl: source language
      ["tl", targetLanguageCode], // tl: target language
      ["hl", targetLanguageCode], // hl: dictionary header language
      ["dj", "1"], // dj: 1 is for json response
      ["dt", "t"], // dt: t is for translation
      ["dt", "bd"], // dt: bd is for dictionary
      ["dt", "rm"], // dt: rm is for transliteration
      ["dt", "rw"], // dt: rw is for related words
      // ["dt", "qca"], // dt: qca is for spelling correction
    ]);
    
    const response = await ky.get<GoogleTranslation>(
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

    const dictionary = data.dict?.reduce((acc, dictEntry) => {
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
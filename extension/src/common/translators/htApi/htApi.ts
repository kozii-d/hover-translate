import ky from "ky";
import { BaseTranslator } from "../baseTranslator.ts";
import { TokenService } from "../../../content/services/tokenService.ts";
import { AvailableLanguages } from "../../types/languages.ts";

interface TranslateApiResponse {
  detectedLanguageCode: string;
  translatedText: string;
}


export class HtApiTranslator extends BaseTranslator {
  private apiUrl = __API_URL__;
  
  constructor(
    private readonly tokenService: TokenService = new TokenService()
  ) {
    super();
  }
  
  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal
  ) {
    const params = new URLSearchParams({
      input: text,
      sourceLanguageCode,
      targetLanguageCode,
    });

    const idToken = await this.tokenService.getIdTokenFromStorage();

    if (!idToken) throw new Error("Failed to get idToken");
    
    const response = await ky.get<TranslateApiResponse>(
      `${this.apiUrl}/translation/translate?${params}`,
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        signal
      }
    );

    return response.json();
  }
  
  getAvailableLanguages() {
    return ky.get<AvailableLanguages>(`${this.apiUrl}/translation/languages`).json();
  };
}
import { AvailableLanguages } from "./languages.ts";

/** How much of a key's allowance has been used in the current billing period. */
export interface ApiKeyUsage {
  characterCount: number;
  characterLimit: number;
}

export interface ApiKeyVerification {
  usage: ApiKeyUsage;
  availableLanguages: AvailableLanguages;
}

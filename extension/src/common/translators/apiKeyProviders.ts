import { DEEPL_FREE_API_URL, DEEPL_PRO_API_URL, isDeepLFreeKey } from "./deepl/consts.ts";

/**
 * What the popup needs to know about a translator that works with the
 * viewer's own API key.
 *
 * Kept apart from the translators themselves so the popup can read it without
 * pulling in their HTTP client. Adding another such translator means an entry
 * here, an `ApiKeyTranslator` subclass registered in `TranslatorFactory`, and
 * the matching `optional_host_permissions` in all three manifests — the form,
 * the storage and the error handling are shared.
 */
export interface ApiKeyProvider {
  /** Where the viewer gets a key. */
  signupUrl: string;
  /**
   * Hosts the background worker has to reach. The provider's services send no
   * CORS headers for the page, and the permission is optional so that adding a
   * provider does not make Chrome disable the extension on update.
   */
  origins: string[];
  /** The plan a key belongs to, when the key itself tells ("free" / "pro"). */
  getPlan?: (apiKey: string) => "free" | "pro";
}

export const API_KEY_PROVIDERS: Partial<Record<string, ApiKeyProvider>> = {
  deepl: {
    signupUrl: "https://www.deepl.com/pro-api",
    // Both hosts, requested together: which one a key belongs to is only known
    // once it is typed in, and one prompt is friendlier than a second later.
    origins: [`${DEEPL_FREE_API_URL}/*`, `${DEEPL_PRO_API_URL}/*`],
    getPlan: (apiKey) => isDeepLFreeKey(apiKey) ? "free" : "pro",
  },
};

export const getApiKeyProvider = (translatorKey: string): ApiKeyProvider | undefined =>
  API_KEY_PROVIDERS[translatorKey];

export const requiresApiKey = (translatorKey: string): boolean =>
  Boolean(getApiKeyProvider(translatorKey));

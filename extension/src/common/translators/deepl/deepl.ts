import ky, { HTTPError, TimeoutError } from "ky";
import { TranslatedData } from "../baseTranslator.ts";
import { ApiKeyTranslator } from "../apiKeyTranslator.ts";
import { TranslatorError, isTranslatorError } from "../translatorError.ts";
import { AvailableLanguages, Language } from "../../types/languages.ts";
import { ApiKeyUsage, ApiKeyVerification } from "../../types/apiKeys.ts";
import { DEEPL_FREE_API_URL, DEEPL_PRO_API_URL, isDeepLFreeKey } from "./consts.ts";
import {
  DeepLErrorResponse,
  DeepLLanguage,
  DeepLTranslationResponse,
  DeepLUsageResponse,
} from "./types.ts";

const REQUEST_TIMEOUT_MS = 15_000;

interface DeepLRequest {
  method: "get" | "post";
  path: string;
  searchParams?: Record<string, string>;
  json?: unknown;
  signal?: AbortSignal;
}

/**
 * DeepL's language codes in the form the rest of the extension uses: BCP 47
 * casing, the way Google and Bing spell theirs (`EN-US` → `en-US`,
 * `ZH-HANS` → `zh-Hans`, `DE` → `de`). A language kept while switching
 * translators then only has to be compared, not translated between spellings.
 */
export const fromDeepLCode = (code: string): string => {
  const [language, ...subtags] = code.split("-");

  return [
    language.toLowerCase(),
    ...subtags.map((subtag) => subtag.length === 4
      // A script subtag (Hans, Hant) is title-cased; a region is upper-cased.
      ? subtag[0].toUpperCase() + subtag.slice(1).toLowerCase()
      : subtag.toUpperCase()),
  ].join("-");
};

/** DeepL takes any casing for a target, but only the bare language for a source. */
const toDeepLTargetCode = (code: string) => code.toUpperCase();
const toDeepLSourceCode = (code: string) => code.split("-")[0].toUpperCase();

export class DeepLTranslator extends ApiKeyTranslator {
  /**
   * The host a key turned out to belong to, when that is not the one its
   * suffix promised. Kept for the life of the worker so the detour costs one
   * extra request, not one per hover.
   */
  private readonly hostOverrides = new Map<string, string>();

  get name() {
    return "DeepL";
  }

  get key() {
    return "deepl";
  }

  // DeepL sends no CORS headers, so a fetch from the YouTube page is blocked —
  // the requests have to be made from the background service worker.
  get needsBackgroundProxy() {
    return true;
  }

  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
  ): Promise<TranslatedData> {
    const apiKey = await this.getStoredApiKey();

    const data = await this.request<DeepLTranslationResponse>(apiKey, {
      method: "post",
      path: "/v2/translate",
      json: {
        text: [text],
        target_lang: toDeepLTargetCode(targetLanguageCode),
        // Left out, DeepL detects the language itself.
        ...(sourceLanguageCode && sourceLanguageCode !== "auto"
          ? { source_lang: toDeepLSourceCode(sourceLanguageCode) }
          : {}),
        // A subtitle fragment is rarely a whole sentence; without this DeepL
        // capitalises it and adds the punctuation it thinks is missing.
        preserve_formatting: true,
      },
      signal,
    });

    const [translation] = data.translations ?? [];

    if (!translation) {
      throw new Error("DeepL returned no translation for this text");
    }

    return {
      detectedLanguageCode: translation.detected_source_language
        ? fromDeepLCode(translation.detected_source_language)
        : sourceLanguageCode,
      translatedText: translation.text,
    };
  }

  /**
   * Asks DeepL every time rather than keeping the lists in memory: this is also
   * how the settings page finds out that a stored key was revoked. When DeepL
   * cannot be reached, the lists it last returned are used instead.
   */
  public async getAvailableLanguages(): Promise<AvailableLanguages> {
    const apiKey = await this.getStoredApiKey();

    try {
      return await this.fetchLanguages(apiKey);
    } catch (error) {
      if (!this.isConnectionFailure(error)) {
        throw error;
      }

      const cachedLanguages = await this.getCachedLanguages();

      if (cachedLanguages) {
        console.warn("DeepL is unreachable, using the languages it returned last time", error);
        return cachedLanguages;
      }

      throw error;
    }
  }

  public async getUsage(apiKey?: string): Promise<ApiKeyUsage> {
    const key = apiKey ?? await this.getStoredApiKey();

    const data = await this.request<DeepLUsageResponse>(key, {
      method: "get",
      path: "/v2/usage",
    });

    return {
      characterCount: data.character_count,
      characterLimit: data.character_limit,
    };
  }

  public async verifyApiKey(apiKey: string): Promise<ApiKeyVerification> {
    const key = apiKey.trim();

    if (!key) {
      throw new TranslatorError("api-key-missing", "No DeepL API key was entered");
    }

    // One after the other: if the key is wrong, the first request says so and
    // the second one is never made.
    const usage = await this.getUsage(key);
    const availableLanguages = await this.fetchLanguages(key);

    return { usage, availableLanguages };
  }

  private async fetchLanguages(apiKey: string): Promise<AvailableLanguages> {
    const results = await Promise.allSettled(["source", "target"].map((type) =>
      this.request<DeepLLanguage[]>(apiKey, {
        method: "get",
        path: "/v2/languages",
        searchParams: { type },
      })
    ));

    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason);

    if (failures.length) {
      // Both requests are waited for: with `Promise.all` a dropped connection on
      // one of them could hide a rejected key on the other, and the caller would
      // then answer from the cache as if DeepL were merely unreachable.
      throw failures.find((failure) => !this.isConnectionFailure(failure)) ?? failures[0];
    }

    const [source, target] = results.map((result) => (result as PromiseFulfilledResult<DeepLLanguage[]>).value);

    const toLanguages = (languages: DeepLLanguage[]): Language[] =>
      languages.map(({ language, name }) => ({ code: fromDeepLCode(language), name }));

    const availableLanguages: AvailableLanguages = {
      sourceLanguages: toLanguages(source),
      targetLanguages: toLanguages(target),
    };

    this.cacheLanguages(availableLanguages);

    return availableLanguages;
  }

  private getBaseUrl(apiKey: string): string {
    return this.hostOverrides.get(apiKey)
      ?? (isDeepLFreeKey(apiKey) ? DEEPL_FREE_API_URL : DEEPL_PRO_API_URL);
  }

  /**
   * Without the permission the browser blocks the request as a cross-origin
   * one, which only surfaces as an anonymous "Failed to fetch". Checking first
   * is what lets the viewer be told to grant it rather than to check their
   * connection.
   */
  private async ensurePermission(baseUrl: string): Promise<void> {
    let granted = true;

    try {
      granted = await chrome.permissions.contains({ origins: [`${baseUrl}/*`] });
    } catch {
      // A browser that cannot answer: let the request itself find out.
    }

    if (!granted) {
      throw new TranslatorError(
        "permission-missing",
        `The extension has no permission to reach ${baseUrl}`,
      );
    }
  }

  private async request<T>(apiKey: string, request: DeepLRequest): Promise<T> {
    const baseUrl = this.getBaseUrl(apiKey);

    try {
      return await this.send<T>(apiKey, baseUrl, request);
    } catch (error) {
      const failure = await this.toTranslatorError(error);

      if (!failure.wrongEndpoint) {
        throw failure.error;
      }

      // A key that belongs to the other host — a free key without its `:fx`,
      // say. DeepL says so explicitly, so try there once and remember it.
      const otherBaseUrl = baseUrl === DEEPL_FREE_API_URL ? DEEPL_PRO_API_URL : DEEPL_FREE_API_URL;

      try {
        const data = await this.send<T>(apiKey, otherBaseUrl, request);
        this.hostOverrides.set(apiKey, otherBaseUrl);
        return data;
      } catch (retryError) {
        throw (await this.toTranslatorError(retryError)).error;
      }
    }
  }

  private async send<T>(apiKey: string, baseUrl: string, request: DeepLRequest): Promise<T> {
    await this.ensurePermission(baseUrl);

    return ky(`${baseUrl}${request.path}`, {
      method: request.method,
      searchParams: request.searchParams,
      json: request.json,
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
      },
      credentials: "omit",
      // No retries, the same as Google and Bing: a 429 retried twice is three
      // requests counted against the limit that caused it.
      retry: 0,
      timeout: REQUEST_TIMEOUT_MS,
      signal: request.signal,
    }).json<T>();
  }

  private isConnectionFailure(error: unknown): boolean {
    return isTranslatorError(error)
      && (error.code === "network" || error.code === "service-unavailable");
  }

  /**
   * The reason DeepL gave, from a JSON body (`message`, `detail`) or, failing
   * that, the body as plain text — a proxy or load balancer in between may
   * answer without JSON, and the reason is still what the status is read by.
   */
  private async readErrorMessage(error: HTTPError): Promise<string> {
    let text: string;

    try {
      text = (await error.response.clone().text()).trim();
    } catch {
      return "";
    }

    try {
      const body = JSON.parse(text) as DeepLErrorResponse;
      const reason = [body.message, body.detail].filter(Boolean).join(" ");
      if (reason) return reason;
    } catch {
      // Not JSON: the text itself is the reason.
    }

    return text.slice(0, 300);
  }

  /**
   * Turns whatever the request threw into an error the viewer can be told
   * about. Aborts pass through untouched: they are the caller's own doing.
   */
  private async toTranslatorError(error: unknown): Promise<{ error: unknown; wrongEndpoint?: boolean }> {
    if (isTranslatorError(error) || (error as Error)?.name === "AbortError") {
      return { error };
    }

    if (error instanceof TimeoutError) {
      return { error: new TranslatorError("network", "DeepL did not answer in time") };
    }

    if (!(error instanceof HTTPError)) {
      // `fetch` rejects with a TypeError when the host cannot be reached.
      if (error instanceof TypeError) {
        return { error: new TranslatorError("network", `Could not reach DeepL: ${error.message}`) };
      }
      return { error };
    }

    const status = error.response.status;
    const reason = await this.readErrorMessage(error);
    const message = `DeepL answered ${status}${reason ? `: ${reason}` : ""}`;

    if (status === 403 && /wrong endpoint/i.test(reason)) {
      return { error: new TranslatorError("api-key-invalid", message), wrongEndpoint: true };
    }

    if (status === 401 || status === 403) {
      return { error: new TranslatorError("api-key-invalid", message) };
    }

    if (status === 456) {
      return { error: new TranslatorError("quota-exceeded", message) };
    }

    if (status === 429) {
      return { error: new TranslatorError("rate-limited", message) };
    }

    if (status === 400 && /_lang\b/i.test(reason)) {
      return { error: new TranslatorError("unsupported-language", message) };
    }

    if (status >= 500) {
      return { error: new TranslatorError("service-unavailable", message) };
    }

    return { error: new Error(message) };
  }
}

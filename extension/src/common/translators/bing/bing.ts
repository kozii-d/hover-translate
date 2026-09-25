import ky, { HTTPError } from "ky";
import { BaseTranslator } from "../baseTranslator.ts";
import { TranslatorError } from "../translatorError.ts";
import {
  BingAvailableLanguagesResponse,
  BingCredentials,
  BingErrorResponse,
  BingTranslationResponse,
} from "./types.ts";

// The credentials are short-lived; refresh them slightly before they expire so
// a hover doesn't have to pay for a retry.
const CREDENTIALS_SAFETY_MARGIN_MS = 60_000;
const DEFAULT_CREDENTIALS_LIFETIME_MS = 3_600_000;

// An optional permission everywhere: requested when the viewer picks Bing, and
// never a required one — see "Browser differences" in CLAUDE.md.
const BING_ORIGIN = "https://www.bing.com/*";

export class BingTranslator extends BaseTranslator {
  // The anonymous auth endpoint this translator used to rely on
  // (https://edge.microsoft.com/translate/auth) was retired by Microsoft and now
  // answers 404, which made every Bing request fail. Translations go through the
  // public web translator instead: its page carries the short-lived anti-abuse
  // credentials that /ttranslatev3 expects.
  private translatorPageUrl = "https://www.bing.com/translator";
  private translateUrl = "https://www.bing.com/ttranslatev3";
  // Still reachable without a token, and it sends permissive CORS headers.
  private languagesUrl = "https://api.cognitive.microsofttranslator.com/languages";

  private credentials: BingCredentials | null = null;
  private pendingCredentials: Promise<BingCredentials> | null = null;
  private requestCount = 0;

  get name() {
    return "Bing";
  }

  get key() {
    return "bing";
  }

  // www.bing.com sends no CORS headers, so a fetch from the YouTube page would be
  // blocked — the requests have to be made from the background service worker.
  get needsBackgroundProxy() {
    return true;
  }

  private parseCredentials(html: string): BingCredentials {
    const ig = html.match(/IG:"([A-Za-z0-9]+)"/)?.[1];
    const iid = html.match(/data-iid="([^"]+)"/)?.[1];
    const abusePreventionParams = html.match(/params_AbusePreventionHelper\s*=\s*\[([^\]]+)]/)?.[1];

    if (!ig || !abusePreventionParams) {
      throw new Error("The Bing translator page did not contain the expected credentials");
    }

    const [rawKey, rawToken, rawLifetime] = abusePreventionParams.split(",");

    const key = Number(rawKey);
    const token = rawToken?.trim().replace(/^["']|["']$/g, "");
    const lifetime = Number(rawLifetime);

    if (!token || !Number.isFinite(key)) {
      throw new Error("The Bing translator page did not contain a usable anti-abuse token");
    }

    const lifetimeMs = Number.isFinite(lifetime) && lifetime > 0
      ? lifetime
      : DEFAULT_CREDENTIALS_LIFETIME_MS;

    return {
      ig,
      iid: iid || "translator.5023",
      key,
      token,
      expiresAtMs: Date.now() + lifetimeMs - CREDENTIALS_SAFETY_MARGIN_MS,
    };
  }

  private async fetchCredentials(): Promise<BingCredentials> {
    const html = await ky.get(this.translatorPageUrl, {
      credentials: "omit",
      timeout: 15_000,
    }).text();

    return this.parseCredentials(html);
  }

  private async getCredentials(): Promise<BingCredentials> {
    if (this.credentials && this.credentials.expiresAtMs > Date.now()) {
      return this.credentials;
    }

    // Hovering a phrase fires several translations at once — they all share a
    // single page request instead of each fetching its own credentials.
    if (!this.pendingCredentials) {
      this.pendingCredentials = this.fetchCredentials()
        .then((credentials) => {
          this.credentials = credentials;
          return credentials;
        })
        .finally(() => {
          this.pendingCredentials = null;
        });
    }

    return this.pendingCredentials;
  }

  /**
   * Without the permission the request fails as an anonymous "Failed to
   * fetch"; checking first is what lets the viewer be told to grant it — and
   * what lets a hover answer through Google meanwhile.
   */
  private async ensurePermission(): Promise<void> {
    let granted = true;

    try {
      granted = await chrome.permissions.contains({ origins: [BING_ORIGIN] });
    } catch {
      // A browser that cannot answer: let the request itself find out.
    }

    if (!granted) {
      throw new TranslatorError("permission-missing", "The extension has no permission to reach www.bing.com");
    }
  }

  private isTranslationResponse(data: unknown): data is BingTranslationResponse {
    return Array.isArray(data) && Boolean(data[0]?.translations?.length);
  }

  private isStaleCredentialsError(error: unknown) {
    return error instanceof HTTPError
      && (error.response.status === 401 || error.response.status === 403);
  }

  private describeFailure(data: BingErrorResponse | unknown): string {
    const failure = (data ?? {}) as BingErrorResponse;

    if (failure.ShowCaptcha) {
      return "Bing asked to solve a captcha before translating. Open www.bing.com/translator, "
        + "confirm you are not a robot, and try again.";
    }

    const details = [failure.statusCode, failure.errorMessage].filter(Boolean).join(": ");

    return `Bing rejected the translation request${details ? ` (${details})` : ""}`;
  }

  private async translationRequest(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    credentials: BingCredentials,
    signal?: AbortSignal
  ) {
    this.requestCount += 1;

    const body = new URLSearchParams({
      fromLang: sourceLanguageCode && sourceLanguageCode !== "auto" ? sourceLanguageCode : "auto-detect",
      text,
      to: targetLanguageCode,
      token: credentials.token,
      key: String(credentials.key),
    });

    const response = await ky.post(this.translateUrl, {
      searchParams: {
        isVertical: "1",
        IG: credentials.ig,
        IID: `${credentials.iid}.${this.requestCount}`,
      },
      body,
      credentials: "omit",
      retry: 0,
      signal,
    });

    return response.json<BingTranslationResponse | BingErrorResponse>();
  }

  private async requestTranslation(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal
  ): Promise<BingTranslationResponse> {
    // Both /translator and /ttranslatev3 are on www.bing.com.
    await this.ensurePermission();

    const attempt = async (refresh: boolean) => {
      if (refresh) {
        this.credentials = null;
      }
      const credentials = await this.getCredentials();
      return this.translationRequest(text, sourceLanguageCode, targetLanguageCode, credentials, signal);
    };

    let refreshed = false;
    let data: BingTranslationResponse | BingErrorResponse;

    try {
      data = await attempt(false);
    } catch (error) {
      if (!this.isStaleCredentialsError(error)) {
        throw error;
      }
      refreshed = true;
      data = await attempt(true);
    }

    // A 200 with an error envelope also means the credentials went stale.
    if (!this.isTranslationResponse(data) && !refreshed) {
      data = await attempt(true);
    }

    if (!this.isTranslationResponse(data)) {
      throw new Error(this.describeFailure(data));
    }

    return data;
  }

  public async getAvailableLanguages() {
    const data = await ky.get(this.languagesUrl, {
      searchParams: {
        "api-version": "3.0",
        scope: "translation",
      },
      credentials: "omit",
    }).json<BingAvailableLanguagesResponse>();

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
    const [data] = await this.requestTranslation(text, sourceLanguageCode, targetLanguageCode, signal);
    const [translation] = data.translations;

    return {
      detectedLanguageCode: data.detectedLanguage?.language ?? sourceLanguageCode,
      translatedText: translation.text,
      transliteration: translation.transliteration?.text,
    };
  }
}

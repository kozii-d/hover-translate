import QuickLRU from "quick-lru";
import { StorageService } from "../../common/services/storageService.ts";
import { TranslationCacheData } from "../../common/types/translations.ts";
import { BaseTranslator } from "../../common/translators/baseTranslator.ts";
import { state } from "../state/stateManager.ts";
import { debugLog } from "../utils/debugLog.ts";

type TranslationCache = QuickLRU<string, TranslationCacheData>;

type TranslationCacheFromStorage = { key: string; value: TranslationCacheData }[];

/**
 * How long new entries are allowed to pile up before the cache is written back.
 *
 * Every write serialises the whole LRU — up to 5000 entries — so writing on each
 * miss meant a multi-megabyte round trip several times a second while watching.
 */
const CACHE_WRITE_DELAY = 5000;

export class TranslationCore {
  private translationCache: TranslationCache;

  /**
   * Whether the stored cache has been merged in yet.
   *
   * Writing before that would replace everything the viewer has accumulated with
   * the two or three entries collected since the page loaded.
   */
  private cacheLoaded = false;

  private hasUnsavedEntries = false;
  private cacheWriteTimeoutId?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor(
    private readonly translator: BaseTranslator,
    private readonly storageService: StorageService = new StorageService(),
  ) {
    this.translationCache = new QuickLRU<string, TranslationCacheData>({ maxSize: 5000 });

    this.loadTranslationCache();

    // A tab is usually left rather than closed, and it can be discarded without
    // ever firing `pagehide`, so both are needed to not lose the pending entries.
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pagehide", this.flushTranslationCache);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("pagehide", this.flushTranslationCache);

    this.flushTranslationCache();
  }

  async loadTranslationCache() {
    try {
      const storedCache = await this.storageService.get<TranslationCacheFromStorage>("translationCache", "local");

      (storedCache || []).forEach(({ key, value }) => {
        // Anything translated while this read was in flight is newer than what
        // storage holds, so it wins.
        if (!this.translationCache.has(key)) {
          this.translationCache.set(key, value);
        }
      });
    } catch (error) {
      console.error("Could not read the translation cache", error);
    } finally {
      // Even after a failed read: never persisting again would be worse than
      // starting the stored cache over.
      this.cacheLoaded = true;
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      this.flushTranslationCache();
    }
  };

  private scheduleCacheWrite() {
    this.hasUnsavedEntries = true;

    // Already waiting: let the pending write pick these entries up too.
    if (this.cacheWriteTimeoutId !== undefined) return;

    this.cacheWriteTimeoutId = setTimeout(() => {
      this.cacheWriteTimeoutId = undefined;
      this.flushTranslationCache();
    }, CACHE_WRITE_DELAY);
  }

  /**
   * Writes the cache back, if there is anything to write.
   *
   * Safe to call at any moment — that is the point of it being the only writer:
   * the visibility and pagehide handlers can fire between scheduled writes.
   */
  public flushTranslationCache = async (): Promise<void> => {
    clearTimeout(this.cacheWriteTimeoutId);
    this.cacheWriteTimeoutId = undefined;

    if (!this.cacheLoaded || !this.hasUnsavedEntries) return;

    this.hasUnsavedEntries = false;

    const newCacheArray = Array.from(this.translationCache.entries(), ([key, value]) => ({ key, value }));

    try {
      await this.storageService.set<TranslationCacheFromStorage>("translationCache", newCacheArray, "local");
    } catch (error) {
      // Running out of quota is the realistic cause. Keep the entries marked
      // unsaved so the next flush retries instead of dropping them silently.
      this.hasUnsavedEntries = true;
      console.error("Could not save the translation cache", error);
    }
  };

  /** The name of the translator in use, for messages shown to the viewer. */
  public get translatorName(): string {
    return this.translator.name;
  }

  private getCacheKey(normalizedText: string): string {
    return `${normalizedText}_${state.settings.sourceLanguageCode}_${state.settings.targetLanguageCode}_${this.translator.key}`;
  }

  /**
   * Whether this text can be translated without asking the translator.
   *
   * Lets the caller skip the hover delay for words that cost nothing: the delay
   * exists to avoid firing requests while the pointer sweeps across a line, and
   * a cache hit fires none.
   */
  public hasCachedTranslation(text: string): boolean {
    const normalizedText = text.trim();

    return Boolean(normalizedText) && this.translationCache.has(this.getCacheKey(normalizedText));
  }

  async translateText(text: string, signal?: AbortSignal): Promise<TranslationCacheData | null> {
    const normalizedText = text.trim();

    if (!normalizedText) {
      return null;
    }

    const cacheKey = this.getCacheKey(normalizedText);

    if (this.translationCache.has(cacheKey)) {
      const cachedData = this.translationCache.get(cacheKey);
      if (!cachedData) {
        return null;
      }
      return cachedData;
    }

    try {
      const translatedData = await this.translator.translate(
        normalizedText,
        state.settings.sourceLanguageCode,
        state.settings.targetLanguageCode,
        signal
      );

      if (!translatedData) {
        return null;
      }

      const result: TranslationCacheData = {
        sourceLanguageCode: translatedData.detectedLanguageCode,
        targetLanguageCode: state.settings.targetLanguageCode,
        translatedText: translatedData.translatedText,
        originalText: text,
        dictionary: translatedData.dictionary,
        transliteration: translatedData.transliteration,
        transcription: translatedData.transcription,
        translatorName: this.translator.name,
      };

      this.translationCache.set(cacheKey, result);
      this.scheduleCacheWrite();

      return result;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        debugLog("Fetch aborted");
        return null;
      } else {
        throw error;
      }
    }
  }
}

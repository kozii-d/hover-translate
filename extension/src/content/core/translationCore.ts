import QuickLRU from "quick-lru";
import { StorageService } from "../../common/services/storageService.ts";
import { TranslationCacheData } from "../../common/types/translations.ts";
import { BaseTranslator } from "../../common/translators/baseTranslator.ts";
import { state } from "../state/stateManager.ts";
import { debugLog } from "../utils/debugLog.ts";
import { hashString } from "../utils/hash.ts";

type TranslationCache = QuickLRU<string, TranslationCacheData>;

type TranslationCacheFromStorage = { key: string; value: TranslationCacheData }[];

/**
 * How long new entries are allowed to pile up before the cache is written back.
 *
 * Every write serialises the whole LRU — up to 5000 entries — so writing on each
 * miss meant a multi-megabyte round trip several times a second while watching.
 */
const CACHE_WRITE_DELAY = 5000;

/**
 * The most context sent along with a selection. A caption window never gets
 * near this; it only guards against a page whose DOM hands over far more text
 * than a subtitle.
 */
const MAX_CONTEXT_LENGTH = 500;

/**
 * Where `text` starts in `context`, allowing any whitespace — or none — between
 * its characters: a selection across two caption lines has a space (or, in
 * Chinese, nothing) where the context has a line break. -1 when absent.
 */
const findIgnoringWhitespace = (context: string, text: string): number => {
  const characters = Array.from(text.replace(/\s+/g, ""));
  if (!characters.length) return -1;

  const pattern = characters
    .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");

  return context.search(new RegExp(pattern, "u"));
};

/**
 * The context in the form it is sent and hashed in: each line trimmed, runs of
 * whitespace inside a line collapsed to one space, empty lines dropped. Line
 * breaks are kept — they are where the caption lines meet.
 *
 * Returns undefined when there is nothing the translator could use: no context
 * at all, or one that is just the selection again (the whole caption selected).
 */
const normalizeContext = (text: string, context?: string): string | undefined => {
  if (!context) return undefined;

  let normalized = context
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  // Compared without any whitespace: two Chinese caption lines are joined by a
  // line break in the context and by nothing in the selection.
  const stripWhitespace = (value: string) => value.replace(/\s+/g, "");
  if (!normalized || stripWhitespace(normalized) === stripWhitespace(text)) return undefined;

  if (normalized.length > MAX_CONTEXT_LENGTH) {
    // Keep the stretch around the selection, which is what the context is for.
    const position = Math.max(findIgnoringWhitespace(normalized, text), 0);
    const start = Math.max(0, Math.min(
      position - Math.floor((MAX_CONTEXT_LENGTH - text.length) / 2),
      normalized.length - MAX_CONTEXT_LENGTH,
    ));
    normalized = normalized.slice(start, start + MAX_CONTEXT_LENGTH).trim();
  }

  return normalized;
};

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

  /** How many translations are cached, in memory: no storage read. */
  public get cachedTranslationsCount(): number {
    return this.translationCache.size;
  }

  /** The name of the translator in use, for messages shown to the viewer. */
  public get translatorName(): string {
    return this.translator.name;
  }

  /**
   * Whether the translator makes use of the caption around the selection. When
   * it doesn't, callers need not collect it at all.
   */
  public get supportsContext(): boolean {
    return this.translator.supportsContext;
  }

  /**
   * The context actually sent for this text, or undefined when none is: the
   * translator ignores it, or there is nothing in it beyond the text itself.
   */
  private getEffectiveContext(normalizedText: string, context?: string): string | undefined {
    return this.supportsContext ? normalizeContext(normalizedText, context) : undefined;
  }

  /**
   * A translation made with context is only valid in that context, so its hash
   * is part of the key. The hash rather than the context itself: the whole LRU
   * is serialised into `local` storage on every flush, and a caption line in
   * each key would multiply its size. Without context the key is exactly what
   * it always was, so Google and Bing keep their accumulated cache.
   */
  private getCacheKey(normalizedText: string, context?: string): string {
    const key = `${normalizedText}_${state.settings.sourceLanguageCode}_${state.settings.targetLanguageCode}_${this.translator.key}`;

    return context ? `${key}_${hashString(context)}` : key;
  }

  /**
   * Whether this text can be translated without asking the translator.
   *
   * Lets the caller skip the hover delay for words that cost nothing: the delay
   * exists to avoid firing requests while the pointer sweeps across a line, and
   * a cache hit fires none.
   */
  public hasCachedTranslation(text: string, context?: string): boolean {
    const normalizedText = text.trim();
    if (!normalizedText) return false;

    const cacheKey = this.getCacheKey(normalizedText, this.getEffectiveContext(normalizedText, context));

    return this.translationCache.has(cacheKey);
  }

  async translateText(text: string, context?: string, signal?: AbortSignal): Promise<TranslationCacheData | null> {
    const normalizedText = text.trim();

    if (!normalizedText) {
      return null;
    }

    const effectiveContext = this.getEffectiveContext(normalizedText, context);
    const cacheKey = this.getCacheKey(normalizedText, effectiveContext);

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
        signal,
        effectiveContext,
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

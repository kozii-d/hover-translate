import rgba from "color-rgba";
import alpha from "color-alpha";

import {
  TOOLTIP_CLASS,
  CAPTION_WINDOW,
  CAPTION_VISUAL_LINE,
  TOOLTIP_WORD_CLASS,
  CAPTION_SEGMENT,
  DATA_ATTRIBUTES,
  TOOLTIP_SELECTED_WORD_CLASS,
  TOOLTIP_SETTINGS, NOTIFICATION_TOOLTIP_CLASS,
} from "../consts/consts.ts";
import { isCaptionWindowInUpperHalf } from "../utils/domUtils.ts";
import { TranslationCore } from "../core/translationCore";
import { StorageService } from "../../common/services/storageService.ts";
import { state } from "../state/stateManager.ts";
import { TranslationCacheData, TranslationData } from "../../common/types/translations.ts";
import { TranslatorErrorCode, isTranslatorError } from "../../common/translators/translatorError.ts";
import { PermissionFallbackNotice } from "../../common/translators/permissionFallbackTranslator.ts";

interface AbortableElement extends HTMLElement {
  abortController?: AbortController;
}

/**
 * How long the pointer has to rest on a word before it is translated.
 *
 * Without it every `pointerenter` fired a request, so sweeping across a ten-word
 * caption meant ten of them — which is what got Bing to answer with a captcha.
 * Words that are already cached skip the wait entirely.
 */
const HOVER_DELAY = 200;

const NOTIFICATION_DURATION = 2000;

/**
 * A failure that tells the viewer what to do about it takes longer to read
 * than "Translation saved", and there is nothing else on screen explaining it.
 */
const ACTIONABLE_ERROR_DURATION = 5000;

/**
 * The message shown for each reason a translator can give. Each one takes the
 * translator's name as its only substitution.
 */
const TRANSLATOR_ERROR_MESSAGES: Record<TranslatorErrorCode, string> = {
  "api-key-missing": "errorApiKeyMissing",
  "api-key-invalid": "errorApiKeyInvalid",
  "quota-exceeded": "errorQuotaExceeded",
  "rate-limited": "errorRateLimited",
  "permission-missing": "errorPermissionMissing",
  "unsupported-language": "errorUnsupportedLanguage",
  "network": "errorNetwork",
  "service-unavailable": "errorServiceUnavailable",
};

export class TooltipService {
  private selectedWordsNodes: Set<HTMLElement>;
  private firstSelectedWordNode: HTMLElement | null;
  private lastSelectedWordNode: HTMLElement | null;

  /**
   * The translation request started for the selection that is currently on
   * screen, together with the exact text it was started for.
   *
   * Click actions used to read the translator's "last thing translated", which
   * is a different value entirely: a click landing before the pending request
   * resolved saved (or copied) the *previous* word. Keeping the request next to
   * the text it belongs to lets a click wait for its own translation and reject
   * anything that no longer matches the selection.
   */
  private activeTranslation: { text: string; promise: Promise<TranslationCacheData | null> } | null;

  private hoverTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly translationCore: TranslationCore,
    private readonly storageService: StorageService = new StorageService(),
  )
  {
    this.selectedWordsNodes = new Set<HTMLElement>();
    this.firstSelectedWordNode = null;
    this.lastSelectedWordNode = null;
    this.activeTranslation = null;
  }

  public deleteActiveTooltip() {
    document
      .querySelectorAll(`.${TOOLTIP_CLASS}`)
      .forEach((tooltip) => tooltip.remove());
  }

  private async showTooltip(targetNode: AbortableElement) {
    const textToTranslate = this.getSelectedText();

    // A word that is not indexed yet cannot join the selection, so there can be
    // nothing to translate.
    if (!textToTranslate) return;

    const context = this.getSelectionContext();

    // Create a new AbortController for this element
    const abortController = new AbortController();
    targetNode.abortController = abortController;

    let translatedData: TranslationCacheData | null;

    const request = this.translationCore.translateText(textToTranslate, context, abortController.signal);
    // A click may land before this resolves; it has to be able to await exactly
    // this request instead of whatever finished last.
    this.activeTranslation = { text: textToTranslate, promise: request };

    try {
      translatedData = await request;
    } catch (error) {
      // Without this the failure was a silent unhandled rejection: no tooltip
      // appeared and nothing told the viewer why.
      delete targetNode.abortController;
      this.reportTranslationFailure(error);
      return;
    }

    // Delete link to abortController after request is done
    delete targetNode.abortController;

    if (!translatedData) return;

    // The window the hovered word sits in. Taking the first one on the page
    // meant that with two caption windows on screen — two speakers — a word in
    // the second one was translated, and paid for, but never shown.
    const subtitlesContainer = targetNode.closest<HTMLElement>(`.${CAPTION_WINDOW}`);
    if (!subtitlesContainer || !translatedData.translatedText) return;

    this.deleteActiveTooltip();

    // The captions may have been redrawn while the request was running.
    if (!targetNode.isConnected) return;
    if (!this.firstSelectedWordNode) return;

    const tooltip = document.createElement("div");
    tooltip.className = TOOLTIP_CLASS;
    tooltip.textContent = translatedData.translatedText;

    tooltip.style.visibility = "hidden";

    const container = document.fullscreenElement ? document.fullscreenElement : document.body;

    container.appendChild(tooltip);

    this.styleTooltip(tooltip);
    this.positionTooltip(this.firstSelectedWordNode, tooltip, subtitlesContainer);
  }

  private async showNotificationTooltip(
    text: string,
    isError: boolean = false,
    durationMs: number = NOTIFICATION_DURATION,
  ) {
    // Errors are reported even with notifications off — the setting covers the
    // save/copy confirmations, and a failed translation shows nothing otherwise.
    if (!state.settings.showNotifications && !isError) return;

    const previousTooltip = document.querySelector<HTMLElement>(`.${NOTIFICATION_TOOLTIP_CLASS}`);
    if (previousTooltip) {
      previousTooltip.remove();
    }

    const tooltip = document.createElement("div");
    tooltip.className = NOTIFICATION_TOOLTIP_CLASS;
    tooltip.textContent = text;

    tooltip.style.visibility = "hidden";

    const container = document.fullscreenElement ? document.fullscreenElement : document.body;

    container.appendChild(tooltip);

    this.styleTooltip(tooltip);
    this.positionNotificationTooltip(tooltip);

    setTimeout(() => {
      tooltip.remove();
    }, durationMs);
  }

  private positionNotificationTooltip(tooltip: HTMLDivElement) {
    const video = document.querySelector("video");

    if (!video) return;

    const rectVideo = video.getBoundingClientRect();

    tooltip.style.position = "absolute";
    tooltip.style.left = `${rectVideo.left + 65}px`;
    tooltip.style.top = `${rectVideo.top + 40}px`;

    tooltip.style.visibility = "visible";
  }

  private styleTooltip(tooltip: HTMLDivElement) {
    const captionSegment = document.querySelector<HTMLElement>(`.${CAPTION_SEGMENT}`);
    if (!captionSegment) return;

    const youtubeSubtitleContainerStyles = window.getComputedStyle(captionSegment);

    const {
      useYouTubeSettings,
      fontFamily,
      fontColor,
      fontOpacity,
      fontSize,
      backgroundColor,
      backgroundOpacity,
      characterEdgeStyle
    } = state.tooltipTheme;

    if (useYouTubeSettings) {
      tooltip.style.fontFamily = youtubeSubtitleContainerStyles.fontFamily;
      tooltip.style.color = youtubeSubtitleContainerStyles.color;
      tooltip.style.fontSize = youtubeSubtitleContainerStyles.fontSize;
      tooltip.style.fontVariant = youtubeSubtitleContainerStyles.fontVariant;
      tooltip.style.background = youtubeSubtitleContainerStyles.background;
      tooltip.style.textShadow = youtubeSubtitleContainerStyles.textShadow;
      return;
    }

    if (fontFamily === "small-capitals") {
      tooltip.style.fontFamily = TOOLTIP_SETTINGS.fontFamily[fontFamily];
      tooltip.style.fontVariant = "small-caps";
    } else if (fontFamily === "auto") {
      tooltip.style.fontFamily = youtubeSubtitleContainerStyles.fontFamily;
    } else {
      tooltip.style.fontFamily = TOOLTIP_SETTINGS.fontFamily[fontFamily];
    }

    const newFontColor = fontColor === "auto" ? youtubeSubtitleContainerStyles.color : TOOLTIP_SETTINGS.fontColor[fontColor];
    const ytSubtitleContainerColor = rgba(youtubeSubtitleContainerStyles.color);
    if (ytSubtitleContainerColor.length) {
      const [, , , ytAlpha] = ytSubtitleContainerColor;
      tooltip.style.color = fontOpacity === "auto" ? alpha(newFontColor, ytAlpha) : alpha(newFontColor, TOOLTIP_SETTINGS.fontOpacity[fontOpacity]);
    }

    if (fontSize === "auto") {
      tooltip.style.fontSize = youtubeSubtitleContainerStyles.fontSize;
    } else {
      tooltip.style.fontSize = TOOLTIP_SETTINGS.fontSize[fontSize];
    }

    const newBackgroundColor = backgroundColor === "auto" ? youtubeSubtitleContainerStyles.backgroundColor : TOOLTIP_SETTINGS.backgroundColor[backgroundColor];
    const ytSubtitleContainerBackground = rgba(youtubeSubtitleContainerStyles.background);
    
    if (ytSubtitleContainerBackground.length) {
      const [, , , ytBackgroundAlpha] = ytSubtitleContainerBackground;
      tooltip.style.background = youtubeSubtitleContainerStyles.background;
      tooltip.style.backgroundColor = backgroundOpacity === "auto" ? alpha(newBackgroundColor, ytBackgroundAlpha) : alpha(newBackgroundColor, TOOLTIP_SETTINGS.backgroundOpacity[backgroundOpacity]);
    }

    if (characterEdgeStyle === "auto") {
      tooltip.style.textShadow = youtubeSubtitleContainerStyles.textShadow;
    } else {
      tooltip.style.textShadow = TOOLTIP_SETTINGS.characterEdgeStyle[characterEdgeStyle];
    }
  }

  private positionTooltip(
    anchorWordNode: HTMLElement,
    tooltip: HTMLDivElement,
    subtitlesContainer: HTMLElement
  ) {
    // Hide tooltip during positioning calculations
    tooltip.style.visibility = "hidden";
    tooltip.style.position = "absolute";

    const video = document.querySelector("video");
    if (!video) return;

    const TOOLTIP_MARGIN = 10;
    const TOOLTIP_GAP = 5;

    // Get bounding rectangles for video, anchor word, and subtitles container
    const videoRect = video.getBoundingClientRect();
    const rectAnchorWord = anchorWordNode.getBoundingClientRect();
    const rectSubtitlesContainer = subtitlesContainer.getBoundingClientRect();

    // Set maximum width to fit within video bounds
    const maxTooltipWidth = videoRect.width - (TOOLTIP_MARGIN * 2);
    tooltip.style.maxWidth = `${maxTooltipWidth}px`;
    tooltip.style.width = "auto";
    tooltip.style.boxSizing = "border-box";
    tooltip.style.overflowWrap = "break-word";

    // Set initial horizontal position aligned with anchor word
    tooltip.style.left = `${rectAnchorWord.left + window.scrollX}px`;

    // Position tooltip above or below subtitles based on screen location
    const tooltipHeight = tooltip.offsetHeight;
    let topPosition;
    if (isCaptionWindowInUpperHalf(subtitlesContainer)) {
      topPosition = rectSubtitlesContainer.bottom + TOOLTIP_GAP + window.scrollY;
    } else {
      topPosition = rectSubtitlesContainer.top - tooltipHeight - TOOLTIP_GAP + window.scrollY;
    }
    tooltip.style.top = `${topPosition}px`;

    const tooltipRect = tooltip.getBoundingClientRect();

    const minLeft = videoRect.left + TOOLTIP_MARGIN;
    const maxRight = videoRect.right - TOOLTIP_MARGIN;

    let newLeft = tooltipRect.left;

    // Shift left if tooltip extends beyond right edge
    if (tooltipRect.right > maxRight) {
      newLeft -= (tooltipRect.right - maxRight);
    }

    // Ensure tooltip doesn't go beyond left edge
    if (newLeft < minLeft) {
      newLeft = minLeft;
    }

    // Apply final position and show tooltip
    tooltip.style.left = `${newLeft + window.scrollX}px`;
    tooltip.style.visibility = "visible";
  }

  /**
   * The position of a word in the document-wide numbering, or null while it has
   * none yet.
   *
   * Freshly built spans live without `data-index` until the next reindex, and
   * falling back to 0 made every one of them look like the very first word on
   * screen, which either collapsed the selection or stretched it to the start of
   * the captions. Such a word simply cannot take part in the range.
   */
  private getWordIndex(wordNode: HTMLElement): number | null {
    const rawIndex = wordNode.getAttribute(DATA_ATTRIBUTES.INDEX);
    if (rawIndex === null) return null;

    const index = parseInt(rawIndex, 10);

    return Number.isNaN(index) ? null : index;
  }

  /**
   * The selected words in document order, joined exactly the way they are sent
   * to the translator. It is also the identity of the current selection: a
   * translation is only usable for a click while it still matches this string.
   *
   * The spans are joined by what they already carry rather than by a space:
   * every word split off whitespace ends with one, and two Chinese words must
   * not be prised apart by a space that was never in the subtitle.
   */
  private getSelectedText(): string {
    return this.getSortedSelectedWords().map((wordNode) => wordNode.textContent ?? "").join("").trim();
  }

  /** The selected words in document order. */
  private getSortedSelectedWords(): HTMLElement[] {
    return Array.from(this.selectedWordsNodes).sort((a, b) => {
      return (this.getWordIndex(a) ?? Number.MAX_SAFE_INTEGER) - (this.getWordIndex(b) ?? Number.MAX_SAFE_INTEGER);
    });
  }

  /**
   * The text of the caption window the selection sits in — every window it
   * touches, in order, on the rare selection that spans several — one visual
   * line per line. Only those windows: positioned manual captions can show
   * several at once, one per speaker, and a neighbour's phrase steers the
   * translation wrong.
   *
   * Read line by line rather than as the window's `textContent`, so the result
   * depends neither on the separators in our spans nor on whether a line YouTube
   * just redrew has been split into spans yet.
   *
   * Whitespace inside a line is collapsed here only so that a line break in a
   * caption's text cannot pass for the end of a line; trimming, dropping empty
   * lines and the length limit are `TranslationCore`'s, which hashes the result.
   *
   * Undefined when the translator makes no use of context: the DOM is then not
   * walked on every hover for nothing.
   */
  private getSelectionContext(): string | undefined {
    if (!this.translationCore.supportsContext) return undefined;

    // A Set keeps the order windows were first met in, which is the order of
    // the words.
    const captionWindows = new Set<HTMLElement>();

    this.getSortedSelectedWords().forEach((wordNode) => {
      const captionWindow = wordNode.closest<HTMLElement>(`.${CAPTION_WINDOW}`);
      if (captionWindow) captionWindows.add(captionWindow);
    });

    const lines = Array.from(captionWindows).flatMap((captionWindow) => {
      const visualLines = captionWindow.querySelectorAll<HTMLElement>(`.${CAPTION_VISUAL_LINE}`);

      // Markup without visual lines (YouTube changed it): the window's text as
      // a whole still carries every word with its separator.
      const lineNodes: HTMLElement[] = visualLines.length ? Array.from(visualLines) : [captionWindow];

      return lineNodes.map((line) => (line.textContent ?? "").replace(/\s+/g, " "));
    });

    return lines.join("\n") || undefined;
  }

  private updateSelectedWords = (selectedNode: HTMLElement) => {
    const selectedWordIndex = this.getWordIndex(selectedNode);
    if (selectedWordIndex === null) return;

    const firstWordIndex = this.firstSelectedWordNode ? this.getWordIndex(this.firstSelectedWordNode) : null;
    if (firstWordIndex === null || selectedWordIndex < firstWordIndex) {
      this.firstSelectedWordNode = selectedNode;
    }

    const lastWordIndex = this.lastSelectedWordNode ? this.getWordIndex(this.lastSelectedWordNode) : null;
    if (lastWordIndex === null || selectedWordIndex > lastWordIndex) {
      this.lastSelectedWordNode = selectedNode;
    }

    this.applySelectionRange();
  };

  /**
   * Highlights every word between the two ends of the selection, dropping the
   * words that fell out of it. The range is resolved against the words currently
   * on screen, so it keeps spanning several caption lines after the captions have
   * been re-rendered.
   */
  private applySelectionRange = () => {
    const firstWordIndex = this.firstSelectedWordNode ? this.getWordIndex(this.firstSelectedWordNode) : null;
    const lastWordIndex = this.lastSelectedWordNode ? this.getWordIndex(this.lastSelectedWordNode) : null;

    if (firstWordIndex === null || lastWordIndex === null) {
      this.clearSelectedWords();
      return;
    }

    this.selectedWordsNodes.forEach((word) => word.classList.remove(TOOLTIP_SELECTED_WORD_CLASS));
    this.selectedWordsNodes.clear();

    document.querySelectorAll<HTMLElement>(`.${TOOLTIP_WORD_CLASS}`).forEach((word) => {
      const wordIndex = this.getWordIndex(word);
      if (wordIndex === null || wordIndex < firstWordIndex || wordIndex > lastWordIndex) return;

      this.selectedWordsNodes.add(word);
      word.classList.add(TOOLTIP_SELECTED_WORD_CLASS);
    });
  };

  /**
   * Re-resolves the selection after the captions were rebuilt and reindexed.
   *
   * Dropping the selection on every caption change is what made a selection
   * started on one line collapse to a single word on the next one: auto-generated
   * captions keep growing while the user is still dragging across them. The
   * selection is only given up when the words it was anchored to have actually
   * left the screen.
   */
  public refreshSelectedWords = () => {
    if (!this.firstSelectedWordNode && !this.lastSelectedWordNode) return;

    if (!this.firstSelectedWordNode?.isConnected || !this.lastSelectedWordNode?.isConnected) {
      this.clearSelectedWords();
      return;
    }

    this.applySelectionRange();
  };

  public clearSelectedWords = () => {
    this.cancelPendingTooltip();
    this.firstSelectedWordNode = null;
    this.lastSelectedWordNode = null;
    this.activeTranslation = null;
    this.selectedWordsNodes.forEach((word) => word.classList.remove(TOOLTIP_SELECTED_WORD_CLASS));
    this.selectedWordsNodes.clear();
  };

  /** Drops a translation that was scheduled but not started yet. */
  private cancelPendingTooltip() {
    clearTimeout(this.hoverTimeoutId);
    this.hoverTimeoutId = undefined;
  }

  public handleWordMouseEnter = (event: PointerEvent) => {
    const target = event.target as AbortableElement;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
      if (!this.selectedWordsNodes.has(target)) {
        this.updateSelectedWords(target);
      }

      // The selection is highlighted straight away; only the request waits.
      this.cancelPendingTooltip();

      if (this.translationCore.hasCachedTranslation(this.getSelectedText(), this.getSelectionContext())) {
        this.showTooltip(target);
        return;
      }

      this.hoverTimeoutId = setTimeout(() => {
        this.hoverTimeoutId = undefined;
        this.showTooltip(target);
      }, HOVER_DELAY);
    }
  };

  public handleWordMouseLeave = (event: PointerEvent) => {
    const target = event.target as AbortableElement;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
      this.cancelPendingTooltip();

      // Cancel the request if it's still pending
      if (target.abortController) {
        target.abortController.abort();
        delete target.abortController;
      }

      if (!event.shiftKey && !state.settings.alwaysMultipleSelection) {
        this.clearSelectedWords();
      }

      this.deleteActiveTooltip();
    }
  };

  /**
   * The translation of the words that are selected right now, waiting for the
   * in-flight request when the click beat it.
   *
   * Returns null only when there is nothing selected; otherwise the caller is
   * guaranteed to get data for the clicked words and never for a neighbour.
   */
  private async resolveSelectionTranslation(): Promise<TranslationCacheData | null> {
    const selectedText = this.getSelectedText();
    if (!selectedText) return null;

    const activeTranslation = this.activeTranslation;

    if (activeTranslation?.text === selectedText) {
      // `catch` here only defers the failure: the retry below reports it.
      const translatedData = await activeTranslation.promise.catch(() => null);
      if (translatedData) return translatedData;
    }

    // Either nothing was requested for these words, or the hover request was
    // aborted by the pointer leaving the word while the click was resolving.
    // Ask again — unaborted this time — so the click still acts on its own word,
    // and in its caption, so it gets the meaning the tooltip showed.
    return this.translationCore.translateText(selectedText, this.getSelectionContext());
  }

  /**
   * `resolveSelectionTranslation` for the click handlers: the retry it may run
   * can reject, and an unhandled rejection in a pointer handler is invisible to
   * the viewer.
   */
  private async resolveTranslationForAction(): Promise<TranslationCacheData | null> {
    try {
      return await this.resolveSelectionTranslation();
    } catch (error) {
      this.reportTranslationFailure(error);
      return null;
    }
  }

  /**
   * Tells the viewer why a translation failed when the translator said why —
   * a missing or rejected API key, a used-up quota — and falls back to the
   * generic message otherwise.
   */
  private reportTranslationFailure(error: unknown) {
    if (!isTranslatorError(error)) {
      console.error("Translation failed", error);
      this.showNotificationTooltip(chrome.i18n.getMessage("translationFailed"), true);
      return;
    }

    // An expected, explained condition rather than a bug: a warning is enough.
    console.warn("Translation failed", error);

    const message = chrome.i18n.getMessage(
      TRANSLATOR_ERROR_MESSAGES[error.code],
      [this.translationCore.translatorName],
    );

    this.showNotificationTooltip(
      message || chrome.i18n.getMessage("translationFailed"),
      true,
      ACTIONABLE_ERROR_DURATION,
    );
  }

  /**
   * Tells the viewer why their translator's words come from another one — Bing
   * without access to www.bing.com, answered by Google — and where to fix it.
   * Called once per browser session (see `ClaimPermissionFallbackNoticeMessage`).
   * Shown like an error, notifications setting or not: otherwise the switch
   * goes unexplained.
   */
  public reportPermissionFallback = ({ translatorName, host, fallbackTranslatorName }: PermissionFallbackNotice) => {
    this.showNotificationTooltip(
      chrome.i18n.getMessage("noticePermissionFallback", [translatorName, host, fallbackTranslatorName]),
      true,
      ACTIONABLE_ERROR_DURATION,
    );
  };

  private isSameSavedTranslation = (translationData1: TranslationData, translationData2: TranslationData) => {
    return translationData1.sourceLanguageCode === translationData2.sourceLanguageCode &&
      translationData1.translatedText === translationData2.translatedText &&
      translationData1.originalText === translationData2.originalText &&
      translationData1.targetLanguageCode === translationData2.targetLanguageCode;
  };

  public saveTranslationToDictionary = async () => {
    const currentData = await this.resolveTranslationForAction();
    if (!currentData) return;

    try {
      const savedTranslations = await this.storageService.get<TranslationData[]>("savedTranslations", "local");
      const savedTranslationsArray = savedTranslations || [];

      const newSavedTranslation: TranslationData  = {
        id: crypto.randomUUID(),
        ...currentData,
        timestamp: Date.now(),
      };

      // Remove the current translation from the saved translations array to avoid duplicates
      const filteredTranslations = savedTranslationsArray.filter((translation) => {
        return !this.isSameSavedTranslation(translation, newSavedTranslation);
      });

      filteredTranslations.unshift(newSavedTranslation);

      await this.storageService.set("savedTranslations", filteredTranslations, "local");
    } catch (error) {
      // Running out of the local storage quota is the realistic cause. Nothing
      // awaits this handler, so the write used to vanish without a trace: no
      // saved word, no message, and an unhandled rejection as the only sign.
      console.error("Saving the translation failed", error);
      this.showNotificationTooltip(chrome.i18n.getMessage("saveFailed"), true);
      return;
    }

    this.showNotificationTooltip(chrome.i18n.getMessage("translationSaved"));
  };

  public saveOriginalTextToClipboard = async () => {
    const currentData = await this.resolveTranslationForAction();
    if (!currentData) return;

    await this.copyToClipboard(currentData.originalText, "originalTextCopied");
  };

  public saveTranslationToClipboard = async () => {
    const currentData = await this.resolveTranslationForAction();
    if (!currentData) return;

    await this.copyToClipboard(currentData.translatedText, "translatedTextCopied");
  };

  /**
   * The clipboard can refuse the write — the browser only grants it while the
   * click still counts as a recent user gesture, and waiting for a slow
   * translation can outlast that. Nothing awaits these handlers, so a rejection
   * here would surface as an unhandled rejection and nothing else.
   */
  private async copyToClipboard(text: string, successMessageKey: string) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Copying to the clipboard failed", error);
      this.showNotificationTooltip(chrome.i18n.getMessage("copyFailed"), true);
      return;
    }

    this.showNotificationTooltip(chrome.i18n.getMessage(successMessageKey));
  }
}
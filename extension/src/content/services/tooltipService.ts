import rgba from "color-rgba";
import alpha from "color-alpha";

import {
  TOOLTIP_CLASS,
  CAPTION_WINDOW,
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

interface AbortableElement extends HTMLElement {
  abortController?: AbortController;
}

export class TooltipService {
  private selectedWordsNodes: Set<HTMLElement>;
  private firstSelectedWordNode: HTMLElement | null;
  private lastSelectedWordNode: HTMLElement | null;

  constructor(
    private readonly translationCore: TranslationCore,
    private readonly storageService: StorageService = new StorageService(),
  )
  {
    this.selectedWordsNodes = new Set<HTMLElement>();
    this.firstSelectedWordNode = null;
    this.lastSelectedWordNode = null;
  }

  public deleteActiveTooltip() {
    document
      .querySelectorAll(`.${TOOLTIP_CLASS}`)
      .forEach((tooltip) => tooltip.remove());
  }

  private async showTooltip(targetNode: AbortableElement) {
    const sortedWordNodes = Array.from(this.selectedWordsNodes).sort((a, b) => {
      return (this.getWordIndex(a) ?? Number.MAX_SAFE_INTEGER) - (this.getWordIndex(b) ?? Number.MAX_SAFE_INTEGER);
    });

    const words = sortedWordNodes.map((wordNode) => wordNode.textContent?.trim() || "");
    const textToTranslate = words.join(" ");

    // A word that is not indexed yet cannot join the selection, so there can be
    // nothing to translate.
    if (!textToTranslate) return;

    // Create a new AbortController for this element
    const abortController = new AbortController();
    targetNode.abortController = abortController;

    let translatedData: TranslationCacheData | null;

    try {
      translatedData = await this.translationCore.translateText(textToTranslate, abortController.signal);
    } catch (error) {
      // Without this the failure was a silent unhandled rejection: no tooltip
      // appeared and nothing told the viewer why.
      delete targetNode.abortController;
      console.error("Translation failed", error);
      this.showNotificationTooltip(chrome.i18n.getMessage("translationFailed"), true);
      return;
    }

    // Delete link to abortController after request is done
    delete targetNode.abortController;

    if (!translatedData) return;

    const subtitlesContainer = document.querySelector<HTMLElement>(`.${CAPTION_WINDOW}`);
    if (!subtitlesContainer || !translatedData.translatedText) return;

    this.deleteActiveTooltip();

    if (!subtitlesContainer.contains(targetNode)) return;
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

  private async showNotificationTooltip(text: string, isError: boolean = false) {
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
    }, 2000);
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
    if (isCaptionWindowInUpperHalf()) {
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
    this.firstSelectedWordNode = null;
    this.lastSelectedWordNode = null;
    this.selectedWordsNodes.forEach((word) => word.classList.remove(TOOLTIP_SELECTED_WORD_CLASS));
    this.selectedWordsNodes.clear();
  };

  public handleWordMouseEnter = (event: PointerEvent) => {
    const target = event.target as AbortableElement;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
      if (!this.selectedWordsNodes.has(target)) {
        this.updateSelectedWords(target);
      }

      this.showTooltip(target);
    }
  };

  public handleWordMouseLeave = (event: PointerEvent) => {
    const target = event.target as AbortableElement;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
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

  private isSameSavedTranslation = (translationData1: TranslationData, translationData2: TranslationData) => {
    return translationData1.sourceLanguageCode === translationData2.sourceLanguageCode &&
      translationData1.translatedText === translationData2.translatedText &&
      translationData1.originalText === translationData2.originalText &&
      translationData1.targetLanguageCode === translationData2.targetLanguageCode;
  };

  public saveTranslationToDictionary = async () => {
    const currentData = this.translationCore.currentTranslationData;
    if (!currentData) return;

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
    this.showNotificationTooltip(chrome.i18n.getMessage("translationSaved"));
  };

  public saveOriginalTextToClipboard = async () => {
    const currentData = this.translationCore.currentTranslationData;
    if (!currentData) return;

    const textToCopy = currentData.originalText;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    this.showNotificationTooltip(chrome.i18n.getMessage("originalTextCopied"));
  };

  public saveTranslationToClipboard = async () => {
    const currentData = this.translationCore.currentTranslationData;
    if (!currentData) return;

    const textToCopy = currentData.translatedText;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    this.showNotificationTooltip(chrome.i18n.getMessage("translatedTextCopied"));
  };
}
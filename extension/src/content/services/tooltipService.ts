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
import { TranslationData } from "../../common/types/translations.ts";

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
      const aIndex = parseInt(a.getAttribute(DATA_ATTRIBUTES.INDEX) ?? "0", 10);
      const bIndex = parseInt(b.getAttribute(DATA_ATTRIBUTES.INDEX) ?? "0", 10);
      return aIndex - bIndex;
    });

    const words = sortedWordNodes.map((wordNode) => wordNode.textContent?.trim() || "");
    const textToTranslate = words.join(" ");

    // Create a new AbortController for this element
    const abortController = new AbortController();
    targetNode.abortController = abortController;

    const translatedData = await this.translationCore.translateText(textToTranslate, abortController.signal);

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

  private async showNotificationTooltip(text: string) {
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
    tooltip.style.visibility = "hidden";
    tooltip.style.top = "0px";
    tooltip.style.left = "0px";

    const rectAnchorWord = anchorWordNode.getBoundingClientRect();
    tooltip.style.left = `${rectAnchorWord.left + window.scrollX}px`;

    const rectSubtitlesContainer = subtitlesContainer.getBoundingClientRect();

    const tooltipHeight = tooltip.offsetHeight;

    let topPosition;
    if (isCaptionWindowInUpperHalf()) {
      topPosition = rectSubtitlesContainer.bottom + 5 + window.scrollY;
    } else {
      topPosition = rectSubtitlesContainer.top - tooltipHeight - 5 + window.scrollY;
    }
    tooltip.style.top = `${topPosition}px`;
    tooltip.style.visibility = "visible";
  }

  private updateSelectedWords = (selectedNode: HTMLElement) => {
    const selectedWordIndex = parseInt(selectedNode.getAttribute(DATA_ATTRIBUTES.INDEX) ?? "0", 10);

    if (this.firstSelectedWordNode) {
      const firstWordIndex = parseInt(this.firstSelectedWordNode.getAttribute(DATA_ATTRIBUTES.INDEX) ?? "0", 10);
      if (selectedWordIndex < firstWordIndex) {
        this.firstSelectedWordNode = selectedNode;
      }
    } else {
      this.firstSelectedWordNode = selectedNode;
    }

    if (this.lastSelectedWordNode) {
      const lastWordIndex = parseInt(this.lastSelectedWordNode.getAttribute(DATA_ATTRIBUTES.INDEX) ?? "0", 10);
      if (selectedWordIndex > lastWordIndex) {
        this.lastSelectedWordNode = selectedNode;
      }
    } else {
      this.lastSelectedWordNode = selectedNode;
    }

    const words = document.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`);
    const firstWordIndex = parseInt(this.firstSelectedWordNode.getAttribute(DATA_ATTRIBUTES.INDEX) ?? "0", 10);
    const lastWordIndex = parseInt(this.lastSelectedWordNode.getAttribute(DATA_ATTRIBUTES.INDEX) ?? "0", 10);

    words.forEach((word) => {
      if (!(word instanceof HTMLElement)) return;
      const wordIndex = parseInt(word.getAttribute(DATA_ATTRIBUTES.INDEX) ?? "0", 10);

      if (wordIndex >= firstWordIndex && wordIndex <= lastWordIndex) {
        this.selectedWordsNodes.add(word);
        word.classList.add(TOOLTIP_SELECTED_WORD_CLASS);
      }
    });
  };

  public clearSelectedWords = () => {
    this.firstSelectedWordNode = null;
    this.lastSelectedWordNode = null;
    this.selectedWordsNodes.forEach((word) => word.classList.remove(TOOLTIP_SELECTED_WORD_CLASS));
    this.selectedWordsNodes.clear();
  };

  public handleWordMouseEnter = (event: MouseEvent) => {
    const target = event.target as AbortableElement;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
      if (!this.selectedWordsNodes.has(target)) {
        this.updateSelectedWords(target);
      }

      this.showTooltip(target);
    }
  };

  public handleWordMouseLeave = (event: MouseEvent) => {
    const target = event.target as AbortableElement;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
      // Cancel the request if it's still pending
      if (target.abortController) {
        target.abortController.abort();
        delete target.abortController;
      }

      if (!state.isSelecting) {
        this.clearSelectedWords();
      }

      this.deleteActiveTooltip();
    }
  };

  public handleWordClick = () => this.saveTranslation();

  private isSameSavedTranslation = (translationData1: TranslationData, translationData2: TranslationData) => {
    return translationData1.sourceLanguageCode === translationData2.sourceLanguageCode &&
      translationData1.translatedText === translationData2.translatedText &&
      translationData1.originalText === translationData2.originalText &&
      translationData1.targetLanguageCode === translationData2.targetLanguageCode;
  };

  private saveTranslation = async () => {
    const currentData = this.translationCore.currentTranslationData;
    if (!currentData) return;

    const savedTranslations = await this.storageService.get<TranslationData[]>("savedTranslations", "local");
    const savedTranslationsArray = savedTranslations || [];

    const newSavedTranslation: TranslationData  = {
      id: crypto.randomUUID(),
      originalText: currentData.originalText,
      sourceLanguageCode: currentData.sourceLanguageCode,
      targetLanguageCode: currentData.targetLanguageCode,
      translatedText: currentData.translatedText,
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
}
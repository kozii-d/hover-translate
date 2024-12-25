import rgba from "color-rgba";
import alpha from "color-alpha";

import {
  TOOLTIP_CLASS,
  CAPTION_WINDOW,
  TOOLTIP_WORD_CLASS,
  CAPTION_SEGMENT,
  DATA_ATTRIBUTES,
  TOOLTIP_SELECTED_WORD_CLASS,
  TOOLTIP_SETTINGS,
} from "../consts/consts.js";
import { isCaptionWindowInUpperHalf } from "../utils/domUtils.js";

export class TooltipManager {
  constructor(state, translationCore, tokenManager, storageManager) {
    this.state = state;
    this.translationCore = translationCore;
    this.tokenManager = tokenManager;
    this.storageManager = storageManager;
    this.selectedWordsNodes = new Set();
    this.firstSelectedWordNode = null;
    this.lastSelectedWordNode = null;
  }

  deleteActiveTooltip() {
    document.querySelectorAll(`.${TOOLTIP_CLASS}`).forEach((tooltip) => tooltip.remove());
  }

  async showTooltip(targetNode) {
    // If the user is not logged in, open the popup
    const idTokenData = await this.tokenManager.getIdTokenFromStorage();
    if (!idTokenData) {
      this.tokenManager.sendMessage("openPopup");
      return;
    }

    const sortedWordNodes = Array.from(this.selectedWordsNodes).sort((a, b) => {
      return parseInt(a.getAttribute(DATA_ATTRIBUTES.INDEX), 10) - parseInt(b.getAttribute(DATA_ATTRIBUTES.INDEX), 10);
    });
    const words = sortedWordNodes.map((wordNode) => wordNode.textContent.trim());
    const textToTranslate = words.join(" ");

    // Create a new AbortController for this element
    const abortController = new AbortController();
    targetNode.abortController = abortController;

    const translatedData = await this.translationCore.translateText(textToTranslate, abortController.signal);

    // Delete link to abortController after request is done
    delete targetNode.abortController;

    const subtitlesContainer = document.querySelector(`.${CAPTION_WINDOW}`);

    if (!subtitlesContainer || !translatedData.translatedText) {
      return;
    }

    this.deleteActiveTooltip();

    if (!subtitlesContainer.contains(targetNode)) {
      return;
    }

    const tooltip = document.createElement("div");
    tooltip.className = TOOLTIP_CLASS;
    tooltip.textContent = translatedData.translatedText;

    tooltip.style.visibility = "hidden";

    document.body.appendChild(tooltip);

    this.styleTooltip(tooltip);
    this.positionTooltip(this.firstSelectedWordNode, tooltip, subtitlesContainer);
  }

  styleTooltip(tooltip) {
    const captionSegment = document.querySelector(`.${CAPTION_SEGMENT}`);
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
    } = this.state.tooltipTheme;

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
    const [, , , ytAlpha] = rgba(youtubeSubtitleContainerStyles.color);
    tooltip.style.color = fontOpacity === "auto" ? alpha(newFontColor, ytAlpha) : alpha(newFontColor, TOOLTIP_SETTINGS.fontOpacity[fontOpacity]);

    if (fontSize === "auto") {
      tooltip.style.fontSize = youtubeSubtitleContainerStyles.fontSize;
    } else {
      tooltip.style.fontSize = TOOLTIP_SETTINGS.fontSize[fontSize];
    }

    const newBackgroundColor = backgroundColor === "auto" ? youtubeSubtitleContainerStyles.backgroundColor : TOOLTIP_SETTINGS.backgroundColor[backgroundColor];
    const [, , , ytBackgroundAlpha] = rgba(youtubeSubtitleContainerStyles.backgroundColor);
    tooltip.style.background = youtubeSubtitleContainerStyles.background;
    tooltip.style.backgroundColor = backgroundOpacity === "auto" ? alpha(newBackgroundColor, ytBackgroundAlpha) : alpha(newBackgroundColor, TOOLTIP_SETTINGS.backgroundOpacity[backgroundOpacity]);

    if (characterEdgeStyle === "auto") {
      tooltip.style.textShadow = youtubeSubtitleContainerStyles.textShadow;
    } else {
      tooltip.style.textShadow = TOOLTIP_SETTINGS.characterEdgeStyle[characterEdgeStyle];
    }
  }

  positionTooltip(anchorWordNode, tooltip, subtitlesContainer) {
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

  updateSelectedWords = (selectedNode) => {
    const selectedWordIndex = parseInt(selectedNode.getAttribute(DATA_ATTRIBUTES.INDEX), 10);

    if (this.firstSelectedWordNode) {
      const firstWordIndex = parseInt(this.firstSelectedWordNode.getAttribute(DATA_ATTRIBUTES.INDEX), 10);
      if (selectedWordIndex < firstWordIndex) {
        this.firstSelectedWordNode = selectedNode;
      }
    } else {
      this.firstSelectedWordNode = selectedNode;
    }

    if (this.lastSelectedWordNode) {
      const lastWordIndex = parseInt(this.lastSelectedWordNode.getAttribute(DATA_ATTRIBUTES.INDEX), 10);
      if (selectedWordIndex > lastWordIndex) {
        this.lastSelectedWordNode = selectedNode;
      }
    } else {
      this.lastSelectedWordNode = selectedNode;
    }

    const words = document.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`);

    words.forEach((word) => {
      const wordIndex = parseInt(word.getAttribute(DATA_ATTRIBUTES.INDEX), 10);
      const firstWordIndex = parseInt(this.firstSelectedWordNode.getAttribute(DATA_ATTRIBUTES.INDEX), 10);
      const lastWordIndex = parseInt(this.lastSelectedWordNode.getAttribute(DATA_ATTRIBUTES.INDEX), 10);

      if (wordIndex >= firstWordIndex && wordIndex <= lastWordIndex) {
        this.selectedWordsNodes.add(word);
        word.classList.add(TOOLTIP_SELECTED_WORD_CLASS);
      }
    });
  };

  clearSelectedWords = () => {
    this.firstSelectedWordNode = null;
    this.lastSelectedWordNode = null;
    this.selectedWordsNodes.forEach((word) => word.classList.remove(TOOLTIP_SELECTED_WORD_CLASS));
    this.selectedWordsNodes.clear();
  };

  handleWordMouseEnter = (event) => {
    const target = event.target;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
      if (!this.selectedWordsNodes.has(target)) {
        this.updateSelectedWords(target);
      }

      this.showTooltip(target);
    }
  };

  handleWordMouseLeave = (event) => {
    const target = event.target;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
      // Cancel the request if it's still pending
      if (target.abortController) {
        target.abortController.abort();
        delete target.abortController;
      }

      if (!this.state.isSelecting) {
        this.clearSelectedWords();
      }

      this.deleteActiveTooltip();
    }
  };

  isSameSavedTranslation = (translationData1, translationData2) => {
    return translationData1.detectedLanguageCode === translationData2.detectedLanguageCode &&
      translationData1.translatedText === translationData2.translatedText &&
      translationData1.originalText === translationData2.originalText &&
      translationData1.targetLanguage === translationData2.targetLanguage;
  };

  saveTranslation = async (attempt = 1) => {
    const MAX_ATTEMPTS = 3;
    if (attempt > MAX_ATTEMPTS) {
      throw new Error(`Failed to save translation after ${MAX_ATTEMPTS} attempts.`);
    }

    if (!this.translationCore.currentTranslationData) {
      return;
    }

    const idTokenData = await this.tokenManager.getIdTokenFromStorage();

    if (!idTokenData || !idTokenData?.idToken || !idTokenData?.idTokenPayload) {
      this.tokenManager.sendMessage("openPopup");
      return;
    }

    if (this.tokenManager.checkIsTokenExpired(idTokenData.idTokenPayload.exp)) {
      await this.tokenManager.sendMessage("restoreIdToken");
      return this.saveTranslation(attempt + 1);
    }

    this.storageManager.get("savedTranslations", "local").then((savedTranslations) => {
      const savedTranslationsArray = savedTranslations || [];

      const newSavedTranslation = {
        id: crypto.randomUUID(),
        ...this.translationCore.currentTranslationData,
        timestamp: Date.now(),
      };

      // Remove the current translation from the saved translations array to avoid duplicates
      const filteredTranslations = savedTranslationsArray.filter((translation) => {
        return !this.isSameSavedTranslation(translation, newSavedTranslation);
      });

      filteredTranslations.unshift(newSavedTranslation);
      this.storageManager.set("savedTranslations", filteredTranslations, "local");
    });
  };

  handleWordClick = () => this.saveTranslation();
}
import {
  TOOLTIP_CLASS,
  TOOLTIP_ACTIVE,
  CAPTION_WINDOW,
  TOOLTIP_WORD_CLASS,
  CAPTION_SEGMENT,
} from "../utils/constants.js";
import { isCaptionWindowInUpperHalf } from "../utils/domUtils.js";

export class TooltipManager {
  constructor(state, translationCore) {
    this.state = state;
    this.translationCore = translationCore;
  }

  deleteActiveTooltip() {
    document.querySelectorAll(`.${TOOLTIP_CLASS}`).forEach((tooltip) => tooltip.remove());
  }

  async showTooltip(wordElement) {
    wordElement.setAttribute("data-tooltip", TOOLTIP_ACTIVE);

    const word = wordElement.textContent.trim();

    // Abort previous request if it exists
    if (wordElement.abortController) {
      wordElement.abortController.abort();
    }

    // Create a new AbortController for this element
    const abortController = new AbortController();
    wordElement.abortController = abortController;

    const translatedText = await this.translationCore.translateText(word, abortController.signal);

    // Delete link to abortController after request is done
    delete wordElement.abortController;

    const subtitlesContainer = document.querySelector(`.${CAPTION_WINDOW}`);

    if (!subtitlesContainer || !translatedText) {
      return;
    }

    this.deleteActiveTooltip();

    if (wordElement.getAttribute("data-tooltip") !== TOOLTIP_ACTIVE || !subtitlesContainer.contains(wordElement)) {
      return;
    }

    const tooltip = document.createElement("div");
    tooltip.className = TOOLTIP_CLASS;
    tooltip.textContent = translatedText;

    tooltip.style.visibility = "hidden";

    document.body.appendChild(tooltip);

    this.styleTooltip(tooltip);
    this.positionTooltip(wordElement, tooltip, subtitlesContainer);
  }

  styleTooltip(tooltip) {
    const captionSegment = document.querySelector(`.${CAPTION_SEGMENT}`);
    const youtubeSubtitleContainerStyles = window.getComputedStyle(captionSegment);

    tooltip.style.background = youtubeSubtitleContainerStyles.background;
    tooltip.style.color = youtubeSubtitleContainerStyles.color;
    tooltip.style.font = youtubeSubtitleContainerStyles.font;
    tooltip.style.textShadow = youtubeSubtitleContainerStyles.textShadow;
  }

  positionTooltip(wordElement, tooltip, subtitlesContainer) {
    const rectWord = wordElement.getBoundingClientRect();
    const tooltipHeight = tooltip.offsetHeight;
    let topPosition;

    const rectSubtitlesContainer = subtitlesContainer.getBoundingClientRect();

    if (isCaptionWindowInUpperHalf()) {
      topPosition = rectSubtitlesContainer.bottom + 5 + window.scrollY;
    } else {
      topPosition = rectSubtitlesContainer.top - tooltipHeight - 5 + window.scrollY;
    }

    tooltip.style.top = `${topPosition}px`;
    tooltip.style.left = `${rectWord.left + window.scrollX}px`;
    tooltip.style.visibility = "visible";
  }

  handleWordMouseEnter = (event) => {
    const target = event.target;
    if (target.classList.contains(TOOLTIP_WORD_CLASS)) {
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

      target.removeAttribute("data-tooltip");
      this.deleteActiveTooltip();
    }
  };

  handleWordClick = (event) => {
    if (event.target.classList.contains(TOOLTIP_WORD_CLASS)) {
      navigator.clipboard.writeText(event.target.textContent.trim());
    }
  };
}
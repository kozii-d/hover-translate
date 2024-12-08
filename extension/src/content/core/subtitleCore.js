import { TOOLTIP_WORD_CLASS, CAPTION_SEGMENT, CAPTION_WINDOW, DATA_ATTRIBUTES } from "../utils/constants.js";

export class SubtitleCore {
  constructor(tooltipManager) {
    this.tooltipManager = tooltipManager;
  }
  
  setWordsIndexes = () => {
    const allWords = document.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`);
    allWords.forEach((word, index) => {
      word.setAttribute(DATA_ATTRIBUTES.INDEX, String(index));
    });
  };

  splitCaptionIntoSpans(captionSegment) {
    const text = captionSegment.textContent.trim();
    const words = text.split(/\s+/);
    const fragment = document.createDocumentFragment();

    words.forEach((word) => {
      const wordSpan = document.createElement("span");
      wordSpan.classList.add(TOOLTIP_WORD_CLASS);
      wordSpan.textContent = word + " ";
      wordSpan.addEventListener("mouseenter", this.tooltipManager.handleWordMouseEnter);
      wordSpan.addEventListener("mouseleave", this.tooltipManager.handleWordMouseLeave);
      wordSpan.addEventListener("click", this.tooltipManager.handleWordClick);
      fragment.appendChild(wordSpan);
    });

    captionSegment.textContent = "";
    captionSegment.appendChild(fragment);
  }

  updateCaptionWindowSize() {
    const segments = document.querySelectorAll(`.${CAPTION_SEGMENT}`);
    let maxWidth = 0;

    segments.forEach((segment) => {
      const rect = segment.getBoundingClientRect();
      maxWidth = Math.max(maxWidth, rect.width);
    });

    const captionWindow = document.querySelector(`.${CAPTION_WINDOW}`);
    if (captionWindow) {
      captionWindow.style.width = `${maxWidth}px`;
    }
  }
}
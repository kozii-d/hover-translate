import { TOOLTIP_WORD_CLASS, CAPTION_SEGMENT, CAPTION_WINDOW, DATA_ATTRIBUTES } from "../consts/consts.ts";
import { TooltipService } from "../services/tooltipService.ts";

export class SubtitleCore {
  constructor(
    private readonly tooltipService: TooltipService
  ) {}
  
  public setWordsIndexes = () => {
    const allWords = document.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`);
    allWords.forEach((word, index) => {
      if (word instanceof HTMLElement) {
        word.setAttribute(DATA_ATTRIBUTES.INDEX, String(index));
      }
    });
  };

  public splitCaptionIntoSpans(captionSegment: HTMLElement) {
    const text = captionSegment.textContent?.trim() ?? "";
    const words = text.split(/\s+/);
    const fragment = document.createDocumentFragment();

    words.forEach((word) => {
      const wordSpan = document.createElement("span");
      wordSpan.classList.add(TOOLTIP_WORD_CLASS);
      wordSpan.textContent = word + " ";
      wordSpan.addEventListener("mouseenter", this.tooltipService.handleWordMouseEnter);
      wordSpan.addEventListener("mouseleave", this.tooltipService.handleWordMouseLeave);
      wordSpan.addEventListener("click", this.tooltipService.handleWordClick);
      fragment.appendChild(wordSpan);
    });

    captionSegment.textContent = "";
    captionSegment.appendChild(fragment);
  }

  public updateCaptionWindowSize(): void {
    const segments = document.querySelectorAll(`.${CAPTION_SEGMENT}`);
    let maxWidth = 0;

    segments.forEach((segment) => {
      if (segment instanceof HTMLElement) {
        const rect = segment.getBoundingClientRect();
        maxWidth = Math.max(maxWidth, rect.width);
      }
    });

    const captionWindow = document.querySelector(`.${CAPTION_WINDOW}`);
    if (captionWindow instanceof HTMLElement) {
      captionWindow.style.width = `${maxWidth}px`;
    }
  }
}
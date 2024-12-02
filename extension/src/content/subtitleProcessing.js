import { TOOLTIP_WORD_CLASS, CAPTION_SEGMENT, CAPTION_WINDOW } from "./constants.js";
import { handleWordMouseEnter, handleWordMouseLeave, handleWordClick } from "./tooltip.js";

export function splitCaptionIntoSpans(captionSegment) {
  const text = captionSegment.textContent.trim();
  const words = text.split(/\s+/);
  const fragment = document.createDocumentFragment();

  words.forEach((word) => {
    const wordSpan = document.createElement("span");
    wordSpan.classList.add(TOOLTIP_WORD_CLASS);
    wordSpan.textContent = word + " ";
    wordSpan.addEventListener("mouseenter", handleWordMouseEnter);
    wordSpan.addEventListener("mouseleave", handleWordMouseLeave);
    wordSpan.addEventListener("click", handleWordClick);
    fragment.appendChild(wordSpan);
  });

  // Delegate events to the parent element
  // captionSegment.addEventListener("mouseover", handleWordMouseEnter);
  // captionSegment.addEventListener("mouseout", handleWordMouseLeave);
  // captionSegment.addEventListener("click", handleWordClick);

  captionSegment.textContent = "";
  captionSegment.appendChild(fragment);
}

export function updateCaptionWindowSize() {
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
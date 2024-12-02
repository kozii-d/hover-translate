import { CAPTION_WINDOW_CONTAINER, CAPTION_WINDOW, CAPTION_SEGMENT } from "./constants.js";
import { splitCaptionIntoSpans, updateCaptionWindowSize } from "./subtitleProcessing.js";
import { handleVideoPause, handleVideoPlay } from "./videoControl.js";
import { deleteActiveTooltip } from "./tooltip.js";

export function observeMutations() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.querySelectorAll) {
          node.querySelectorAll(`.${CAPTION_SEGMENT}`).forEach(splitCaptionIntoSpans);
          updateCaptionWindowSize();
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const captionSegment = node.parentElement;
          if (captionSegment && captionSegment.classList.contains(CAPTION_SEGMENT)) {
            splitCaptionIntoSpans(captionSegment);
          }
        }

        if (node.classList && node.classList.contains(CAPTION_WINDOW)) {
          node.addEventListener("mouseenter", handleVideoPause);
          node.addEventListener("mouseleave", handleVideoPlay);
        }
      });

      mutation.removedNodes.forEach((node) => {
        if (node.classList && node.classList.contains(CAPTION_WINDOW)) {
          node.removeEventListener("mouseenter", handleVideoPause);
          node.removeEventListener("mouseleave", handleVideoPlay);
          deleteActiveTooltip();
        }
      });
    });
  });


  function startObserving() {
    const captionContainer = document.querySelector(`.${CAPTION_WINDOW_CONTAINER}`);
    if (captionContainer) {
      observer.observe(captionContainer, {
        childList: true,
        subtree: true,
      });
    } else {
      // Если контейнер не найден, повторяем попытку через некоторое время
      setTimeout(startObserving, 1000);
    }
  }

  startObserving();
}
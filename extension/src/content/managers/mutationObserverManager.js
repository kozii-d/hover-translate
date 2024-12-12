import {
  CAPTION_WINDOW_CONTAINER,
  CAPTION_SEGMENT,
  CAPTION_WINDOW,
  TOOLTIP_WORD_CLASS
} from "../consts/consts.js";

export class MutationObserverManager {
  constructor(subtitleCore, videoController, tooltipManager) {
    this.subtitleCore = subtitleCore;
    this.videoController = videoController;
    this.tooltipManager = tooltipManager;
  }

  observeMutations = () => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {

        // If a new word is added to the caption window, set the word indexes and clear the selected words.
        // Clearing is necessary for auto-generated captions
        if (Array.from(mutation.addedNodes).some((node) => node.classList && node.classList.contains(TOOLTIP_WORD_CLASS))) {
          this.tooltipManager.clearSelectedWords();
          this.tooltipManager.deleteActiveTooltip();
          this.subtitleCore.setWordsIndexes();
        }

        mutation.addedNodes.forEach((node) => {
          if (node.querySelectorAll) {
            node.querySelectorAll(`.${CAPTION_SEGMENT}`).forEach((segment) => {
              this.subtitleCore.splitCaptionIntoSpans(segment);
            });
            this.subtitleCore.updateCaptionWindowSize();
          }
          
          

          // for auto-generated captions
          if (node.nodeType === Node.TEXT_NODE) {
            const captionSegment = node.parentElement;
            if (captionSegment && captionSegment.classList.contains(CAPTION_SEGMENT)) {
              this.subtitleCore.splitCaptionIntoSpans(captionSegment);
            }
          }

          if (node.classList && node.classList.contains(CAPTION_WINDOW)) {
            node.addEventListener("mouseenter", this.videoController.handleVideoPause);
            node.addEventListener("mouseleave", this.videoController.handleVideoPlay);
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node.classList && node.classList.contains(CAPTION_WINDOW)) {
            node.removeEventListener("mouseenter", this.videoController.handleVideoPause);
            node.removeEventListener("mouseleave", this.videoController.handleVideoPlay);
            this.tooltipManager.deleteActiveTooltip();
            this.tooltipManager.clearSelectedWords();
          }
        });
      });
    });

    const startObserving = () => {
      const captionContainer = document.querySelector(`.${CAPTION_WINDOW_CONTAINER}`);
      if (captionContainer) {
        observer.observe(captionContainer, {
          childList: true,
          subtree: true,
        });
      } else {
        setTimeout(startObserving, 1000);
      }
    };

    startObserving();
  };
}
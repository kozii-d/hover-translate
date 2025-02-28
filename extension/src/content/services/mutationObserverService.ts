import {
  CAPTION_WINDOW_CONTAINER,
  CAPTION_SEGMENT,
  CAPTION_WINDOW,
  TOOLTIP_WORD_CLASS,
} from "../consts/consts";
import { SubtitleCore } from "../core/subtitleCore";
import { VideoController } from "../core/videoController";
import { TooltipService } from "./tooltipService.ts";

export class MutationObserverService {
  private observer: MutationObserver;
  private urlObserver?: MutationObserver;

  constructor(
    private readonly subtitleCore: SubtitleCore,
    private readonly videoController: VideoController,
    private readonly tooltipService: TooltipService
  ) {
    this.observer = new MutationObserver(this.handleMutations);

    this.startObserving();

    this.initVisibilityListener();

    this.initUrlObserver();
  }

  /**
   * Main callback called when DOM changes.
   */
  private handleMutations = (mutations: MutationRecord[]): void => {
    mutations.forEach((mutation) => {
      // 1. If new words are added to the captions, update the indexes and clear the selected words.
      this.checkForNewWords(mutation);

      // 2. Handle all added nodes.
      mutation.addedNodes.forEach((node) => {
        this.handleAddedNode(node);
      });

      // 3. Handle all removed nodes.
      mutation.removedNodes.forEach((node) => {
        this.handleRemovedNode(node);
      });
    });
  };

  /**
   * Checks if there is a new subtitle word (TOOLTIP_WORD_CLASS) in the added nodes.
   * If yes, clears the selected words and updates the indexes.
   * Clearing is necessary for auto-generated captions.
   */
  private checkForNewWords(mutation: MutationRecord): void {
    const nodesArray = Array.from(mutation.addedNodes);
    const hasNewWord = nodesArray.some(
      (node) =>
        node instanceof Element &&
        node.classList.contains(TOOLTIP_WORD_CLASS)
    );

    if (hasNewWord) {
      this.tooltipService.clearSelectedWords();
      // this.tooltipService.deleteActiveTooltip();
      this.subtitleCore.setWordsIndexes();
    }
  }

  /**
   * Handle added node:
   * - split captions into words,
   * - update caption window size,
   * - add events to the caption window (mouseenter/mouseleave).
   */
  private handleAddedNode(node: Node): void {
    // If it's an Element, check for caption segments inside
    if (node instanceof Element) {
      const segments = node.querySelectorAll(`.${CAPTION_SEGMENT}`);
      segments.forEach((segment) => {
        if (segment instanceof HTMLElement) {
          this.subtitleCore.splitCaptionIntoSpans(segment);
        }
      });
      this.subtitleCore.updateCaptionWindowSize();

      // If it's a caption window, add events for pause/play
      if (node.classList.contains(CAPTION_WINDOW)) {
        node.addEventListener("mouseenter", this.videoController.handleVideoPause);
        node.addEventListener("mouseleave", this.videoController.handleVideoPlay);
      }
    }

    // For auto-generated captions (TEXT_NODE inside CaptionSegment)
    if (node.nodeType === Node.TEXT_NODE) {
      const captionSegment = node.parentElement;
      if (captionSegment && captionSegment.classList.contains(CAPTION_SEGMENT)) {
        this.subtitleCore.splitCaptionIntoSpans(captionSegment);
      }
    }
  }

  /**
   * Handle removed node:
   * - remove events,
   * - delete tooltips and clear selected words.
   */
  private handleRemovedNode(node: Node): void {
    // If it's a caption window, remove events and delete tooltips
    if (node instanceof Element && node.classList.contains(CAPTION_WINDOW)) {
      node.removeEventListener("mouseenter", this.videoController.handleVideoPause);
      node.removeEventListener("mouseleave", this.videoController.handleVideoPlay);
      this.tooltipService.deleteActiveTooltip();
      this.tooltipService.clearSelectedWords();
    }
  }

  /**
   * Starts observing the caption container.
   * If the container is not found, retries in 1 second.
   */
  private startObserving(retryCount = 5): void {
    this.stopObserving();

    const captionContainer = document.querySelector(`.${CAPTION_WINDOW_CONTAINER}`);
    if (captionContainer) {
      this.observer.observe(captionContainer, {
        childList: true,
        subtree: true,
      });
      // eslint-disable-next-line no-console
      console.log("[MutationObserverService] Observing started");
    } else if (retryCount > 0) {
      // eslint-disable-next-line no-console
      console.log("[MutationObserverService] No container, retrying...");
      setTimeout(() => this.startObserving(retryCount - 1), 1000);
    }
  }

  private stopObserving(): void {
    this.observer.disconnect();
  }

  private initVisibilityListener(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // eslint-disable-next-line no-console
        console.log("[MutationObserverService] Tab is visible, reinit observer");
        this.startObserving();
      }
    });
  }

  /**
   * A «hacky» way to watch for URL changes by observing <title> changes.
   */
  private initUrlObserver(): void {
    const titleElement = document.querySelector("title");
    if (!titleElement) {
      // eslint-disable-next-line no-console
      console.log("[MutationObserverService] <title> not found, no URL observer");
      return;
    }

    let oldHref = document.location.href;

    this.urlObserver = new MutationObserver(() => {
      const newHref = document.location.href;
      if (oldHref !== newHref) {
        oldHref = newHref;
        // eslint-disable-next-line no-console
        console.log("[MutationObserverService] URL changed, reinit observer");
        this.startObserving();
      }
    });

    // Observe childList of titleElement, because <title> text changes
    // when the «route» is changed or a new video is loaded
    this.urlObserver.observe(titleElement, { childList: true });
  }
}
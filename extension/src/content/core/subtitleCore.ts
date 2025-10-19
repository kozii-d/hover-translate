import { TOOLTIP_WORD_CLASS, CAPTION_SEGMENT, CAPTION_WINDOW, DATA_ATTRIBUTES } from "../consts/consts.ts";
import { TooltipService } from "../services/tooltipService.ts";
import { state } from "../state/stateManager.ts";

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
      wordSpan.addEventListener("pointerenter", this.tooltipService.handleWordMouseEnter);
      wordSpan.addEventListener("pointerleave", this.tooltipService.handleWordMouseLeave);
      let isDrag = false;
      let startX = 0;
      let startY = 0;
      const DRAG_THRESHOLD = 5;

      wordSpan.addEventListener("pointerdown", (e: PointerEvent) => {
        // Save the initial coordinates and reset the "drag" flag
        isDrag = false;
        startX = e.clientX;
        startY = e.clientY;
      });

      wordSpan.addEventListener("pointermove", (e: PointerEvent) => {
        // If the cursor has moved further than the threshold, set the "drag" flag
        const diffX = Math.abs(e.clientX - startX);
        const diffY = Math.abs(e.clientY - startY);

        if (diffX > DRAG_THRESHOLD || diffY > DRAG_THRESHOLD) {
          isDrag = true;
        }
      });

      wordSpan.addEventListener("pointerup", () => {
        // If the user is dragging the subtitles, don't save the translation or copy the text
        if (!isDrag) {
          switch (state.settings.leftClickAction) {
          case "save-to-dictionary":
            this.tooltipService.saveTranslationToDictionary();
            break;
          case "copy-original":
            this.tooltipService.saveOriginalTextToClipboard();
            break;
          case "copy-translation":
            this.tooltipService.saveTranslationToClipboard();
            break;
          case "nothing":
            break;
          default:
            break;
          }
        }
      });

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

  public handlePointerLeaveOnCaptionWindow = ((event: Event) => {
    const pointerEvent = event as PointerEvent;
    if (state.settings.alwaysMultipleSelection && !pointerEvent.shiftKey) {
      this.tooltipService.clearSelectedWords();
    }
  }) as EventListener;
}
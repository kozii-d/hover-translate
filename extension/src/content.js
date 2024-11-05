// consts
const TRANSLATION_URL = "http://localhost:4000/translate"; // fixme: to env
const TOOLTIP_CLASS = "custom-tooltip";
const TOOLTIP_WORD_CLASS = "custom-tooltip-word";
const TOOLTIP_ACTIVE = "active";
const SPAN_TAG = "SPAN";

// youtube classes
const CAPTION_WINDOW_CONTAINER = "ytp-caption-window-container";
const CAPTION_WINDOW = "caption-window";
const CAPTION_SEGMENT = "ytp-caption-segment";


// youtube elements
const playButton = document.querySelector(".ytp-play-button");
const video = document.querySelector("video");

// globals
let currentAbortController = null;
let wasPausedByUser = false;

let sourceLanguageCode = "auto";
let targetLanguageCode = "en-US";

function initializeLanguages() {
  chrome.storage.sync.get(["sourceLanguageCode", "targetLanguageCode"], (result) => {
    sourceLanguageCode = result.sourceLanguageCode || "auto";
    targetLanguageCode = result.targetLanguageCode || "en-US";
  });
}

function checkStorageChanges() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.sourceLanguageCode) {
        sourceLanguageCode = changes.sourceLanguageCode.newValue;
      }
      if (changes.targetLanguageCode) {
        targetLanguageCode = changes.targetLanguageCode.newValue;
      }
    }
  });
}

/**
 * Translates text to the specified target language.
 * @param {string} text - The text to translate.
 * @returns {Promise<string>} - The translated text.
 */
async function translateText(text, ) {
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  try {
    const response = await fetch(TRANSLATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        sourceLocale: sourceLanguageCode,
        targetLocale: targetLanguageCode,
      }),
      signal
    });

    const { text: translatedText } = await response.json();

    return translatedText;
  } catch (e) {
    if (e?.name === "AbortError") {
      // eslint-disable-next-line no-console
      console.log("Fetch aborted");
    } else {
      throw new Error(`Translation error: ${e}`);
    }
    return "";
  } finally {
    deleteActiveTooltip();
    currentAbortController = null;
  }
}

function deleteActiveTooltip() {
  document.querySelectorAll(`.${TOOLTIP_CLASS}`).forEach(tooltip => tooltip.remove());
}

function isCaptionWindowInUpperHalf() {
  const containerRect = document.querySelector(`.${CAPTION_WINDOW_CONTAINER}`).getBoundingClientRect();
  const captionWindowRect = document.querySelector(`.${CAPTION_WINDOW}`).getBoundingClientRect();

  const containerCenterY = containerRect.top + (containerRect.height / 2);

  // true if .caption-window is in upper half
  return captionWindowRect.top + (captionWindowRect.height / 2) < containerCenterY;
}

async function showTooltip(wordElement) {
  const word = wordElement.textContent.trim();
  const translatedText = await translateText(word);

  const subtitlesContainer = document.querySelector(`.${CAPTION_WINDOW}`);

  if (!subtitlesContainer || !translatedText) {
    return;
  }

  const tooltip = document.createElement("div");
  tooltip.className = TOOLTIP_CLASS;
  tooltip.textContent = translatedText;

  tooltip.style.visibility = "hidden";

  wordElement.setAttribute("data-tooltip", TOOLTIP_ACTIVE);

  document.body.appendChild(tooltip);

  positionTooltip(wordElement, tooltip, subtitlesContainer);
}

// position tooltip
function positionTooltip(wordElement, tooltip, subtitlesContainer) {
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

function isSpanElement(element) {
  return element.tagName === SPAN_TAG;
}

function handleWordMouseEnter(event) {
  if (isSpanElement(event.target)) {
    showTooltip(event.target);
  }
}

function handleWordMouseLeave(event) {
  if (isSpanElement(event.target)) {
    deleteActiveTooltip();
    if (document.body.contains(event.target) && event.target.getAttribute("data-tooltip") === TOOLTIP_ACTIVE) {
      event.target.removeAttribute("data-tooltip");
    }
    if (currentAbortController) {
      currentAbortController.abort();
    }
  }
}

function handleWordClick(event) {
  if (event.target.tagName === "SPAN") {
    navigator.clipboard.writeText(event.target.textContent.trim());
  }
}

function splitCaptionIntoSpans(captionSegment) {
  const text = captionSegment.textContent.trim();
  const words = text.split(/\s+/);

  captionSegment.textContent = "";
  words.forEach(word => {
    const wordSpan = document.createElement("span");

    wordSpan.classList.add(TOOLTIP_WORD_CLASS);

    wordSpan.textContent = word + " ";
    wordSpan.addEventListener("mouseenter", handleWordMouseEnter);
    wordSpan.addEventListener("mouseleave", handleWordMouseLeave);
    wordSpan.addEventListener("click", handleWordClick);
    captionSegment.appendChild(wordSpan);
  });
}

function stopVideoHandle() {
  wasPausedByUser = video.paused;
  if (!video.paused) {
    playButton.click();
  }
}

function playVideoHandle() {
  if (video.paused && !wasPausedByUser) {
    playButton.click();
  }

  // reset flag
  wasPausedByUser = false;
}

// for auto-generated captions
function updateCaptionWindowSize() {
  const segments = document.querySelectorAll(`.${CAPTION_SEGMENT}`);
  let maxWidth = 0;

  segments.forEach(segment => {
    const rect = segment.getBoundingClientRect();
    maxWidth = Math.max(maxWidth, rect.width);
  });

  const captionWindow = document.querySelector(`.${CAPTION_WINDOW}`);
  if (captionWindow) {
    captionWindow.style.width = `${maxWidth}px`;
  }
}

function observeMutations() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {

        if (node.querySelectorAll) {
          node.querySelectorAll(`.${CAPTION_SEGMENT}`).forEach(splitCaptionIntoSpans);
          updateCaptionWindowSize();
        }

        // for auto-generated captions
        if (node.nodeType === Node.TEXT_NODE) {
          const captionSegment = node.parentElement;
          if (captionSegment && captionSegment.classList.contains(CAPTION_SEGMENT)) {
            splitCaptionIntoSpans(captionSegment);
          }
        }


        if (node.classList && node.classList.contains(CAPTION_WINDOW)) {
          node.addEventListener("mouseenter", stopVideoHandle);
          node.addEventListener("mouseleave", playVideoHandle);
        }
      });
      mutation.removedNodes.forEach(node => {
        if (node.classList && node.classList.contains(CAPTION_WINDOW)) {
          node.removeEventListener("mouseenter", stopVideoHandle);
          node.removeEventListener("mouseleave", playVideoHandle);
          deleteActiveTooltip();
        }
      });
    });
  });

  // Start observing changes in DOM
  const captionContainer = document.querySelector(`.${CAPTION_WINDOW_CONTAINER}`);
  if (captionContainer) {
    observer.observe(captionContainer, {
      childList: true,
      subtree: true
    });
  }
}
// Start after DOM loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", observeMutations);
} else {
  observeMutations();
  initializeLanguages();
  checkStorageChanges();
}

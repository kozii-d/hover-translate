// todo: auto-stop video with auto-generated captions

// youtube elements
const playButton = document.querySelector(".ytp-play-button");
const video = document.querySelector("video");

// globals
let currentAbortController = null;
let wasPausedByUser = false;

async function translateWord(word, targetLanguage = "ru") {
  const url = "http://localhost:4000/translate";

  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: word,
        sourceLocale: "en",
        targetLocale: targetLanguage,
      }),
      signal
    });

    const { translations } = await response.json();

    return translations;
  } catch (e) {
    if (e?.name === "AbortError") {
      // eslint-disable-next-line no-console
      console.log("Fetch aborted");
    } else {
      console.error("Translation error:", e);
    }
    return [];
  } finally {
    deleteActiveTooltip();
    currentAbortController = null;
  }
}

function deleteActiveTooltip() {
  document.querySelectorAll(".custom-tooltip").forEach(tooltip => tooltip.remove());
}

function isCaptionWindowInUpperHalf() {
  const containerRect = document.querySelector(".ytp-caption-window-container").getBoundingClientRect();
  const captionWindowRect = document.querySelector(".caption-window").getBoundingClientRect();

  const containerCenterY = containerRect.top + (containerRect.height / 2);

  // true if .caption-window is in upper half
  return captionWindowRect.top + (captionWindowRect.height / 2) < containerCenterY;
}

async function showTooltip(wordElement) {
  const word = wordElement.textContent.trim();
  const translations = await translateWord(word);

  const subtitlesContainer = document.querySelector(".caption-window");

  if (!subtitlesContainer || !translations.length) {
    return;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "custom-tooltip";
  tooltip.textContent = translations.join(", ");

  tooltip.style.visibility = "hidden";

  wordElement.setAttribute("data-tooltip", "active");

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

function handleWordMouseEnter(event) {
  if (event.target.tagName === "SPAN") {
    showTooltip(event.target);
  }
}

function handleWordMouseLeave(event) {
  if (event.target.tagName === "SPAN") {
    deleteActiveTooltip();
    if (document.body.contains(event.target) && event.target.getAttribute("data-tooltip") === "active") {
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

    wordSpan.classList.add("custom-tooltip-word");

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

function observeMutations() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        node.querySelectorAll && node.querySelectorAll(".ytp-caption-segment").forEach(splitCaptionIntoSpans);

        // for auto-generated captions
        if (node.nodeType === Node.TEXT_NODE) {
          const captionSegment = node.parentElement;
          if (captionSegment && captionSegment.classList.contains("ytp-caption-segment")) {
            splitCaptionIntoSpans(captionSegment);
          }
        }


        if (node.classList && node.classList.contains("caption-window")) {
          node.addEventListener("mouseenter", stopVideoHandle);
          node.addEventListener("mouseleave", playVideoHandle);
        }
      });
      mutation.removedNodes.forEach(node => {
        if (node.classList && node.classList.contains("caption-window")) {
          node.removeEventListener("mouseenter", stopVideoHandle);
          node.removeEventListener("mouseleave", playVideoHandle);
          deleteActiveTooltip();
        }
      });
    });
  });

  // Start observing changes in DOM
  const captionContainer = document.querySelector(".ytp-caption-window-container");
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
}

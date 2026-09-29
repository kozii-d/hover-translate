// The YouTube player as far as the extension is concerned, in the page's own
// world: the caption lines, which the test sets through `window.fixture`, and
// what the player itself does with the mouse — a click on the video toggles
// playback, the caption window can be dragged, the player's buttons
// answer clicks. `fixture.events` records what reached the player, so a test
// can tell a click the extension kept for a word from one YouTube got.
(() => {
  const container = document.querySelector(".ytp-caption-window-container");
  const video = document.querySelector("video");
  const events = [];
  let windowCount = 0;
  // How the caption window is dragged, see the handlers at the end.
  let dragMode = "drag and drop";

  // YouTube's inline style of a caption segment in the default caption theme.
  const SEGMENT_STYLE = "display: inline-block; white-space: pre-wrap; background: rgba(8, 8, 8, 0.75); "
    + "font-size: 22px; color: rgb(255, 255, 255); fill: rgb(255, 255, 255); "
    + "font-family: \"YouTube Noto\", Roboto, Arial, Helvetica, Verdana, \"PT Sans Caption\", sans-serif;";

  const element = (tag, className, style) => {
    const node = document.createElement(tag);
    node.className = className;
    if (style) node.setAttribute("style", style);
    return node;
  };

  const visualLine = (text) => {
    const line = element("span", "caption-visual-line", "display: block;");
    const segment = element("span", "ytp-caption-segment", SEGMENT_STYLE);
    segment.append(document.createTextNode(text));
    line.append(segment);
    return line;
  };

  // YouTube sizes the window to its longest line and centres it, unless the
  // viewer has dragged it somewhere.
  const fit = (captionWindow) => {
    if (captionWindow.dataset.dragged) return;
    captionWindow.style.width = "max-content";
    const width = captionWindow.offsetWidth;
    captionWindow.style.width = `${width}px`;
    captionWindow.style.marginLeft = `${-width / 2}px`;
  };

  // `lines`: one string per visual line. `position`: "bottom" (lifted over the
  // control bar on the watch page, as YouTube does while the bar shows) or
  // "top". `dir` and `lang` as YouTube sets them on a track (`dir="rtl"` for
  // Arabic). `style`: more inline style, to put the window somewhere else.
  const captionWindow = ({ lines, position = "bottom", dir = "ltr", lang = "en", style = "" }) => {
    const bottom = document.body.classList.contains("watch") ? "80px" : "2%";
    const place = position === "top" ? "top: 2%;" : `bottom: ${bottom};`;
    const node = element("div", `caption-window ytp-caption-window-${position}`,
      `touch-action: none; text-align: center; left: 50%; ${place} ${style}`);
    node.id = `caption-window-_${windowCount++}`;
    node.dir = dir;
    node.lang = lang;
    node.tabIndex = 0;
    node.draggable = dragMode === "drag and drop";

    const text = element("span", "captions-text", "overflow-wrap: normal; display: block;");
    text.append(...lines.map(visualLine));
    node.append(text);
    return node;
  };

  const lastSegment = () => Array.from(container.querySelectorAll(".ytp-caption-segment")).pop();
  const lastWindow = () => Array.from(container.querySelectorAll(".caption-window")).pop();

  window.fixture = {
    events,

    // A new caption: YouTube removes the window and adds a new one. Takes a
    // string (one line) or a list of windows (see `captionWindow`).
    captions(windows) {
      const list = typeof windows === "string" ? [{ lines: [windows] }] : windows;
      container.querySelectorAll(".caption-window").forEach((node) => node.remove());
      list.forEach((options) => {
        const node = captionWindow(options);
        container.append(node);
        if (!options.style) fit(node);
      });
    },

    // Auto-generated captions grow a word at a time: a text node appended to
    // the segment of the last line (e2e/youtube-dom/captured/auto.json).
    appendWord(word) {
      lastSegment().append(document.createTextNode(` ${word}`));
      fit(lastWindow());
    },

    // …and a new line once the last one is full.
    appendLine(word) {
      lastWindow().querySelector(".captions-text").append(visualLine(word));
      fit(lastWindow());
    },

    // The first line goes up and out. YouTube removes every line of the
    // window and adds the ones that stay again, as new nodes, a text node per
    // word (auto.json).
    rollUp() {
      const text = lastWindow().querySelector(".captions-text");
      const kept = Array.from(text.querySelectorAll(".caption-visual-line")).slice(1).map((line) => line.textContent.trim());
      text.querySelectorAll(".caption-visual-line").forEach((line) => line.remove());
      kept.forEach((lineText) => {
        const [first, ...rest] = lineText.split(/\s+/);
        const line = visualLine(first);
        rest.forEach((word) => line.firstChild.append(document.createTextNode(` ${word}`)));
        text.append(line);
      });
      fit(lastWindow());
    },

    // "drag and drop" (the default) or "mousemove": the two ways YouTube's
    // caption window has been seen to follow a drag. For the windows shown
    // from now on.
    dragOn(mode) {
      dragMode = mode;
    },
  };

  const toggle = () => (video.paused ? video.play() : video.pause());

  // A click on the picture toggles playback — on the watch page the player
  // itself, in the embed the background of the controls layer. Clicks on the
  // captions are the drag's.
  document.addEventListener("click", (event) => {
    const target = event.target;
    const button = target.closest("button, [role=slider]");
    if (button) {
      events.push(`button:${button.getAttribute("aria-label")}`);
      if (button.matches(".ytp-play-button, .player-control-play-pause-icon")) toggle();
      // The watch page puts the whole document in full screen, and the player fills it.
      if (button.matches(".ytp-fullscreen-button")) document.documentElement.requestFullscreen();
      return;
    }
    if (target.closest(".caption-window")) return;
    if (target.closest(".html5-video-player, .player-controls-background")) {
      events.push("toggle");
      toggle();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    document.body.classList.toggle("fullscreen", Boolean(document.fullscreenElement));
  });

  const moveWindow = (node, dx, dy, x, y) => {
    const box = container.getBoundingClientRect();
    node.dataset.dragged = "true";
    node.style.bottom = "";
    node.style.marginLeft = "0px";
    node.style.left = `${x - dx - box.left}px`;
    node.style.top = `${y - dy - box.top}px`;
  };

  // The caption window is dragged in one of two ways (`fixture.dragOn`).
  //
  // "drag and drop": the window is `draggable`, and YouTube does not cancel the
  // browser's drag — it marks the window `ytp-dragging` on `dragstart`. A few
  // pixels after the press the browser starts a drag of its own: the pointer
  // gets `pointercancel` and no `pointerup`, and the window follows
  // `dragover`. So it went on the live watch page in Playwright's Chromium
  // (2026-09-29).
  //
  // "mousemove": no drag of the browser's; the page's script moves the window
  // on `mousemove`. The browser has placed that move before the window
  // follows, so on every step the pointer leaves the window and, once the
  // window is under it again, comes back — a `pointerleave` and a
  // `pointerenter` a few milliseconds apart, and never a `pointermove` on the
  // word, as recorded on the live watch page in Brave over plain CDP
  // (2026-09-27). The window is not `draggable` here only
  // because Playwright would otherwise turn the moves into a drag and drop of
  // its own.
  let pressed = null;
  let drag = null;
  document.addEventListener("pointerdown", (event) => {
    const node = event.button === 0 ? event.target.closest(".caption-window") : null;
    const rect = node?.getBoundingClientRect();
    pressed = node && { node, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
  }, true);
  document.addEventListener("mousemove", (event) => {
    if (dragMode !== "mousemove" || !pressed) return;
    moveWindow(pressed.node, pressed.dx, pressed.dy, event.clientX, event.clientY);
  });
  document.addEventListener("mouseup", () => {
    if (dragMode === "mousemove") pressed = null;
  });
  document.addEventListener("dragstart", (event) => {
    if (!pressed) return;
    drag = pressed;
    drag.node.classList.add("ytp-dragging");
    event.dataTransfer.effectAllowed = "move";
  });
  document.addEventListener("dragover", (event) => {
    if (!drag) return;
    event.preventDefault();
    moveWindow(drag.node, drag.dx, drag.dy, event.clientX, event.clientY);
  });
  document.addEventListener("drop", (event) => event.preventDefault());
  document.addEventListener("dragend", () => {
    drag?.node.classList.remove("ytp-dragging");
    drag = null;
    pressed = null;
  });
})();

// Only an improvement: every text and link works without it.
(function () {
  liveSubtitleLine(document.querySelector(".demo"));
  playVideos();

  // The live subtitle line on the home page, as the extension behaves on YouTube:
  // - a word under the pointer is selected and its translation shown above the subtitles,
  //   from the left edge of the first selected word, kept 10 px inside the frame
  //   (tooltipService.ts: handleWordMouseEnter, positionTooltip);
  // - leaving a word removes the translation, and the selection too unless Shift is held; with
  //   Shift the selection grows from the first word to the farthest one the pointer reached
  //   (handleWordMouseLeave, updateSelectedWords);
  // - the video pauses while the pointer is on the subtitles and plays on when it leaves
  //   (videoController.ts).
  // Until the viewer's pointer comes, it shows "playa" selected under a drawn one, as the page
  // shows it without JavaScript. A tap selects (touch sends no hover, and lifting the finger
  // "leaves"); the Shift button holds Shift for a touch screen.
  function liveSubtitleLine(demo) {
    if (!demo) return;
    // Google Translate, es → en, for every run of words: "first-last". Asked as the extension asks
    // (google.ts), without the punctuation at the edges, which it trims (translationCore.ts).
    var TRANSLATIONS = {
      "0-0": "Tomorrow",
      "0-1": "Tomorrow we go",
      "0-2": "Tomorrow we will",
      "0-3": "Tomorrow we go to the",
      "0-4": "Tomorrow we go to the beach",
      "0-5": "Tomorrow we are going to the beach yes",
      "0-6": "Tomorrow we will go to the beach if it is",
      "0-7": "Tomorrow we will go to the beach if it's nice",
      "0-8": "Tomorrow we will go to the beach if the weather is good",
      "1-1": "come on",
      "1-2": "let's go",
      "1-3": "let's go to the",
      "1-4": "let's go to the beach",
      "1-5": "let's go to the beach yeah",
      "1-6": "let's go to the beach if it does",
      "1-7": "let's go to the beach if it's nice",
      "1-8": "let's go to the beach if the weather is good",
      "2-2": "to",
      "2-3": "to the",
      "2-4": "to the beach",
      "2-5": "to the beach yes",
      "2-6": "to the beach if it does",
      "2-7": "to the beach if the weather is good",
      "2-8": "to the beach if the weather is good",
      "3-3": "the",
      "3-4": "the beach",
      "3-5": "the beach yes",
      "3-6": "the beach does",
      "3-7": "the beach is good",
      "3-8": "the beach if the weather is good",
      "4-4": "beach",
      "4-5": "beach yes",
      "4-6": "beach if it does",
      "4-7": "beach if it's good",
      "4-8": "beach if the weather is good",
      "5-5": "Yeah",
      "5-6": "if it does",
      "5-7": "if it's good",
      "5-8": "if the weather is good",
      "6-6": "does",
      "6-7": "it's good",
      "6-8": "the weather is good",
      "7-7": "good",
      "7-8": "good time",
      "8-8": "time",
    };
    var RESTING_WORD = 4; // "playa"
    var MARGIN = 10;
    var GAP = 5;
    var NOTIFICATION_SIDE = 65;
    var frame = demo.querySelector(".frame");
    var captionWindow = frame.querySelector(".caption-window");
    var words = Array.prototype.slice.call(frame.querySelectorAll(".w"));
    var tip = frame.querySelector(".tip");
    var cursor = frame.querySelector(".cursor");
    var status = frame.querySelector(".status");
    var progress = frame.querySelector(".progress");
    var shiftButton = demo.querySelector(".hint .key");
    var notification = document.createElement("div");
    var resting = true;
    var first = null;
    var last = null;
    var keyboardShift = false;
    var playing = false;
    var position = 0.38;
    var lastTick = 0;

    // From now on the tooltip is placed by coordinates, as the extension places it
    frame.appendChild(tip);
    tip.style.bottom = "auto";
    notification.className = "notification";
    notification.textContent = "Translation saved";
    notification.hidden = true;
    frame.appendChild(notification);
    demo.querySelector(".hint").hidden = false;

    var shiftHeld = function (event) {
      return (
        keyboardShift ||
        shiftButton.getAttribute("aria-pressed") === "true" ||
        Boolean(event && event.shiftKey)
      );
    };

    function render() {
      words.forEach(function (word, i) {
        word.classList.toggle("sel", first !== null && i >= first && i <= last);
      });
    }

    function select(i) {
      if (first === null || i < first) first = i;
      if (last === null || i > last) last = i;
      render();
      showTip();
    }

    function clear() {
      first = null;
      last = null;
      render();
    }

    // positionTooltip: from the first selected word, moved left to end 10 px inside the frame.
    // Measured at its own width (max-content, up to the frame's less the margins): placed first,
    // it would wrap at the frame's edge instead of moving left, as it does not on YouTube, where
    // the tooltip lies in the page.
    function showTip() {
      tip.textContent = TRANSLATIONS[first + "-" + last];
      tip.hidden = false;
      var box = frame.getBoundingClientRect();
      tip.style.maxWidth = box.width - MARGIN * 2 + "px";
      tip.style.width = "max-content";
      var left = words[first].getBoundingClientRect().left - box.left;
      left = Math.max(
        MARGIN,
        Math.min(left, box.width - MARGIN - tip.offsetWidth),
      );
      tip.style.left = left + "px";
      tip.style.top =
        captionWindow.getBoundingClientRect().top -
        box.top -
        tip.offsetHeight -
        GAP +
        "px";
    }

    // showNotificationTooltip: "Translation saved" at the top left of the player, 65 px in from
    // the side and 40 px from the top, dressed like the tooltip, for 2 seconds
    function notifySaved() {
      clearTimeout(notification.timer);
      notification.hidden = false;
      notification.style.maxWidth =
        frame.getBoundingClientRect().width - NOTIFICATION_SIDE * 2 + "px";
      notification.timer = setTimeout(function () {
        notification.hidden = true;
      }, 2000);
    }

    function setPlaying(on) {
      var start = on && !playing; // one frame loop at a time
      playing = on;
      status.textContent = on ? "▶ Playing" : "❚❚ Paused while you read";
      if (start) requestAnimationFrame(tick);
    }

    function tick(time) {
      if (!playing) {
        lastTick = 0;
        return;
      }
      if (lastTick) position = (position + (time - lastTick) / 60000) % 1;
      lastTick = time;
      progress.style.width = position * 100 + "%";
      requestAnimationFrame(tick);
    }

    // As the page shows it before anyone points at it
    function rest() {
      clear();
      select(RESTING_WORD);
      cursor.style.display = "";
      setPlaying(false);
      resting = true;
    }

    // The viewer takes over from the drawn pointer: nothing selected yet
    function wake() {
      if (!resting) return;
      resting = false;
      cursor.style.display = "none";
      tip.hidden = true;
      clear();
    }

    function enterWord(i, event) {
      // A tap on another word: the finger "left" the last one without a leave we act on
      if (event.pointerType === "touch" && !shiftHeld(event)) clear();
      if (first === null || i < first || i > last) select(i);
      else showTip();
    }

    function leaveWord(event) {
      if (event.pointerType === "touch") return;
      tip.hidden = true;
      if (!shiftHeld(event)) clear();
    }

    words.forEach(function (word, i) {
      word.addEventListener("pointerenter", function (event) {
        enterWord(i, event);
      });
      word.addEventListener("pointerleave", leaveWord);
      word.addEventListener("focus", function () {
        wake();
        enterWord(i, {});
      });
      word.addEventListener("blur", function () {
        leaveWord({});
      });
      // A click saves the selection (leftClickAction "save-to-dictionary", the default); a tap
      // only selects here, as the extension is for a mouse
      word.addEventListener("click", function (event) {
        if (event.pointerType !== "touch" && first !== null) notifySaved();
      });
    });
    captionWindow.addEventListener("pointerenter", function () {
      setPlaying(false);
    });
    captionWindow.addEventListener("pointerleave", function (event) {
      if (event.pointerType === "touch") return;
      setPlaying(true);
      // The Shift button is the extension's "Always enable multiple selection": leaving the
      // subtitles drops the selection, unless the real Shift is held (handlePointerLeaveOnCaptionWindow)
      if (
        shiftButton.getAttribute("aria-pressed") === "true" &&
        !keyboardShift &&
        !event.shiftKey
      )
        clear();
    });
    // The viewer's pointer takes over from the drawn one (it comes in through the frame's edge, so
    // the subtitles' and the word's own events follow). A finger "comes in" with every tap.
    frame.addEventListener("pointerenter", function (event) {
      if (event.pointerType === "touch") return;
      resting = true;
      wake();
      setPlaying(true);
    });
    frame.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "touch") return;
      wake();
      // A tap beside the subtitles: nothing selected, the video plays
      if (!event.target.closest(".w")) {
        tip.hidden = true;
        clear();
        setPlaying(true);
      }
    });
    frame.addEventListener("pointerleave", function (event) {
      if (event.pointerType !== "touch") rest();
    });
    // The keyboard leaves the subtitles too
    frame.addEventListener("focusout", function (event) {
      if (!frame.contains(event.relatedTarget) && !frame.matches(":hover"))
        rest();
    });

    shiftButton.addEventListener("click", function () {
      shiftButton.setAttribute(
        "aria-pressed",
        String(shiftButton.getAttribute("aria-pressed") !== "true"),
      );
    });
    // The button lights up while the real Shift is held, and stays lit while it is turned on
    var trackShift = function (event) {
      keyboardShift = Boolean(event.shiftKey);
      shiftButton.classList.toggle("down", keyboardShift);
    };
    addEventListener("keydown", trackShift, true);
    addEventListener("keyup", trackShift, true);
    addEventListener("blur", trackShift);
    addEventListener("resize", function () {
      if (first !== null && !tip.hidden) showTip();
    });

    rest();
  }

  // The videos: the browser's controls give way to the site's own button, which, like a click on
  // the video, pauses and plays; it follows the video's own play and pause events. They play,
  // muted and looping, while they are on screen, and pause off it. Never on their own when the
  // viewer asks for less motion; one the viewer paused stays paused.
  function playVideos() {
    var autoplay =
      "IntersectionObserver" in window &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
    var play = function (video) {
      video.play().catch(function () {
        /* the browser refused: the poster and the button stay */
      });
    };
    var onScreen = new WeakMap();
    var observer =
      autoplay &&
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var video = entry.target;
            onScreen.set(video, entry.isIntersecting);
            if (!entry.isIntersecting) video.pause();
            else if (!video.dataset.pausedByViewer) play(video);
          });
        },
        { threshold: 0.5 },
      );
    document.querySelectorAll(".clip").forEach(function (clip) {
      var video = clip.querySelector("video");
      var button = clip.querySelector(".play");
      var toggle = function () {
        if (video.paused) play(video);
        else video.pause();
      };
      var show = function () {
        clip.classList.toggle("playing", !video.paused);
        button.setAttribute(
          "aria-label",
          (video.paused ? "Play: " : "Pause: ") + clip.dataset.name,
        );
      };
      // The button is the one control, also for the keyboard: no stop on the video itself
      video.removeAttribute("controls");
      video.tabIndex = -1;
      button.hidden = false;
      button.addEventListener("click", toggle);
      video.addEventListener("click", toggle);
      video.addEventListener("play", show);
      video.addEventListener("pause", show);
      // A pause while the video is on screen is the viewer's; ours happen off screen
      video.addEventListener("pause", function () {
        if (onScreen.get(video)) video.dataset.pausedByViewer = "true";
      });
      video.addEventListener("play", function () {
        delete video.dataset.pausedByViewer;
      });
      show();
      if (observer) observer.observe(video);
    });
  }
})();

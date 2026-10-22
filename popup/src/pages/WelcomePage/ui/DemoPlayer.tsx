import { FC, SyntheticEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
// 960×540 VP9, 30 s of one still frame: the gradient of the site's `.frame`
// (site/index.html) drawn by a browser, encoded with `ffmpeg -loop 1
// -framerate 10 -i frame.png -t 30 -c:v libvpx-vp9 -b:v 0 -crf 30 -an`.
import demoVideo from "../assets/demo.webm";

export type DemoLanguage = "en" | "es";

// The source language is the viewer's ("auto" by default), and Google reads
// it from the selection alone: each word of the Spanish line is one it takes
// for Spanish ("playa", "si" and "a" it did not; checked 21.10.2026).
const LINES: Record<DemoLanguage, string[]> = {
  en: ["I'm going to the beach tomorrow", "if the weather is nice"],
  es: ["Caminaremos por la montaña", "cuando haga buen tiempo"],
};

// YouTube's inline style of a caption segment in the default caption theme
// (e2e/fixtures/player.js), at the size the site's demo gives it, a share of
// the player's width (22 px where container units are missing, Chrome before
// 105). The tooltip takes its look from it, as on YouTube.
const SEGMENT_STYLE = "display: inline-block; white-space: pre-wrap; background: rgba(8, 8, 8, 0.75); "
  + "font-size: 22px; font-size: clamp(14px, 3.4cqi, 26px); color: rgb(255, 255, 255); fill: rgb(255, 255, 255); "
  + "font-family: \"YouTube Noto\", Roboto, Arial, Helvetica, Verdana, \"PT Sans Caption\", sans-serif;";

// `line-height: normal`, as YouTube's captions have (a segment of 20.55 px is
// 24 px high in e2e/youtube-dom/captured/watch.json): inherited from the page,
// the segment's line would be taller than its words, and a selected word's grey
// would not fill it.
const CAPTION_WINDOW_STYLE = "position: absolute; left: 0; right: 0; bottom: 12%; margin: 0 auto; "
  + "width: max-content; max-width: 96%; text-align: center; line-height: normal; pointer-events: auto;";

const element = (tag: string, className: string, style: string) => {
  const node = document.createElement(tag);
  node.className = className;
  node.setAttribute("style", style);
  return node;
};

/** A caption window as YouTube adds one to the container, a visual line per line. */
const createCaptionWindow = (language: DemoLanguage) => {
  const captionWindow = element("div", "caption-window", CAPTION_WINDOW_STYLE);
  captionWindow.lang = language;
  captionWindow.dir = "ltr";
  for (const text of LINES[language]) {
    const line = element("span", "caption-visual-line", "display: block;");
    const segment = element("span", "ytp-caption-segment", SEGMENT_STYLE);
    segment.textContent = text;
    line.append(segment);
    captionWindow.append(line);
  }
  return captionWindow;
};

/**
 * ▶ and ❚❚, drawn rather than typed: the characters' size and place are the
 * font's. The triangle's box sits right of the centre, as in YouTube's icon,
 * so that its mass looks centred; the bars weigh about as much as it does.
 * The same SVG is in the site's demo (site/index.html).
 */
const DemoStatusIcon: FC<{ playing: boolean }> = ({ playing }) => (
  <svg width="12" height="12" viewBox="4 4 16 16" fill="currentColor" style={{ flex: "none" }}>
    {playing ? <path d="M8.5 6v12l10-6z"/> : <path d="M7.5 6.5h3v11h-3zM13.5 6.5h3v11h-3z"/>}
  </svg>
);

interface DemoPlayerProps {
  /** The language of the subtitle line; `null` for none yet. */
  language: DemoLanguage | null;
}

/**
 * A still frame of a video with a subtitle line, made into a working demo by
 * the extension itself: welcome.html loads the same content script and styles
 * as YouTube, and the script finds this player by YouTube's classes. Hover,
 * Shift, clicks, auto-pause and the tooltip's theme are the extension's own;
 * the page has no code for any of them.
 *
 * The markup is that of e2e/fixtures/watch.html and player.js (copied from
 * the live player, e2e/youtube-dom/captured/), cut down to the classes
 * `content/consts/consts.ts` looks for. It changes with them; e2e/welcome.spec.js
 * fails when they part.
 */
export const DemoPlayer: FC<DemoPlayerProps> = ({ language }) => {
  const { t } = useTranslation("welcome");
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // React leaves the container empty: the content script rewrites the line.
  // Added after the container, as YouTube does, so that the script's observer
  // sees it come; a line in another language replaces the whole window.
  useEffect(() => {
    if (!language) return;
    const captionWindow = createCaptionWindow(language);
    containerRef.current?.append(captionWindow);
    return () => captionWindow.remove();
  }, [language]);

  const handleTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    const { currentTime, duration } = event.currentTarget;
    setProgress(duration ? currentTime / duration : 0);
  };

  return (
    // No text selection in the picture, as in YouTube's player: Shift and a
    // click on a word would select the text around it. Left to right in every
    // language, like the picture and its progress bar.
    <Box className="html5-video-player" dir="ltr" sx={{ position: "relative", userSelect: "none", containerType: "inline-size" }}>
      {/* Visible on purpose: the browser may stop a muted video nobody can
          see, and auto-pause needs one that plays. It is the dark frame in
          both themes. */}
      <Box
        component="video"
        src={demoVideo}
        muted
        autoPlay
        loop
        playsInline
        disablePictureInPicture
        aria-hidden
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        sx={{
          display: "block",
          width: "100%",
          aspectRatio: "16 / 9",
          objectFit: "cover",
          borderRadius: "14px",
          // In the dark theme a ring of the divider's colour: the frame's dark
          // bottom is the page's own colour there.
          boxShadow: (theme) => theme.palette.mode === "dark"
            ? `0 0 0 1px ${theme.palette.divider}, 0 24px 60px -24px rgba(0, 0, 0, 0.55)`
            : "0 24px 60px -24px rgba(0, 0, 0, 0.55)",
        }}
      />
      <Box
        ref={containerRef}
        className="ytp-caption-window-container"
        sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      {/* As the site's demo shows it (site/index.html, `.status`): whole pixels
          everywhere and the text's line one font size high, centred like the
          icon, so that the text sits in the middle at every zoom level. Top
          right: the top left is where the extension says "Translation saved".
          The side is in `style`: the right-to-left styles would mirror it. */}
      <Box
        component="span"
        aria-hidden
        data-testid="demo-status"
        data-state={playing ? "playing" : "paused"}
        style={{ top: 12, right: 16 }}
        sx={{
          position: "absolute",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxSizing: "border-box",
          height: 24,
          padding: "0 10px",
          borderRadius: "12px",
          background: "rgba(0, 0, 0, 0.55)",
          color: "#ffffff",
          font: "600 12px/1 system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        <DemoStatusIcon playing={playing}/>
        <span dir="auto">{t(playing ? "demo.playing" : "demo.paused")}</span>
      </Box>
      <Box
        component="span"
        sx={{
          position: "absolute",
          left: "3%",
          right: "3%",
          bottom: "5%",
          height: 3,
          background: "rgba(255, 255, 255, 0.3)",
          pointerEvents: "none",
        }}
      >
        <Box
          component="span"
          data-testid="demo-progress"
          sx={{ display: "block", height: "100%", background: "#f61c0d" }}
          style={{ width: `${progress * 100}%` }}
        />
      </Box>
    </Box>
  );
};

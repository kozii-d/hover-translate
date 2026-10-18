const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const { PALETTES } = require("./palettes.js");

// Lays a frame from the player out as a store image, in a browser of its own
// (no extension, no YouTube): the template, the palette, the texts.

const TEMPLATES = path.join(__dirname, "templates");
const LOGO = path.resolve(__dirname, "../../assets/icons/logo-original.png");

const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;

// "Hover over a word — see its *translation*": the starred part in the accent
// colour; "Hold [Shift]": a key drawn as a key; a dash kept on the line before.
const escape = (text) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
const withAccent = (text) => escape(text)
  .replace(/\*([^*]+)\*/g, "<em>$1</em>")
  .replace(/\[([^\]]+)\]/g, "<kbd>$1</kbd>")
  .replace(/ —/g, "\u00a0—");

async function openComposer() {
  const browser = await chromium.launch({ channel: "chromium" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  return { page, close: () => browser.close() };
}

/**
 * Writes `out`: the frame `shot` as a 1280×800 screenshot, `framed` under
 * `headline` in `palette`, or `plain` on black; `popup`, an image of the
 * popup, over the frame, dimmed, as it opens over the video, only its top
 * and larger if `zoomed`; `whole`, the frame not cut at the sides (the
 * player's controls are at its edges). `note`, under the headline:
 * `{ without, bad, with, good }`, the word's translation without the line
 * around it (struck out) and with it, or `{ text }`, one line.
 */
async function composeScreenshot(page, { shot, popup, zoomed = false, whole = false, headline, note, credit, palette = "light", variant = "framed", lang, out }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(fs.readFileSync(path.join(TEMPLATES, "screenshot.html"), "utf8"), { waitUntil: "networkidle" });
  await page.evaluate(({ shot, popup, zoomed, whole, logo, headline, note, credit, colors, variant, lang }) => {
    document.documentElement.lang = lang.replace("_", "-");
    for (const [name, value] of Object.entries(colors)) document.documentElement.style.setProperty(`--${name}`, value);
    document.getElementById("framed").className = variant;
    document.getElementById("shot").src = shot;
    document.querySelector(".shot").classList.toggle("whole", whole);
    if (popup) {
      document.querySelector(".shot").classList.add("with-popup");
      document.getElementById("popup").src = popup;
      document.querySelector(".shot").classList.toggle("zoomed", zoomed);
    } else {
      document.getElementById("popup").remove();
    }
    document.getElementById("logo").src = logo;
    document.getElementById("headline").innerHTML = headline;
    document.getElementById("credit").textContent = credit;
    if (note?.text) {
      document.getElementById("note-text").textContent = note.text;
      document.getElementById("note-line").hidden = false;
    } else if (note) {
      for (const [name, text] of Object.entries(note)) document.getElementById(`note-${name}`).textContent = text;
      document.getElementById("note").hidden = false;
    }
    if (variant === "plain") document.querySelector(".head").remove();
    return Promise.all([...document.images].map((image) => image.decode())).then(() => {
      const image = document.getElementById("popup");
      // The top 73 % of the popup: its header, the tabs and the first words.
      if (zoomed) document.documentElement.style.setProperty("--popup-ratio", image.naturalWidth / (image.naturalHeight * 0.73));
      return document.fonts.ready;
    });
  }, { shot: dataUrl(shot), popup: popup && dataUrl(popup), zoomed, whole, logo: dataUrl(LOGO), headline: withAccent(headline), note, credit, colors: PALETTES[palette], variant, lang });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
}

// `og`: the site's link preview, Open Graph's size, a JPEG: as PNG a frame of
// the video weighs several times as much.
const PROMOS = {
  tile: { width: 440, height: 280, crop: 0.45 },
  marquee: { width: 1400, height: 560, crop: 0.66 },
  og: { width: 1200, height: 630, crop: 0.6, quality: 85 },
};

/**
 * Writes `out`: the promo image `kind` (`tile`, `marquee` or `og`) in the
 * dark palette, cut from the frame `shot` around `focus` — the point of it,
 * as fractions of its width and height, put in the middle of the piece shown.
 * The piece is `PROMOS[kind].crop` of the frame's width, or what fills its
 * height. The marquee and `og` also show `headline`.
 */
async function composePromo(page, { kind, shot, focus, headline, credit, lang, out }) {
  const { width, height, crop, quality } = PROMOS[kind];
  await page.setViewportSize({ width, height });
  await page.setContent(fs.readFileSync(path.join(TEMPLATES, "promo.html"), "utf8"), { waitUntil: "networkidle" });
  await page.evaluate(({ kind, shot, focus, crop, logo, headline, credit, colors, lang }) => {
    document.documentElement.lang = lang.replace("_", "-");
    for (const [name, value] of Object.entries(colors)) document.documentElement.style.setProperty(`--${name}`, value);
    document.getElementById("promo").className = kind;
    document.getElementById("logo").src = logo;
    document.getElementById("headline").innerHTML = headline;
    document.getElementById("credit").textContent = credit;
    const image = document.getElementById("shot");
    image.src = shot;
    return Promise.all([...document.images].map((each) => each.decode())).then(() => {
      // Scaled so that `crop` of the frame's width fills the piece (more, if
      // its height would not), the focus in its middle, never past its edges.
      const area = image.parentElement.getBoundingClientRect();
      const scale = Math.max(area.width / (image.naturalWidth * crop), area.height / image.naturalHeight);
      const [shownWidth, shownHeight] = [image.naturalWidth * scale, image.naturalHeight * scale];
      const clamp = (value, least) => Math.min(0, Math.max(least, value));
      image.style.width = `${shownWidth}px`;
      image.style.left = `${clamp(area.width / 2 - focus[0] * shownWidth, area.width - shownWidth)}px`;
      image.style.top = `${clamp(area.height / 2 - focus[1] * shownHeight, area.height - shownHeight)}px`;
      return document.fonts.ready;
    });
  }, { kind, shot: dataUrl(shot), focus, crop, logo: dataUrl(LOGO), headline: withAccent(headline), credit, colors: PALETTES.dark, lang });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, quality });
}

/**
 * Writes `out`: a still of the promo video, 1920×1080, in the dark palette.
 * `scene`: `headline` (and `note`, as on the screenshot) over the slot the
 * player goes into, `credit` in the corner. `card`: the logo and the name
 * over `line`, `credits` at the bottom.
 */
async function composeVideoStill(page, { kind, headline = "", note, credit = "", line = "", credits = "", lang, out }) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setContent(fs.readFileSync(path.join(TEMPLATES, "video.html"), "utf8"), { waitUntil: "networkidle" });
  await page.evaluate(({ kind, logo, headline, note, credit, line, credits, colors, lang }) => {
    document.documentElement.lang = lang.replace("_", "-");
    for (const [name, value] of Object.entries(colors)) document.documentElement.style.setProperty(`--${name}`, value);
    document.body.className = `is-${kind}`;
    for (const image of document.querySelectorAll(".logo")) image.src = logo;
    document.getElementById("headline").innerHTML = headline;
    document.getElementById("credit").textContent = credit;
    document.getElementById("line").innerHTML = line;
    document.getElementById("credits").textContent = credits;
    if (note) {
      for (const [name, text] of Object.entries(note)) document.getElementById(`note-${name}`).textContent = text;
      document.getElementById("note").hidden = false;
    }
    return Promise.all([...document.images].map((image) => image.decode())).then(() => document.fonts.ready);
  }, { kind, logo: dataUrl(LOGO), headline: withAccent(headline), note, credit, line: withAccent(line), credits, colors: PALETTES.dark, lang });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
}

module.exports = { PROMOS, openComposer, composeScreenshot, composePromo, composeVideoStill, withAccent };

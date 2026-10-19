const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { assertListing } = require("./check-listing.js");
const { AMO_CAPTIONS } = require("../store-assets/render/strings.js");

// Usage: node update-amo-listing.js [--dry-run] [--screenshots]
//
// Sends the listing's texts and links, and the privacy policy from
// site/privacy/index.html. With --screenshots, also replaces the screenshots
// with store-assets/out/amo/ (`npm run render:store`) and their captions.

const ROOT = path.join(__dirname, "..");
const PRIVACY_PAGE = path.join(ROOT, "site", "privacy", "index.html");
const SCREENSHOTS = path.join(ROOT, "store-assets", "out", "amo");

const HOMEPAGE = "https://hovertranslate.app/";
const SUPPORT_URL = "https://github.com/kozii-d/hover-translate/issues";
const SUPPORT_EMAIL = "hovertranslate@gmail.com";

// --- .env loader ---

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

// --- Locale mapping (project locale -> AMO locale) ---

// Values can be a string or an array of AMO locale codes (same source file, multiple targets)
const LOCALE_MAP = {
  en: ["en-US", "en-GB", "en-CA"],
  cs: "cs",
  de: "de",
  el: "el",
  es: ["es-ES", "es-AR", "es-CL", "es-MX"],
  fi: "fi",
  fr: "fr",
  hi: "hi",
  hu: "hu",
  it: "it",
  ja: "ja",
  ko: "ko",
  pl: "pl",
  pt_BR: "pt-BR",
  pt_PT: "pt-PT",
  ru: "ru",
  sv: "sv-SE",
  tr: "tr",
  uk: "uk",
  vi: "vi",
  zh_CN: "zh-CN",
  zh_TW: "zh-TW",
};

// Locales AMO accepts in translated fields: PROD_LANGUAGES in
// https://github.com/mozilla/addons-server/blob/master/src/olympia/core/languages.py
// (commit 1761cf0e42, 2026-09-22), which the prod settings assign to AMO_LANGUAGES.
// A PATCH naming any other locale is rejected as a whole ("The language code … is invalid").
const AMO_LOCALES = new Set([
  "cs", "de", "dsb", "el", "en-CA", "en-GB", "en-US", "es-AR", "es-CL", "es-ES",
  "es-MX", "fa", "fi", "fr", "fur", "fy-NL", "he", "hr", "hsb", "hu", "ia", "it",
  "ja", "ka", "kab", "ko", "nb-NO", "nl", "nn-NO", "pl", "pt-BR", "pt-PT", "ro",
  "ru", "sk", "sl", "sq", "sr", "sv-SE", "tr", "uk", "vi", "zh-CN", "zh-TW",
]);

// Normalizes string | string[] to always be an array
const toArray = (val) => (Array.isArray(val) ? val : [val]);

// --- Load names, summaries and descriptions ---

function loadListings() {
  const names = {};
  const descriptions = {};
  const summaries = {};

  for (const [locale, amoLocales] of Object.entries(LOCALE_MAP)) {
    const descPath = path.join(ROOT, "store-assets", "descriptions", `${locale}.txt`);
    if (!fs.existsSync(descPath)) {
      console.error(`Description file not found: ${descPath}`);
      process.exit(1);
    }
    const description = fs.readFileSync(descPath, "utf8").trim();

    const msgPath = path.join(ROOT, "_locales", locale, "messages.json");
    if (!fs.existsSync(msgPath)) {
      console.error(`Messages file not found: ${msgPath}`);
      process.exit(1);
    }
    const messages = JSON.parse(fs.readFileSync(msgPath, "utf8"));

    for (const amoLocale of toArray(amoLocales)) {
      names[amoLocale] = messages.name.message;
      summaries[amoLocale] = messages.description.message;
      descriptions[amoLocale] = description;
    }
  }

  return { names, descriptions, summaries };
}

// Locales with listing texts that LOCALE_MAP sends nowhere
function findUnmappedLocales() {
  return fs
    .readdirSync(path.join(ROOT, "_locales"))
    .filter((locale) => fs.existsSync(path.join(ROOT, "_locales", locale, "messages.json")))
    .filter((locale) => !(locale in LOCALE_MAP));
}

// --- JWT generation (HS256) ---

function base64url(data) {
  return Buffer.from(data).toString("base64url");
}

// A token lives five minutes at most, so every request gets its own
function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: process.env.AMO_API_KEY,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + 300,
    }),
  );
  const signature = crypto
    .createHmac("sha256", process.env.AMO_API_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

// --- Requests ---

const hhmm = (date) => date.toTimeString().slice(0, 5);

// AMO allows 10 writes an hour and 24 a day per account and answers 429 with
// Retry-After in seconds. Up to an hour is waited out; anything longer stops.
function retryAfter(header, now) {
  const seconds = /^\d+$/.test(header ?? "") ? Number(header) : NaN;
  const until = new Date(now.getTime() + seconds * 1000);
  if (seconds <= 3600) {
    return { seconds, message: `AMO limit: waiting ${Math.ceil(seconds / 60)} min (until ${hhmm(until)})` };
  }
  const when = Number.isNaN(seconds)
    ? "later"
    : `not before ${until.toDateString()} ${hhmm(until)}`;
  throw new Error(
    `AMO limit reached: run again ${when}. If screenshots were being replaced, ` +
      "the old ones are deleted only after all the new ones are up, so the listing still has them.",
  );
}

// A JSON body or a FormData; returns the parsed answer
async function amoRequest(method, url, body) {
  for (;;) {
    const headers = { Authorization: `JWT ${generateJWT()}` };
    const isJson = body !== undefined && !(body instanceof FormData);
    if (isJson) headers["Content-Type"] = "application/json";
    const response = await fetch(url, { method, headers, body: isJson ? JSON.stringify(body) : body });
    if (response.status === 429) {
      const { seconds, message } = retryAfter(response.headers.get("Retry-After"), new Date());
      console.log(`  ${message}`);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      continue;
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`API error ${response.status} on ${method} ${url}: ${text}`);
    return text ? JSON.parse(text) : null;
  }
}

function filterByLocales(data, supportedLocales, skipped) {
  const filtered = {};
  for (const [locale, value] of Object.entries(data)) {
    if (supportedLocales.has(locale)) {
      filtered[locale] = value;
    } else {
      skipped.add(locale);
    }
  }
  return filtered;
}

// The PATCH body AMO gets, from the files in the repository, and the locales
// left out of it because AMO does not accept them. The links go to every
// locale: AMO shows an empty string saved in a locale as it is, instead of
// the en-US value.
function buildPatchBody() {
  const { names, descriptions, summaries } = loadListings();
  const skipped = new Set();
  const name = filterByLocales(names, AMO_LOCALES, skipped);
  const everyLocale = (value) => Object.fromEntries(Object.keys(name).map((locale) => [locale, value]));
  const body = {
    name,
    summary: filterByLocales(summaries, AMO_LOCALES, skipped),
    description: filterByLocales(descriptions, AMO_LOCALES, skipped),
    homepage: everyLocale(HOMEPAGE),
    support_url: everyLocale(SUPPORT_URL),
    support_email: everyLocale(SUPPORT_EMAIL),
  };
  return { body, skipped };
}

// --- Privacy policy ---

// AMO keeps only links, bold, italics, lists, quotes and code of the Markdown
// it is sent, so headings become bold paragraphs. A tag not listed here stops
// the script, so that nothing on the page is lost unnoticed.
const POLICY_TAGS = new Set(["h1", "h2", "p", "ul", "li", "b", "code", "a", "section"]);
const POLICY_BLOCK = /<(h1|h2|p|ul)\b[^>]*>([\s\S]*?)<\/\1\s*>/g;

function policyInline(html) {
  return html
    .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/g, (_, href, text) => `[${text}](${href})`)
    .replace(/<\/?b\s*>/g, "**")
    .replace(/<\/?code\s*>/g, "`")
    .replace(/\s+/g, " ")
    .trim();
}

// The <main> of the site's privacy page as Markdown, without its title: AMO
// heads the page with its own
function privacyPolicyMarkdown(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/)?.[1];
  if (main === undefined) throw new Error("The privacy page has no <main>");
  for (const [, tag] of main.matchAll(/<\/?([a-zA-Z][\w-]*)/g)) {
    if (!POLICY_TAGS.has(tag)) throw new Error(`The privacy policy cannot turn <${tag}> into Markdown for AMO`);
  }
  // What is left without the paragraphs, headings and list items, in a list or out of one
  const loose = main.replace(/<(h1|h2|p|li)\b[^>]*>[\s\S]*?<\/\1\s*>/g, "").replace(/<[^>]*>/g, "").trim();
  if (loose) throw new Error(`The privacy policy has text outside a paragraph or a list item: ${loose.slice(0, 60)}`);

  const blocks = [];
  for (const [, tag, content] of main.matchAll(POLICY_BLOCK)) {
    if (tag === "h2") blocks.push(`**${policyInline(content)}**`);
    if (tag === "p") blocks.push(policyInline(content));
    if (tag === "ul") {
      const items = [...content.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/g)];
      blocks.push(items.map(([, item]) => `- ${policyInline(item)}`).join("\n"));
    }
  }
  const markdown = blocks.join("\n\n");
  if (markdown.includes("<")) throw new Error("The privacy policy has a tag nested where it cannot be turned into Markdown");
  return markdown;
}

// --- Screenshots ---

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

// The screenshots in the order of the numbers in their names
// (`1-word.png` → position 0), each with its caption from AMO_CAPTIONS by the
// name of its shot. `files` are the folder's entries as { name, size }; what
// is not a PNG or JPEG in it is not a screenshot.
function buildUploads(files) {
  const images = files.filter(({ name }) => /\.(png|jpe?g)$/i.test(name));
  if (images.length === 0) throw new Error("No screenshots in store-assets/out/amo: run `npm run render:store` first");
  const uploads = images.map(({ name, size }) => {
    const [, number, shot] = name.match(/^([1-9]\d*)-(.+)\.\w+$/) ?? [];
    if (!number) throw new Error(`${name}: the name must be <number from 1>-<shot>, as render:store writes it`);
    if (!AMO_CAPTIONS[shot]) throw new Error(`${name}: no caption for "${shot}" in AMO_CAPTIONS`);
    if (size > MAX_IMAGE_SIZE) throw new Error(`${name}: over AMO's 4 MB`);
    const caption = {};
    for (const [locale, text] of Object.entries(AMO_CAPTIONS[shot])) {
      for (const amoLocale of toArray(LOCALE_MAP[locale] ?? [])) {
        if (AMO_LOCALES.has(amoLocale)) caption[amoLocale] = text;
      }
    }
    return { name, shot, position: Number(number) - 1, caption };
  });
  // The generator does not clear the folder: a file of an earlier run must not go up too
  const names = (same) => same.map(({ name }) => name).join(", ");
  for (const upload of uploads) {
    const sameShot = uploads.filter((other) => other.shot === upload.shot);
    const sameNumber = uploads.filter((other) => other.position === upload.position);
    if (sameShot.length > 1) throw new Error(`The shot "${upload.shot}" has more than one file: ${names(sameShot)}`);
    if (sameNumber.length > 1) throw new Error(`The number ${upload.position + 1} has more than one file: ${names(sameNumber)}`);
  }
  const missing = Object.keys(AMO_CAPTIONS).filter((shot) => !uploads.some((upload) => upload.shot === shot));
  if (missing.length > 0) throw new Error(`No screenshot for the captions of: ${missing.join(", ")}`);
  return uploads.sort((a, b) => a.position - b.position);
}

// Every new screenshot is uploaded and captioned before the first old one is
// removed, so a run stopped halfway leaves the listing with both. A new run
// removes everything the listing had before it, this one's uploads included.
async function replaceScreenshots({ upload, setCaption, remove }, oldIds, uploads) {
  for (const item of uploads) {
    const id = await upload(item);
    await setCaption(id, item.caption);
  }
  for (const id of oldIds) await remove(id);
}

// --- Main ---

function readScreenshots() {
  const names = fs.existsSync(SCREENSHOTS) ? fs.readdirSync(SCREENSHOTS) : [];
  return buildUploads(names.map((name) => ({ name, size: fs.statSync(path.join(SCREENSHOTS, name)).size })));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const screenshots = process.argv.includes("--screenshots");

  console.log("Loading listings...");
  const { body, skipped } = buildPatchBody();
  console.log(`  Loaded ${Object.keys(body.summary).length + skipped.size} locales`);

  const unmapped = findUnmappedLocales();
  if (unmapped.length > 0) {
    console.warn(
      `  Not in LOCALE_MAP, so not sent to AMO: ${unmapped.join(", ")}`,
    );
  }

  // Both stop the script before anything is sent
  const privacyPolicy = privacyPolicyMarkdown(fs.readFileSync(PRIVACY_PAGE, "utf8"));
  const uploads = screenshots ? readScreenshots() : [];

  const url = `https://addons.mozilla.org/api/v5/addons/addon/${process.env.AMO_ADDON_ID}/`;

  // Also checks the credentials before anything is sent
  console.log("Fetching addon info...");
  const addon = await amoRequest("GET", url);
  const currentLocales = new Set([
    ...Object.keys(addon.name || {}),
    ...Object.keys(addon.summary || {}),
    ...Object.keys(addon.description || {}),
  ]);
  const oldPreviewIds = (addon.previews || []).map((preview) => preview.id);
  console.log(
    `  The add-on has ${currentLocales.size} locales on AMO: ${[...currentLocales].join(", ")}`,
  );

  if (skipped.size > 0) {
    console.warn(
      `\n  Skipping locales AMO does not support: ${[...skipped].join(", ")} (not in AMO_LOCALES)`,
    );
  }

  const added = Object.keys(body.summary).filter(
    (locale) => !currentLocales.has(locale),
  );
  if (added.length > 0) {
    console.log(`  New on AMO: ${added.join(", ")}`);
  }

  console.log(`  Will update ${Object.keys(body.summary).length} locales`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would send PATCH to AMO API with payload:\n");
    for (const amoLocale of Object.keys(body.summary)) {
      const summaryPreview = body.summary[amoLocale].slice(0, 80);
      const descLen = body.description[amoLocale]?.length || 0;
      console.log(
        `  ${amoLocale}: name="${body.name[amoLocale]}", summary="${summaryPreview}..." (${body.summary[amoLocale].length} chars), description (${descLen} chars)`,
      );
    }
    console.log(`\n  Links, in every locale above: homepage ${HOMEPAGE}, support site ${SUPPORT_URL}, support e-mail ${SUPPORT_EMAIL}`);
    console.log(`\n[DRY RUN] Would send the privacy policy (en-US, ${privacyPolicy.length} chars):\n\n${privacyPolicy}\n`);
    if (screenshots) {
      console.log("[DRY RUN] Would upload the screenshots:");
      for (const { name, position, caption } of uploads) {
        const captions = Object.entries(caption).map(([locale, text]) => `${locale} ${text.length}`).join(", ");
        console.log(`  position ${position}: ${name}, captions (chars): ${captions}`);
      }
      console.log(`  and then delete the previews AMO has now: ${oldPreviewIds.join(", ") || "none"}`);
    }
    console.log("\nDry run complete. No API call made.");
    return;
  }

  console.log(`\nSending PATCH to ${url}...`);
  await amoRequest("PATCH", url, body);
  console.log("  Texts and links updated");

  await amoRequest("PATCH", `${url}eula_policy/`, { privacy_policy: { "en-US": privacyPolicy } });
  console.log("  Privacy policy updated");

  if (screenshots) {
    console.log(`\nReplacing ${oldPreviewIds.length} screenshots with ${uploads.length}; AMO's limit makes this take about two hours`);
    await replaceScreenshots({
      upload: async ({ name, position }) => {
        const form = new FormData();
        const type = /\.png$/i.test(name) ? "image/png" : "image/jpeg";
        form.append("image", await fs.openAsBlob(path.join(SCREENSHOTS, name), { type }), name);
        form.append("position", String(position));
        const preview = await amoRequest("POST", `${url}previews/`, form);
        console.log(`  Uploaded ${name} (preview ${preview.id})`);
        return preview.id;
      },
      setCaption: async (id, caption) => {
        await amoRequest("PATCH", `${url}previews/${id}/`, { caption });
        console.log(`  Captioned preview ${id}`);
      },
      remove: async (id) => {
        await amoRequest("DELETE", `${url}previews/${id}/`);
        console.log(`  Deleted old preview ${id}`);
      },
    }, oldPreviewIds, uploads);
  }

  console.log("AMO listing updated successfully!");
}

if (require.main === module) {
  // The same limits as `npm run check:listing`, before anything else
  assertListing();
  loadEnv();

  if (!process.env.AMO_API_KEY || !process.env.AMO_API_SECRET || !process.env.AMO_ADDON_ID) {
    console.error(
      "Missing required environment variables: AMO_API_KEY, AMO_API_SECRET, AMO_ADDON_ID",
    );
    process.exit(1);
  }

  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = {
  buildPatchBody,
  LOCALE_MAP,
  AMO_LOCALES,
  privacyPolicyMarkdown,
  buildUploads,
  replaceScreenshots,
  retryAfter,
  amoRequest,
};

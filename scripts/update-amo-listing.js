const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { assertListing } = require("./check-listing.js");

// Usage: node update-amo-listing.js [--dry-run]

const ROOT = path.join(__dirname, "..");

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

function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: process.env.AMO_API_KEY,
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

// --- Fetch the locales the add-on currently has on AMO ---

async function fetchCurrentLocales(token, url) {
  console.log("Fetching addon info...");
  const response = await fetch(url, {
    headers: { Authorization: `JWT ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to fetch addon info (${response.status}): ${text}`);
    process.exit(1);
  }
  const data = await response.json();
  // name, summary and description are objects with locale keys
  const locales = new Set([
    ...Object.keys(data.name || {}),
    ...Object.keys(data.summary || {}),
    ...Object.keys(data.description || {}),
  ]);
  return locales;
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
// left out of it because AMO does not accept them
function buildPatchBody() {
  const { names, descriptions, summaries } = loadListings();
  const skipped = new Set();
  const body = {
    name: filterByLocales(names, AMO_LOCALES, skipped),
    summary: filterByLocales(summaries, AMO_LOCALES, skipped),
    description: filterByLocales(descriptions, AMO_LOCALES, skipped),
  };
  return { body, skipped };
}

// --- Main ---

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("Loading listings...");
  const { body, skipped } = buildPatchBody();
  console.log(`  Loaded ${Object.keys(body.summary).length + skipped.size} locales`);

  const unmapped = findUnmappedLocales();
  if (unmapped.length > 0) {
    console.warn(
      `  Not in LOCALE_MAP, so not sent to AMO: ${unmapped.join(", ")}`,
    );
  }

  const token = generateJWT();
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${process.env.AMO_ADDON_ID}/`;

  // Also checks the credentials before anything is sent
  const currentLocales = await fetchCurrentLocales(token, url);
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
    console.log("\nDry run complete. No API call made.");
    return;
  }

  console.log(`\nSending PATCH to ${url}...`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `JWT ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`API error ${response.status}: ${responseText}`);
    process.exit(1);
  }

  console.log(`API responded with ${response.status}`);
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
    console.error("Unexpected error:", err.message);
    process.exit(1);
  });
}

module.exports = { buildPatchBody, LOCALE_MAP };

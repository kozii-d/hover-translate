const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Usage: node update-amo-listing.js [--dry-run]
const dryRun = process.argv.includes("--dry-run");

// --- .env loader ---

const ROOT = path.join(__dirname, "..");
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
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

// --- Validate env ---

const AMO_API_KEY = process.env.AMO_API_KEY;
const AMO_API_SECRET = process.env.AMO_API_SECRET;
const AMO_ADDON_ID = process.env.AMO_ADDON_ID;

if (!AMO_API_KEY || !AMO_API_SECRET || !AMO_ADDON_ID) {
  console.error(
    "Missing required environment variables: AMO_API_KEY, AMO_API_SECRET, AMO_ADDON_ID",
  );
  process.exit(1);
}

// --- Locale mapping (project locale -> AMO locale) ---

// Values can be a string or an array of AMO locale codes (same source file, multiple targets)
const LOCALE_MAP = {
  en: ["en-US", "en-GB", "en-CA"],
  cs: "cs",
  de: "de",
  es: ["es-ES", "es-AR", "es-CL", "es-MX"],
  fi: "fi",
  fr: "fr",
  hi: "hi",
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
  zh_CN: "zh-CN",
  zh_TW: "zh-TW",
};

// Normalizes string | string[] to always be an array
const toArray = (val) => (Array.isArray(val) ? val : [val]);

// --- Load descriptions and summaries ---

function loadListings() {
  const descriptions = {};
  const summaries = {};

  for (const [locale, amoLocales] of Object.entries(LOCALE_MAP)) {
    const descPath = path.join(ROOT, "store-assets", "descriptions", `${locale}.txt`);
    if (!fs.existsSync(descPath)) {
      console.error(`Description file not found: ${descPath}`);
      process.exit(1);
    }
    const description = fs.readFileSync(descPath, "utf8").trim();
    if (!description) {
      console.error(`Description file is empty: ${descPath}`);
      process.exit(1);
    }

    const msgPath = path.join(ROOT, "_locales", locale, "messages.json");
    if (!fs.existsSync(msgPath)) {
      console.error(`Messages file not found: ${msgPath}`);
      process.exit(1);
    }
    const messages = JSON.parse(fs.readFileSync(msgPath, "utf8"));
    const summary = messages.description?.message;
    if (!summary) {
      console.error(`Missing "description.message" in ${msgPath}`);
      process.exit(1);
    }
    if (summary.length > 250) {
      console.error(
        `Summary too long (${summary.length}/250 chars) for locale "${locale}": ${msgPath}`,
      );
      process.exit(1);
    }

    for (const amoLocale of toArray(amoLocales)) {
      descriptions[amoLocale] = description;
      summaries[amoLocale] = summary;
    }
  }

  return { descriptions, summaries };
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
      iss: AMO_API_KEY,
      iat: now,
      exp: now + 300,
    }),
  );
  const signature = crypto
    .createHmac("sha256", AMO_API_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

// --- Fetch supported locales from AMO API ---

async function fetchSupportedLocales(token, url) {
  console.log("Fetching addon info to detect supported locales...");
  const response = await fetch(url, {
    headers: { Authorization: `JWT ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to fetch addon info (${response.status}): ${text}`);
    process.exit(1);
  }
  const data = await response.json();
  // summary and description are objects with locale keys
  const locales = new Set([
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

// --- Main ---

async function main() {
  console.log("Loading listings...");
  const { descriptions, summaries } = loadListings();
  console.log(`  Loaded ${Object.keys(descriptions).length} locales`);

  const token = generateJWT();
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${AMO_ADDON_ID}/`;

  // Fetch supported locales from current addon data
  const supportedLocales = await fetchSupportedLocales(token, url);
  console.log(
    `  AMO supports ${supportedLocales.size} locales: ${[...supportedLocales].join(", ")}`,
  );

  const skipped = new Set();
  const filteredSummaries = filterByLocales(
    summaries,
    supportedLocales,
    skipped,
  );
  const filteredDescriptions = filterByLocales(
    descriptions,
    supportedLocales,
    skipped,
  );

  if (skipped.size > 0) {
    console.warn(
      `\n  Skipping locales not supported by AMO: ${[...skipped].join(", ")}`,
    );
  }

  const body = {
    summary: filteredSummaries,
    description: filteredDescriptions,
  };

  console.log(`  Will update ${Object.keys(filteredSummaries).length} locales`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would send PATCH to AMO API with payload:\n");
    for (const amoLocale of Object.keys(filteredSummaries)) {
      const summaryPreview = filteredSummaries[amoLocale].slice(0, 80);
      const descLen = filteredDescriptions[amoLocale]?.length || 0;
      console.log(
        `  ${amoLocale}: summary="${summaryPreview}..." (${filteredSummaries[amoLocale].length} chars), description (${descLen} chars)`,
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

main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});

const fs = require("node:fs");
const path = require("node:path");
const { sitemapUrls, ORIGIN } = require("./check-site.js");

// Usage: node indexnow.js
// Tells the search engines that take IndexNow (Bing, which Copilot and ChatGPT
// search draw on, Yandex, Seznam, Naver, Yep; not Google) that the pages in
// site/sitemap.xml changed. Run it by hand once the changed site is published:
// IndexNow checks the key against https://hovertranslate.app/indexnow.txt.
// https://www.indexnow.org/documentation

const ENDPOINT = "https://api.indexnow.org/indexnow";
const SITE = path.join(__dirname, "..", "site");

// The protocol's key: 8 to 128 characters of a-z, A-Z, 0-9 and "-"
const KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

/** The JSON body of the request: every address of the sitemap, the key from the key file. */
function buildRequestBody(sitemap, keyFile) {
  const key = keyFile.trim();
  if (!KEY_PATTERN.test(key)) throw new Error("site/indexnow.txt does not hold an IndexNow key (8–128 characters: a-z, A-Z, 0-9, -)");
  const urlList = sitemapUrls(sitemap);
  if (urlList.length === 0) throw new Error("site/sitemap.xml lists no addresses");
  const foreign = urlList.find((url) => new URL(url).origin !== ORIGIN);
  if (foreign) throw new Error(`site/sitemap.xml lists ${foreign}, not on ${ORIGIN}: IndexNow refuses the whole list`);
  return { host: new URL(ORIGIN).host, key, keyLocation: `${ORIGIN}/indexnow.txt`, urlList };
}

// What IndexNow's answers mean, as its documentation puts them
const STATUSES = {
  200: "accepted",
  202: "accepted; IndexNow will check the key file later",
  400: "bad request: the body is not in the format IndexNow expects",
  403: "the key was not found at the key location — is the site with site/indexnow.txt published yet?",
  422: "the addresses are not on the host, or the key does not fit the protocol",
  429: "too many requests: IndexNow takes this for spam, try again later",
};

const describeStatus = (status) => STATUSES[status] ?? `unexpected answer ${status}`;

async function main() {
  const body = buildRequestBody(
    fs.readFileSync(path.join(SITE, "sitemap.xml"), "utf8"),
    fs.readFileSync(path.join(SITE, "indexnow.txt"), "utf8"),
  );
  console.log(`Sending ${body.urlList.length} address(es) to ${ENDPOINT}:\n${body.urlList.map((url) => `  ${url}`).join("\n")}`);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const message = `${response.status}: ${describeStatus(response.status)}`;
  if (response.status !== 200 && response.status !== 202) {
    console.error(message);
    process.exit(1);
  }
  console.log(message);
}

if (require.main === module) {
  main().catch((err) => {
    // No stack trace: a missing file or no network is the whole story
    console.error(`IndexNow: ${err.message}${err.cause?.message ? ` (${err.cause.message})` : ""}`);
    process.exit(1);
  });
}

module.exports = { buildRequestBody, describeStatus };

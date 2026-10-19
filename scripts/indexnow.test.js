const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { buildRequestBody, describeStatus } = require("./indexnow.js");

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://hovertranslate.app/</loc><lastmod>2026-10-18</lastmod></url>
  <url><loc>https://hovertranslate.app/privacy/</loc><lastmod>2026-10-18</lastmod></url>
</urlset>
`;
const KEY = "0123456789abcdef0123456789abcdef";

test("the body: the host, the key and where it is, every address of the sitemap", () => {
  assert.deepEqual(buildRequestBody(SITEMAP, `${KEY}\n`), {
    host: "hovertranslate.app",
    key: KEY,
    keyLocation: "https://hovertranslate.app/indexnow.txt",
    urlList: ["https://hovertranslate.app/", "https://hovertranslate.app/privacy/"],
  });
});

test("a key IndexNow would refuse, or a sitemap without addresses, is an error before any request", () => {
  assert.throws(() => buildRequestBody(SITEMAP, ""), /key/);
  assert.throws(() => buildRequestBody(SITEMAP, "short"), /key/);
  assert.throws(() => buildRequestBody(SITEMAP, "not a key, it has spaces and commas"), /key/);
  assert.throws(() => buildRequestBody("<urlset></urlset>", KEY), /sitemap/);
});

test("an address of another host is an error: IndexNow would refuse the whole list", () => {
  const sitemap = SITEMAP.replace("https://hovertranslate.app/privacy/", "https://www.hovertranslate.app/privacy/");
  assert.throws(() => buildRequestBody(sitemap, KEY), /www\.hovertranslate\.app/);
});

test("the site's own key and sitemap make a body", () => {
  const siteDir = path.join(__dirname, "..", "site");
  const body = buildRequestBody(fs.readFileSync(path.join(siteDir, "sitemap.xml"), "utf8"), fs.readFileSync(path.join(siteDir, "indexnow.txt"), "utf8"));
  assert.match(body.key, /^[0-9a-f]{32}$/);
  assert.ok(body.urlList.includes("https://hovertranslate.app/"));
  assert.ok(body.urlList.includes("https://hovertranslate.app/privacy/"));
});

test("every answer IndexNow documents is explained, and the rest are not taken for success", () => {
  assert.match(describeStatus(200), /accepted/i);
  assert.match(describeStatus(202), /accepted/i);
  assert.match(describeStatus(400), /bad request/i);
  assert.match(describeStatus(403), /key/i);
  assert.match(describeStatus(422), /host|key/i);
  assert.match(describeStatus(429), /too many/i);
  assert.match(describeStatus(500), /500/);
});

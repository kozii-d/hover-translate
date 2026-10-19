const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const { checkSite, CSP, LIMITS } = require("./check-site.js");

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

const STORES = [
  "https://chromewebstore.google.com/detail/abc",
  "https://addons.mozilla.org/firefox/addon/x/",
  "https://microsoftedge.microsoft.com/addons/detail/def",
];

// One page of the site, with everything check-site asks of a page.
function page({ url, h1 = "Title", head = "", body = "" }) {
  const canonical = `https://hovertranslate.app${url}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>Page</title>
<meta name="description" content="About the page">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/logo.png" sizes="32x32">
<meta property="og:title" content="Page">
<meta property="og:description" content="About the page">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="HoverTranslate">
<meta property="og:image" content="https://hovertranslate.app/media/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A picture">
<meta name="twitter:card" content="summary_large_image">
<style>body { background: url(/logo.png); } .a > .b { color: red; }</style>
${head}
</head>
<body>
<h1>${h1}</h1>
${body}
</body>
</html>
`;
}

// A small site that passes every check, and the README it is compared with;
// `change` replaces a file (a string), edits it (a function of its text) or
// removes it (null).
function site(change = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-site-"));
  roots.push(root);
  const files = {
    "README.md": `**Install:** ${STORES.map((url) => `[store](${url})`).join(" · ")}\n`,
    "site/index.html": page({
      url: "/",
      head: `<script src="/site.js" defer></script>
<script type="application/ld+json">{"@context": "https://schema.org", "@type": "SoftwareApplication", "installUrl": ${JSON.stringify(STORES)}, "offers": {"sameAs": ["${STORES[0]}"]}, "url": "https://hovertranslate.app/"}</script>`,
      body: `<nav><a href="#faq">FAQ</a> <a href="/privacy/">Privacy</a> <a href="/privacy/#data">Data</a> <a href="https://github.com/x/y">GitHub</a> <a href="mailto:a@b.c">Mail</a></nav>
${STORES.map((url) => `<a href="${url}">Add</a>`).join("\n")}
<img src="/logo.png" alt="" width="32" height="32">
<video controls muted poster="/media/a.webp" width="960" height="402"><source src="/media/a.webm" type="video/webm"><source src="media/a.mp4" type="video/mp4"></video>
<section id="faq"><h2>FAQ</h2></section>`,
    }),
    "site/privacy/index.html": page({ url: "/privacy/", body: `<p id="data">Data</p><a href="/">Home</a> <a href="../">Home</a>` }),
    "site/404.html": page({ url: "/404.html", head: `<meta name="robots" content="noindex">`, body: `<a href="/">Home</a>` }),
    "site/site.js": "",
    "site/logo.png": "png",
    "site/media/a.webp": "webp",
    "site/media/a.webm": "webm",
    "site/media/a.mp4": "mp4",
    "site/media/og.jpg": "jpg",
    "site/robots.txt": "User-agent: *\nAllow: /\n\nSitemap: https://hovertranslate.app/sitemap.xml\n",
    "site/sitemap.xml": `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://hovertranslate.app/</loc><lastmod>2026-10-18</lastmod></url>
  <url><loc>https://hovertranslate.app/privacy/</loc><lastmod>2026-10-18</lastmod></url>
</urlset>
`,
  };
  for (const [file, value] of Object.entries(change)) {
    files[file] = typeof value === "function" ? value(files[file]) : value;
  }
  for (const [file, text] of Object.entries(files)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const rules = (root) => checkSite(root).map((error) => error.rule);
// Edits site/index.html (or another page) by replacing one piece of text, which must be there.
const edit = (from, to) => (html) => {
  assert.ok(html.includes(from), `the page has no ${from}`);
  return html.replace(from, to);
};
const index = (from, to) => site({ "site/index.html": edit(from, to) });

test("a site with every check met: no errors", () => {
  assert.deepEqual(checkSite(site()), []);
});

test("the real site in site/ passes", () => {
  assert.deepEqual(checkSite(path.join(__dirname, "..")).map((error) => error.message), []);
});

test("a page without lang=\"en\", a title or a description", () => {
  assert.deepEqual(rules(index(`<html lang="en">`, "<html>")), ["lang"]);
  assert.deepEqual(rules(index("<title>Page</title>", "<title> </title>")), ["title"]);
  assert.deepEqual(rules(index(`<meta name="description" content="About the page">`, "")), ["description"]);
});

test("a page with no h1, or with two", () => {
  assert.deepEqual(rules(index("<h1>Title</h1>", "<h2>Title</h2>")), ["h1"]);
  assert.deepEqual(rules(index("<h1>Title</h1>", "<h1>Title</h1><h1 class=\"x\">Again</h1>")), ["h1"]);
});

test("a page without the Content-Security-Policy, or with a looser one", () => {
  assert.deepEqual(rules(index(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`, "")), ["csp"]);
  assert.deepEqual(rules(index("img-src 'self'", "img-src *")), ["csp"]);
});

test("a page without one of the link preview tags", () => {
  assert.deepEqual(rules(index(`<meta property="og:image:alt" content="A picture">`, "")), ["og"]);
  assert.deepEqual(rules(index(`<meta property="og:type" content="website">`, `<meta property="og:type" content="">`)), ["og"]);
  assert.deepEqual(rules(index(`content="summary_large_image"`, `content="summary"`)), ["twitter-card"]);
});

test("canonical: missing, relative, not the page's own address, or not og:url", () => {
  assert.deepEqual(rules(index(`<link rel="canonical" href="https://hovertranslate.app/">`, "")), ["canonical"]);
  assert.deepEqual(rules(index(`<link rel="canonical" href="https://hovertranslate.app/">`, `<link rel="canonical" href="/">`)), ["canonical"]);
  // privacy/index.html is /privacy/, never /privacy
  const root = site({ "site/privacy/index.html": edit(`rel="canonical" href="https://hovertranslate.app/privacy/"`, `rel="canonical" href="https://hovertranslate.app/privacy"`) });
  assert.deepEqual(rules(root), ["canonical"]);
  assert.deepEqual(rules(index(`<meta property="og:url" content="https://hovertranslate.app/">`, `<meta property="og:url" content="https://www.hovertranslate.app/">`)), ["og-url"]);
});

test("sitemap.xml: a page missing, a page with noindex listed, an address unlike the canonical", () => {
  const sitemap = (edit) => site({ "site/sitemap.xml": edit });
  assert.deepEqual(rules(sitemap(edit("<url><loc>https://hovertranslate.app/privacy/</loc><lastmod>2026-10-18</lastmod></url>", ""))), ["sitemap"]);
  assert.deepEqual(rules(sitemap(edit("</urlset>", "<url><loc>https://hovertranslate.app/404.html</loc></url></urlset>"))), ["sitemap"]);
  assert.deepEqual(rules(sitemap(edit("https://hovertranslate.app/privacy/", "https://hovertranslate.app/privacy"))), ["sitemap", "sitemap"]);
  assert.deepEqual(rules(sitemap(null)), ["sitemap"]);
  assert.deepEqual(rules(sitemap(edit("</urlset>", "<url><loc>https://hovertranslate.app/</loc></url></urlset>"))), ["sitemap"]);
});

test("a resource from another site: image, script, stylesheet, video, its poster, a frame, a font in CSS, og:image", () => {
  const external = (from, to) => checkSite(index(from, to)).map(({ rule, url }) => [rule, url]);
  assert.deepEqual(external(`<img src="/logo.png"`, `<img src="https://img.shields.io/x.svg"`), [["external", "https://img.shields.io/x.svg"]]);
  assert.deepEqual(external(`<script src="/site.js"`, `<script src="//cdn.example.com/a.js"`), [["external", "//cdn.example.com/a.js"]]);
  assert.deepEqual(external(`<link rel="icon" href="/logo.png"`, `<link rel="stylesheet" href="https://fonts.googleapis.com/css2"`), [["external", "https://fonts.googleapis.com/css2"]]);
  assert.deepEqual(external(`poster="/media/a.webp"`, `poster="https://i.ytimg.com/a.webp"`), [["external", "https://i.ytimg.com/a.webp"]]);
  assert.deepEqual(external(`<source src="/media/a.webm"`, `<source src="http://example.com/a.webm"`), [["external", "http://example.com/a.webm"]]);
  assert.deepEqual(external("<section", `<iframe src="https://www.youtube.com/embed/x"></iframe><section`), [["external", "https://www.youtube.com/embed/x"]]);
  assert.deepEqual(external("url(/logo.png)", `url("https://fonts.gstatic.com/a.woff2")`), [["external", "https://fonts.gstatic.com/a.woff2"]]);
  assert.deepEqual(external("<section", `<p style="background: url('data:image/png;base64,AAAA')"></p><section`), [["external", "data:image/png;base64,AAAA"]]);
  assert.deepEqual(external(`content="https://hovertranslate.app/media/og.jpg"`, `content="https://example.com/og.jpg"`), [["external", "https://example.com/og.jpg"]]);
});

test("a script written into the page; JSON-LD is allowed and has to parse", () => {
  assert.deepEqual(rules(index("<section", "<script>alert(1)</script><section")), ["inline-script"]);
  assert.deepEqual(rules(index(`"url": "https://hovertranslate.app/"}`, `"url": "https://hovertranslate.app/",}`)), ["json-ld"]);
});

test("a link to a page or file that is not there, a link without its slash, an anchor with no such id", () => {
  const broken = (from, to) => checkSite(index(from, to)).map(({ rule, url }) => [rule, url]);
  assert.deepEqual(broken(`<a href="/privacy/">`, `<a href="/uninstall/">`), [["link", "/uninstall/"]]);
  assert.deepEqual(broken(`<a href="/privacy/">`, `<a href="/privacy">`), [["link", "/privacy"]]);
  assert.deepEqual(broken(`<a href="#faq">`, `<a href="#questions">`), [["anchor", "#questions"]]);
  assert.deepEqual(broken(`<a href="/privacy/#data">`, `<a href="/privacy/#nothing">`), [["anchor", "/privacy/#nothing"]]);
  assert.deepEqual(broken(`<source src="media/a.mp4"`, `<source src="media/b.mp4"`), [["link", "media/b.mp4"]]);
  assert.deepEqual(broken("https://hovertranslate.app/media/og.jpg", "https://hovertranslate.app/media/og.png"), [["link", "https://hovertranslate.app/media/og.png"]]);
});

test("robots.txt without the sitemap", () => {
  assert.deepEqual(rules(site({ "site/robots.txt": "User-agent: *\nAllow: /\n" })), ["robots"]);
  assert.deepEqual(rules(site({ "site/robots.txt": null })), ["robots"]);
});

test("weight: a page over 60 KB, a video over 1.5 MB, a poster over 100 KB, og.jpg over 300 KB", () => {
  const weight = (file, bytes) => checkSite(site({ [file]: "x".repeat(bytes) })).map(({ rule, file }) => [rule, file]);
  assert.deepEqual(rules(index("</body>", `${"x".repeat(LIMITS.page)}</body>`)), ["weight"]);
  assert.deepEqual(weight("site/media/a.mp4", LIMITS.video), []);
  assert.deepEqual(weight("site/media/a.mp4", LIMITS.video + 1), [["weight", path.join("media", "a.mp4")]]);
  assert.deepEqual(weight("site/media/a.webm", LIMITS.video + 1), [["weight", path.join("media", "a.webm")]]);
  assert.deepEqual(weight("site/media/a.webp", LIMITS.poster + 1), [["weight", path.join("media", "a.webp")]]);
  assert.deepEqual(weight("site/media/og.jpg", LIMITS.ogImage + 1), [["weight", path.join("media", "og.jpg")]]);
});

test("store links unlike the README's, or one of them missing from the home page", () => {
  assert.deepEqual(rules(index(`<a href="${STORES[1]}">`, `<a href="https://addons.mozilla.org/en-US/firefox/addon/x/">`)), ["store-link", "store-link"]);
  assert.deepEqual(rules(index(`<a href="${STORES[2]}">Add</a>`, "")), ["store-link"]);
  assert.deepEqual(rules(site({ "README.md": null })), ["store-link"]);
});

test("store links in JSON-LD unlike the README's, in a list or deeper in the data", () => {
  const jsonLd = (from, to) => checkSite(index(from, to)).map(({ rule, url }) => [rule, url]);
  const old = "https://addons.mozilla.org/firefox/addon/old-name/";
  assert.deepEqual(jsonLd(`"${STORES[1]}",`, `"${old}",`), [["store-link", old]]);
  const reviews = `${STORES[0]}/reviews`;
  assert.deepEqual(jsonLd(`"sameAs": ["${STORES[0]}"]`, `"sameAs": ["${reviews}"]`), [["store-link", reviews]]);
});

test("og:image is the image's absolute address on the site", () => {
  assert.deepEqual(rules(index(`content="https://hovertranslate.app/media/og.jpg"`, `content="/media/og.jpg"`)), ["og"]);
});

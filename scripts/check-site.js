const fs = require("node:fs");
const path = require("node:path");

// Usage: node check-site.js
// Checks the website in site/ (https://hovertranslate.app/, published by GitHub
// Pages as it is, no build) offline. Exits 1 and prints every error found:
// - what every page needs for search engines and link previews, and canonical
//   addresses that agree with the files, og:url and sitemap.xml;
// - nothing loaded from another site — the site promises no external requests, as
//   the extension does; the CSP below enforces it in the browser, this check
//   catches it before it is published; links (<a>) may go anywhere;
// - no script written into a page (the CSP would block it), JSON-LD that parses;
// - internal links and files that exist, and anchors that do;
// - a form only on a page with noindex (the page after the extension is
//   removed), sending only to Web3Forms, under the policy that lets it;
// - robots.txt pointing at the sitemap, the weight of pages and media, and the
//   store links the same as the README's.
// HTML is read with regular expressions: the pages are written by hand, in the
// plain markup this expects (quoted attributes, no `>` inside them).

const ORIGIN = "https://hovertranslate.app";

// Every page carries it as a <meta>: GitHub Pages sends no headers of its own.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

// A page with a form sends it to Web3Forms, which then sends the browser back to
// the site: Chrome checks form-action on that redirect too, hence 'self'.
const WEB3FORMS = "https://api.web3forms.com/submit";
const FORM_CSP = CSP.replace("form-action 'none'", `form-action 'self' ${new URL(WEB3FORMS).origin}`);

const OG_PROPERTIES = [
  "og:title", "og:description", "og:url", "og:type", "og:site_name",
  "og:image", "og:image:width", "og:image:height", "og:image:alt",
];

// Bytes
const LIMITS = {
  page: 60 * 1024,
  video: 1.5 * 1024 * 1024,
  poster: 100 * 1024,
  ogImage: 300 * 1024,
};

const STORE_HOSTS = ["chromewebstore.google.com", "addons.mozilla.org", "microsoftedge.microsoft.com"];

// --- reading HTML ---

const ENTITIES = { amp: "&", quot: "\"", "#39": "'", lt: "<", gt: ">" };
const decode = (text) => text.replace(/&(amp|quot|#39|lt|gt);/g, (_, name) => ENTITIES[name]);

function parseAttributes(text) {
  const attributes = {};
  for (const [, name, double, single, bare] of text.matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    attributes[name.toLowerCase()] = decode(double ?? single ?? bare ?? "");
  }
  return attributes;
}

// The start tags of a page, the text of its <script> and <style> elements, and its title
function parsePage(html) {
  const scripts = [];
  const styles = [];
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi, (_, name, attributes, text) => {
      (name.toLowerCase() === "script" ? scripts : styles).push({ attributes: parseAttributes(attributes), text });
      return `<${name}${attributes}></${name}>`;
    });
  const tags = [...markup.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g)]
    .map(([, name, attributes]) => ({ name: name.toLowerCase(), attributes: parseAttributes(attributes) }));
  const title = decode(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(markup)?.[1] ?? "").trim();
  return { tags, scripts, styles, title };
}

// The addresses CSS loads: url(…), which @import url(…) uses too
const cssUrls = (css) => [...css.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)].map((match) => match[2]);

const meta = (page, key, name) => page.tags.find((tag) => tag.name === "meta" && tag.attributes[key]?.toLowerCase() === name)?.attributes.content;
const isNoindex = (page) => /\bnoindex\b/i.test(meta(page, "name", "robots") ?? "");
const hasRel = (tag, rel) => (tag.attributes.rel ?? "").toLowerCase().split(/\s+/).includes(rel);

// Everything the page loads or has loaded (og:image), as { value, meta }; meta: from <meta content>
function resources(page) {
  const found = [];
  for (const tag of page.tags) {
    const { attributes } = tag;
    for (const name of ["src", "poster"]) {
      if (attributes[name]) found.push({ value: attributes[name] });
    }
    if (tag.name === "link" && attributes.href && !hasRel(tag, "canonical")) found.push({ value: attributes.href });
    // og:image and the like; og:url names the page itself and is checked against the canonical
    const isAddress = /^(https?:)?\/\//i.test(attributes.content ?? "") && attributes.property !== "og:url";
    if (tag.name === "meta" && isAddress) found.push({ value: attributes.content, meta: true });
    if (attributes.style) cssUrls(attributes.style).forEach((value) => found.push({ value }));
  }
  page.styles.forEach((style) => cssUrls(style.text).forEach((value) => found.push({ value })));
  return found;
}

// --- the site ---

const listFiles = (siteDir) => fs.readdirSync(siteDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.relative(siteDir, path.join(entry.parentPath, entry.name)));

// index.html → "/", privacy/index.html → "/privacy/", 404.html → "/404.html"
const addressOf = (file) => `/${file.split(path.sep).join("/").replace(/(^|\/)index\.html$/, "$1")}`;

// The file in site/ that a URL of the site is served from, or null when there is none
function fileOf(siteDir, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = path.join(siteDir, ...pathname.split("/"));
  return fs.existsSync(file) && fs.statSync(file).isFile() ? path.relative(siteDir, file) : null;
}

const sitemapUrls = (xml) => [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((match) => decode(match[1]));

const readIf = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);

function checkPage(siteDir, file, page, pages, errors) {
  const error = (rule, message, extra = {}) => errors.push({ rule, file, ...extra, message: `${file}: ${message}` });
  const html = page.tags.find((tag) => tag.name === "html");
  if (html?.attributes.lang !== "en") error("lang", "<html> has no lang=\"en\"");
  if (!page.title) error("title", "has no <title>");
  if (!meta(page, "name", "description")?.trim()) error("description", "has no <meta name=\"description\">");
  const h1 = page.tags.filter((tag) => tag.name === "h1").length;
  if (h1 !== 1) error("h1", `has ${h1} <h1>, one expected`);
  const forms = page.tags.filter((tag) => tag.name === "form");
  if (meta(page, "http-equiv", "content-security-policy") !== (forms.length > 0 ? FORM_CSP : CSP)) {
    error("csp", `has no <meta http-equiv="Content-Security-Policy"> with the site's policy (${forms.length > 0 ? "FORM_CSP, for a page with a form" : "CSP"} in check-site.js)`);
  }
  for (const form of forms) {
    if (form.attributes.action !== WEB3FORMS) error("form", `a form sends to ${form.attributes.action ?? "the page itself"}; the only one allowed sends to ${WEB3FORMS}`, { url: form.attributes.action });
    if (!isNoindex(page)) error("form", "has a form but no <meta name=\"robots\" content=\"noindex\">: only the page after the extension is removed asks anything");
  }
  for (const property of OG_PROPERTIES) {
    if (!meta(page, "property", property)?.trim()) error("og", `has no <meta property="${property}">`);
  }
  const image = meta(page, "property", "og:image");
  // One from another site is reported as external
  if (image && !/^(https?:)?\/\//i.test(image)) error("og", `og:image is ${image}; link previews need its absolute address, ${ORIGIN}/…`);
  if (meta(page, "name", "twitter:card") !== "summary_large_image") error("twitter-card", "has no <meta name=\"twitter:card\" content=\"summary_large_image\">");

  const address = ORIGIN + addressOf(file);
  const canonical = page.tags.find((tag) => tag.name === "link" && hasRel(tag, "canonical"))?.attributes.href;
  if (canonical !== address) error("canonical", `canonical is ${canonical ?? "missing"}, expected ${address}`);
  const ogUrl = meta(page, "property", "og:url");
  if (ogUrl && ogUrl !== address) error("og-url", `og:url is ${ogUrl}, expected ${address}`);

  for (const script of page.scripts) {
    const type = script.attributes.type?.toLowerCase();
    if (type === "application/ld+json") {
      try {
        JSON.parse(script.text);
      } catch (err) {
        error("json-ld", `JSON-LD does not parse (${err.message})`);
      }
    } else if (!("src" in script.attributes)) {
      error("inline-script", "has a script written into the page; put it into a file (the CSP blocks it)");
    }
  }

  // Resolves an address against the page; checks that the file is there, and the id after #
  const exists = (value) => {
    const url = new URL(value, address);
    const target = fileOf(siteDir, url);
    if (!target) {
      const directory = fs.existsSync(path.join(siteDir, decodeURIComponent(url.pathname)));
      error("link", `${value} leads to no file in site/${directory ? " (a folder: end the address with /)" : ""}`, { url: value });
      return;
    }
    const id = decodeURIComponent(url.hash.slice(1));
    if (id && pages.has(target) && !pages.get(target).tags.some((tag) => tag.attributes.id === id)) {
      error("anchor", `${value}: ${target} has no id="${id}"`, { url: value });
    }
  };

  for (const resource of resources(page)) {
    const external = resource.meta
      ? new URL(resource.value, address).origin !== ORIGIN
      : /^([a-z][a-z\d+.-]*:|\/\/)/i.test(resource.value);
    if (external) error("external", `loads ${resource.value} from another site; keep it in site/`, { url: resource.value });
    else exists(resource.value);
  }
  for (const tag of page.tags) {
    const href = tag.name === "a" ? tag.attributes.href : undefined;
    if (href && new URL(href, address).origin === ORIGIN) exists(href);
    // Web3Forms sends the browser there after the answer; it takes only an address on the same site
    if (tag.name === "input" && tag.attributes.name === "redirect") {
      const redirect = tag.attributes.value ?? "";
      if (redirect.startsWith(`${ORIGIN}/`)) exists(redirect);
      else error("form", `the form's redirect is ${redirect}; Web3Forms takes only an address on ${ORIGIN}`, { url: redirect });
    }
  }
}

// Every string in parsed JSON, however deep
const jsonStrings = (value) => (typeof value === "string" ? [value]
  : value && typeof value === "object" ? Object.values(value).flatMap(jsonStrings) : []);

// The strings of a page's JSON-LD that parses (one that does not is reported by checkPage)
const jsonLdStrings = (page) => page.scripts
  .filter((script) => script.attributes.type?.toLowerCase() === "application/ld+json")
  .flatMap((script) => {
    try {
      return jsonStrings(JSON.parse(script.text));
    } catch {
      return [];
    }
  });

// Every store link on the site, in <a> and in JSON-LD, is one of the README's, and the home page has them all
function checkStoreLinks(root, pages, errors) {
  const readme = readIf(path.join(root, "README.md"));
  if (readme === null) {
    errors.push({ rule: "store-link", file: "README.md", message: "README.md is missing: the store links are compared with it" });
    return;
  }
  const isStore = (href) => {
    try {
      return STORE_HOSTS.includes(new URL(href).host);
    } catch {
      return false;
    }
  };
  const readmeLinks = new Set([...readme.matchAll(/https:\/\/[^\s)<>\]"']+/g)].map((match) => match[0]).filter(isStore));
  for (const [file, page] of pages) {
    const links = [...page.tags.filter((tag) => tag.name === "a" && tag.attributes.href).map((tag) => tag.attributes.href), ...jsonLdStrings(page)];
    for (const link of links) {
      if (isStore(link) && !readmeLinks.has(link)) {
        errors.push({ rule: "store-link", file, url: link, message: `${file}: ${link} is not one of the store links in README.md` });
      }
    }
  }
  const home = pages.get("index.html");
  for (const link of readmeLinks) {
    if (home && !home.tags.some((tag) => tag.name === "a" && tag.attributes.href === link)) {
      errors.push({ rule: "store-link", file: "index.html", url: link, message: `index.html: has no link to ${link} (README.md)` });
    }
  }
}

function checkSitemap(siteDir, pages, errors) {
  const xml = readIf(path.join(siteDir, "sitemap.xml"));
  if (xml === null) {
    errors.push({ rule: "sitemap", file: "sitemap.xml", message: "sitemap.xml is missing" });
    return;
  }
  const listed = sitemapUrls(xml);
  const indexable = new Map();
  for (const [file, page] of pages) {
    if (!isNoindex(page)) indexable.set(ORIGIN + addressOf(file), file);
  }
  for (const url of listed) {
    if (!indexable.has(url)) errors.push({ rule: "sitemap", file: "sitemap.xml", url, message: `sitemap.xml: ${url} is not the canonical address of a page without noindex` });
  }
  for (const [url, file] of indexable) {
    if (!listed.includes(url)) errors.push({ rule: "sitemap", file: "sitemap.xml", url, message: `sitemap.xml: ${url} (${file}) is missing` });
  }
  new Set(listed.filter((url, i) => listed.indexOf(url) !== i)).forEach((url) => {
    errors.push({ rule: "sitemap", file: "sitemap.xml", url, message: `sitemap.xml: ${url} is listed twice` });
  });
}

function checkWeight(siteDir, files, errors) {
  const limitOf = (file) => {
    if (file.endsWith(".html")) return LIMITS.page;
    if (path.dirname(file) !== "media") return null;
    if (/\.(mp4|webm)$/.test(file)) return LIMITS.video;
    if (file.endsWith(".webp")) return LIMITS.poster;
    return path.basename(file) === "og.jpg" ? LIMITS.ogImage : null;
  };
  for (const file of files) {
    const limit = limitOf(file);
    const size = fs.statSync(path.join(siteDir, file)).size;
    if (limit !== null && size > limit) {
      errors.push({ rule: "weight", file, message: `${file} is ${size} bytes, limit ${limit}` });
    }
  }
}

// Returns every error as { rule, file, message, url? }, [] when the site is fine.
// `root` holds site/ and README.md.
function checkSite(root = path.join(__dirname, "..")) {
  const siteDir = path.join(root, "site");
  const errors = [];
  const files = listFiles(siteDir);
  const pages = new Map(files.filter((file) => file.endsWith(".html")).map((file) => [file, parsePage(fs.readFileSync(path.join(siteDir, file), "utf8"))]));
  for (const [file, page] of pages) checkPage(siteDir, file, page, pages, errors);
  checkSitemap(siteDir, pages, errors);
  const robots = readIf(path.join(siteDir, "robots.txt")) ?? "";
  if (!new RegExp(`^Sitemap:\\s*${ORIGIN}/sitemap\\.xml\\s*$`, "mi").test(robots)) {
    errors.push({ rule: "robots", file: "robots.txt", message: `robots.txt has no line "Sitemap: ${ORIGIN}/sitemap.xml"` });
  }
  checkWeight(siteDir, files, errors);
  checkStoreLinks(root, pages, errors);
  return errors;
}

if (require.main === module) {
  const errors = checkSite();
  if (errors.length > 0) {
    console.error(`Site check failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  ${error.message}`);
    process.exit(1);
  }
  console.log("Site check passed.");
}

module.exports = { checkSite, sitemapUrls, ORIGIN, CSP, LIMITS };

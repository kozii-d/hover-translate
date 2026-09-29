const googleRunRu = require("../extension/test/fixtures/google-run-ru.json");
const bingLanguages = require("../extension/test/fixtures/bing-languages.json");

// The translators the extension talks to, answered in the browser by
// `context.route` — requests from the content script and from the service
// worker alike — in the shapes of `extension/test/fakeNetwork.ts`:
// - Google: its real answer for "run" → ru (recorded 2026-09-29), `[tl] text`
//   for any other text, or what `translations[tl][text]` of the test says;
// - Bing and DeepL: `text (bing)` / `text (deepl)`. DeepL takes only a key
//   ending in `:fx` (the free plan, on api-free.deepl.com) and refuses
//   `INVALID_KEY` with 403, as its documentation says.
// No request leaves the machine. A test replaces a host's answer with
// `network.answer(host, handler)`; `network.requests` lists what was asked.

const INVALID_DEEPL_KEY = "INVALID_KEY";

const json = (data, status = 200) => ({
  status,
  contentType: "application/json",
  // The content script asks Google from the page, so the answer needs CORS headers; Google sends them.
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(data),
});

const BING_TRANSLATOR_PAGE = `<html><script>_G={IG:"17D543C5CA5B4AAB88FA421EE4F683D8"};</script>
<div id="rich_tta" data-iid="translator.5023"></div>
<script>var params_AbusePreventionHelper = [1790666705661,"wS0GaaMm7ORXVXFbqSpBa_9uL0BNc1cW",3600000];</script></html>`;

const google = ({ url }, translations) => {
  const text = url.searchParams.get("q");
  const target = url.searchParams.get("tl");
  if (text === "run" && target === "ru") return json(googleRunRu);
  const translation = translations[target]?.[text] ?? `[${target}] ${text}`;
  return json({ sentences: [{ trans: translation, orig: text }], src: url.searchParams.get("sl") === "auto" ? "en" : url.searchParams.get("sl") });
};

const bing = ({ url, body }) => {
  if (url.pathname === "/translator") return { status: 200, contentType: "text/html", body: BING_TRANSLATOR_PAGE };
  if (url.pathname === "/ttranslatev3") {
    const form = new URLSearchParams(body);
    return json([{ detectedLanguage: { language: "en", score: 1 }, translations: [{ text: `${form.get("text")} (bing)`, to: form.get("to") }] }]);
  }
  return { status: 404, body: "Not found" };
};

const DEEPL_LANGUAGES = {
  source: ["AR", "DE", "EN", "ES", "FR", "JA", "RU", "UK"],
  target: ["AR", "DE", "EN-GB", "EN-US", "ES", "FR", "JA", "RU", "UK"],
};

const deepl = ({ url, headers, body }) => {
  const key = (headers.authorization ?? "").replace("DeepL-Auth-Key ", "");
  if (key === INVALID_DEEPL_KEY) return json({ message: "Forbidden" }, 403);
  if (key.endsWith(":fx") !== (url.host === "api-free.deepl.com")) return json({ message: "Wrong endpoint" }, 403);

  if (url.pathname === "/v2/usage") return json({ character_count: 1250, character_limit: 500000 });
  if (url.pathname === "/v2/languages") {
    const codes = DEEPL_LANGUAGES[url.searchParams.get("type") === "target" ? "target" : "source"];
    return json(codes.map((language) => ({ language, name: `DeepL ${language}` })));
  }
  if (url.pathname === "/v2/translate") {
    const { text } = JSON.parse(body);
    return json({ translations: [{ detected_source_language: "EN", text: `${text[0]} (deepl)` }] });
  }
  return { status: 404, body: "Not found" };
};

/** The fake translators of one test: their answers, the requests they got, and the answers the test replaced. */
function createFakeTranslators() {
  const requests = [];
  const overrides = {};
  const translations = {};

  const defaults = {
    "translate.googleapis.com": (request) => google(request, translations),
    "www.bing.com": bing,
    "api.cognitive.microsofttranslator.com": () => json(bingLanguages),
    "api-free.deepl.com": deepl,
    "api.deepl.com": deepl,
  };

  return {
    requests,
    /** The requests to one host, in order. */
    to: (host) => requests.filter((request) => request.url.host === host),
    /** Google's translation of `text` into `target`. */
    translate: (target, text, translation) => {
      translations[target] = { ...translations[target], [text]: translation };
    },
    /** `handler(request)` answers the host from now on: a `route.fulfill` object, or "abort" for a network failure. */
    answer: (host, handler) => {
      overrides[host] = handler;
    },
    handles: (host) => host in defaults,
    respond: (request) => {
      requests.push(request);
      return (overrides[request.url.host] ?? defaults[request.url.host])(request);
    },
  };
}

module.exports = { createFakeTranslators, INVALID_DEEPL_KEY };

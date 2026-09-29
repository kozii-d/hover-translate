/**
 * A `fetch` for every host the extension talks to, installed as
 * `globalThis.fetch` (ky calls it). Every request is recorded with its body.
 *
 * The body is always read: ky waits for it after a POST, and a fake that
 * leaves it unread makes the request hang.
 *
 * The answers:
 * - the extension's own files (`chrome-extension://…/_locales/…`) from the
 *   repository, for the popup's i18next backend;
 * - Google: the real answers for "run" → ru and "猫" → en (`fixtures/`,
 *   recorded 2026-09-29, dictionary cut short), an echo for any other text,
 *   and 400 for a language Google does not list, as the live service does;
 * - Bing (`www.bing.com`) and DeepL: only with their host permission granted
 *   in the fake `chrome` — without it the browser fails the request with a
 *   TypeError, as here. Bing's page carries the credentials in the shape
 *   `bing.ts` parses; its translation and language list are in the shape of
 *   the live answers. DeepL follows its documentation: `:fx` keys belong to
 *   api-free.deepl.com and get 403 "Wrong endpoint" on the other host, and
 *   `INVALID_KEY` is refused everywhere.
 *
 * `routes` replaces the answer for a host: return a Response, or undefined to
 * fall through to the default one.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./fakeChrome.ts";
import bingLanguages from "./fixtures/bing-languages.json";
import googleCatJa from "./fixtures/google-cat-ja.json";
import googleRunRu from "./fixtures/google-run-ru.json";

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
  signal: AbortSignal;
}

export type Route = (request: RecordedRequest) => Response | undefined | Promise<Response | undefined>;

export const INVALID_DEEPL_KEY = "INVALID_KEY";

/** DeepL's lists from its documentation ("Retrieve supported languages"), in its upper-case spelling. */
export const DEEPL_SOURCE_LANGUAGES = ["AR", "BG", "CS", "DA", "DE", "EL", "EN", "ES", "ET", "FI", "FR", "HE", "HU",
  "ID", "IT", "JA", "KO", "LT", "LV", "NB", "NL", "PL", "PT", "RO", "RU", "SK", "SL", "SV", "TH", "TR", "UK", "VI", "ZH"];
export const DEEPL_TARGET_LANGUAGES = ["AR", "BG", "CS", "DA", "DE", "EL", "EN-GB", "EN-US", "ES", "ES-419", "ET", "FI",
  "FR", "HE", "HU", "ID", "IT", "JA", "KO", "LT", "LV", "NB", "NL", "PL", "PT-BR", "PT-PT", "RO", "RU", "SK", "SL", "SV",
  "TH", "TR", "UK", "VI", "ZH", "ZH-HANS", "ZH-HANT"];

export const BING_TRANSLATOR_PAGE = `<html><script>_G={IG:"17D543C5CA5B4AAB88FA421EE4F683D8"};</script>
<div id="rich_tta" data-iid="translator.5023"></div>
<script>var params_AbusePreventionHelper = [1790666705661,"wS0GaaMm7ORXVXFbqSpBa_9uL0BNc1cW",3600000];</script></html>`;

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const googleLanguages = JSON.parse(fs.readFileSync(
  path.join(REPO_ROOT, "extension/src/common/translators/google/availableLanguages.json"), "utf8"));
const googleSources = new Set(["auto", ...googleLanguages.sourceLanguages.map((language: { code: string }) => language.code)]);
const googleTargets = new Set(googleLanguages.targetLanguages.map((language: { code: string }) => language.code));

const extensionFile = (request: RecordedRequest) => {
  const file = path.join(REPO_ROOT, decodeURIComponent(request.url.pathname));
  return fs.existsSync(file)
    ? new Response(fs.readFileSync(file), { headers: { "Content-Type": "application/json" } })
    : new Response("Not found", { status: 404 });
};

const google = ({ url }: RecordedRequest) => {
  const text = url.searchParams.get("q") ?? "";
  if (!googleSources.has(url.searchParams.get("sl")) || !googleTargets.has(url.searchParams.get("tl"))) {
    return new Response("Bad Request", { status: 400 });
  }
  if (text === "run" && url.searchParams.get("tl") === "ru") return json(googleRunRu);
  if (text === "猫" && url.searchParams.get("tl") === "en") return json(googleCatJa);
  return json({ sentences: [{ trans: `${text} (google)`, orig: text }], src: "en" });
};

const bing = ({ url, body }: RecordedRequest) => {
  if (url.pathname === "/translator") return new Response(BING_TRANSLATOR_PAGE, { headers: { "Content-Type": "text/html" } });
  if (url.pathname === "/ttranslatev3") {
    const form = new URLSearchParams(body);
    return json([{
      detectedLanguage: { language: "en", score: 1 },
      translations: [{ text: `${form.get("text")} (bing)`, to: form.get("to") }],
    }]);
  }
  return new Response("Not found", { status: 404 });
};

const deepl = ({ url, headers, body }: RecordedRequest) => {
  const key = headers.get("Authorization")?.replace("DeepL-Auth-Key ", "") ?? "";
  if (key === INVALID_DEEPL_KEY) return json({ message: "Forbidden" }, 403);
  const freeKey = key.endsWith(":fx");
  if (freeKey !== (url.host === "api-free.deepl.com")) return json({ message: "Wrong endpoint" }, 403);

  if (url.pathname === "/v2/usage") return json({ character_count: 1250, character_limit: 500000 });
  if (url.pathname === "/v2/languages") {
    const codes = url.searchParams.get("type") === "target" ? DEEPL_TARGET_LANGUAGES : DEEPL_SOURCE_LANGUAGES;
    return json(codes.map((language) => ({ language, name: `DeepL ${language}` })));
  }
  if (url.pathname === "/v2/translate") {
    const { text } = JSON.parse(body) as { text: string[] };
    return json({ translations: [{ detected_source_language: "EN", text: `${text[0]} (deepl)` }] });
  }
  return new Response("Not found", { status: 404 });
};

const DEFAULT_ROUTES: Record<string, Route> = {
  "translate.googleapis.com": google,
  "www.bing.com": bing,
  "api.cognitive.microsofttranslator.com": () => json(bingLanguages),
  "api-free.deepl.com": deepl,
  "api.deepl.com": deepl,
};

/** Hosts behind an optional permission: unreachable until it is granted. */
const OPTIONAL_HOSTS = ["www.bing.com", "api-free.deepl.com", "api.deepl.com"];

export interface FakeNetwork {
  requests: RecordedRequest[];
  /** The requests to one host, in order. */
  to: (host: string) => RecordedRequest[];
}

export function installFakeNetwork(routes: Record<string, Route> = {}): FakeNetwork {
  const requests: RecordedRequest[] = [];

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    const body = new TextDecoder().decode(await request.clone().arrayBuffer());
    const recorded: RecordedRequest = { method: request.method, url: new URL(request.url), headers: request.headers, body, signal: request.signal };
    requests.push(recorded);

    if (request.signal?.aborted) throw request.signal.reason;

    const { host, protocol } = recorded.url;
    if (protocol === "chrome-extension:" || protocol === "moz-extension:") return extensionFile(recorded);

    if (OPTIONAL_HOSTS.includes(host) && !(await chrome.permissions.contains({ origins: [`https://${host}/*`] }))) {
      throw new TypeError("Failed to fetch");
    }

    const answer = await routes[host]?.(recorded) ?? await DEFAULT_ROUTES[host]?.(recorded);
    if (!answer) throw new TypeError(`Failed to fetch: no fake route for ${request.url}`);
    return answer;
  };

  globalThis.fetch = fakeFetch as typeof fetch;

  return {
    requests,
    to: (host) => requests.filter((request) => request.url.host === host),
  };
}

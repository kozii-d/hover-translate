/**
 * The one stand-in for `chrome.*` in the tests of both packages: the popup's
 * Vitest config reaches it through the `@extension-test` alias.
 *
 * `chrome` is the browser's own global in the extension (no polyfill), so the
 * tests set `globalThis.chrome` — `test/setup.ts` installs a fresh one before
 * every test — rather than mocking a module.
 *
 * It behaves like the oldest browsers the extension supports (Chrome 102,
 * Firefox 115) where they differ from the newest: a `runtime.onMessage`
 * listener answers only through `sendResponse` (at once, or later after
 * `return true`), and a promise it returns is ignored, as Chrome did before
 * 147. `fakeChrome.test.ts` pins down where it has to match the browser.
 *
 * No npm imports here, only Node's: in the popup's tests a package imported
 * from this file would come from `extension/node_modules`, a second copy.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const CHROME_WEB_STORE_ID = "jbddomeagbjjdoaehkdffdhifdhnmfic";
export const EDGE_ADD_ONS_ID = "emnbmkhbohfjmbkdipkppnbdlhgnhmhm";
export const UNPACKED_ID = "abcdefghijklmnopabcdefghijklmnop";

type Items = Record<string, unknown>;
type StorageChange = { oldValue?: unknown; newValue?: unknown };
type ChangeListener = (changes: Record<string, StorageChange>, areaName: string) => void;
type MessageListener = (message: unknown, sender: object, sendResponse: (response: unknown) => void) => unknown;
type InstalledListener = (details: { reason: string; previousVersion?: string }) => void;

export interface FakeChromeOptions {
  sync?: Items;
  local?: Items;
  session?: Items;
  /** `false`: a browser without `storage.session` (Chrome before 102). */
  hasSessionStorage?: boolean;
  /** `chrome.i18n.getUILanguage()`; `getMessage` reads the matching `_locales` directory. */
  uiLanguage?: string;
  /** `chrome.runtime.id`: the store the copy was installed from. */
  id?: string;
  /** `moz-extension` for Firefox, whose URLs tell AMO. */
  scheme?: "chrome-extension" | "moz-extension";
  /** Host permissions already granted, e.g. `https://www.bing.com/*`. */
  grantedOrigins?: string[];
  /** The viewer's answer to a permission prompt; granted origins are then kept. */
  answerPermissionPrompt?: (origins: string[]) => boolean;
}

export interface FakeChrome {
  chrome: typeof chrome;
  /** The stored values, to seed and to inspect. */
  storage: { sync: Items; local: Items; session: Items };
  grantedOrigins: Set<string>;
  /** Every `tabs.create`, with the synced storage as it was at that moment. */
  createdTabs: { url?: string; sync: Items }[];
  permissionPrompts: string[][];
  /** Fires `runtime.onInstalled`, as the browser does on install and update. */
  fireInstalled: (details: { reason: string; previousVersion?: string }) => void;
}

const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

/** The `_locales` directory the browser would pick for a UI language: `pt-BR` → `pt_BR`, `de-AT` → `de`. */
export const localeDirectoryFor = (uiLanguage: string): string => {
  const exact = uiLanguage.replace("-", "_");
  const candidates = [exact, exact.split("_")[0], "en"];
  return candidates.find((candidate) => fs.existsSync(path.join(REPO_ROOT, "_locales", candidate, "messages.json")))!;
};

type ChromeMessages = Record<string, { message: string; placeholders?: Record<string, { content: string }> }>;

const readMessages = (locale: string): ChromeMessages =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "_locales", locale, "messages.json"), "utf8"));

/** `chrome.i18n.getMessage`: named placeholders, then `$1`…`$9`; English when the locale lacks the key. */
const createGetMessage = (uiLanguage: string) => {
  const messages = readMessages(localeDirectoryFor(uiLanguage));
  const english = readMessages("en");

  return (name: string, substitutions?: string | string[]): string => {
    const entry = messages[name] ?? english[name];
    if (!entry) return "";

    const values = substitutions === undefined ? [] : [substitutions].flat();
    const withPlaceholders = entry.message.replace(/\$([A-Za-z0-9_@]+)\$/g, (match, placeholder: string) =>
      entry.placeholders?.[placeholder.toLowerCase()]?.content ?? match);

    return withPlaceholders.replace(/\$(\d)/g, (_, index: string) => values[Number(index) - 1] ?? "");
  };
};

function createStorageArea(name: string, store: Items, changeListeners: ChangeListener[]) {
  const get = (keys?: string | string[] | Items | null): Items => {
    if (keys === null || keys === undefined) return clone(store);

    const wanted = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const defaults = typeof keys === "object" && !Array.isArray(keys) ? keys : {};
    const result: Items = {};
    for (const key of wanted) {
      if (key in store) result[key] = clone(store[key]);
      else if (key in defaults) result[key] = defaults[key];
    }
    return result;
  };

  const notify = (changes: Record<string, StorageChange>) => {
    if (!Object.keys(changes).length) return;
    for (const listener of [...changeListeners]) listener(changes, name);
  };

  // Like Chromium: a key written with the value it already had is not a change.
  const set = (items: Items) => {
    const changes: Record<string, StorageChange> = {};
    for (const [key, value] of Object.entries(items)) {
      if (key in store && isDeepStrictEqual(store[key], value)) continue;
      changes[key] = { oldValue: clone(store[key]), newValue: clone(value) };
      store[key] = clone(value);
    }
    notify(changes);
  };

  const remove = (keys: string | string[]) => {
    const changes: Record<string, StorageChange> = {};
    for (const key of [keys].flat()) {
      if (!(key in store)) continue;
      changes[key] = { oldValue: clone(store[key]) };
      delete store[key];
    }
    notify(changes);
  };

  // Both call styles, answered a turn later as by a real storage backend:
  // `StorageService` passes a callback, other code awaits the promise.
  const both = <A, R>(operation: (argument: A) => R) => (argument: A, callback?: (result: R) => void) => {
    const settled = new Promise<R>((resolve) => setTimeout(() => resolve(operation(argument)), 0));
    if (!callback) return settled;
    settled.then(callback);
    return undefined;
  };

  return { get: both(get), set: both(set), remove: both(remove) };
}

const addRemove = <T>(listeners: T[]) => ({
  addListener: (listener: T) => listeners.push(listener),
  removeListener: (listener: T) => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  },
  hasListener: (listener: T) => listeners.includes(listener),
});

export function createFakeChrome(options: FakeChromeOptions = {}): FakeChrome {
  const storage = {
    sync: clone(options.sync ?? {}),
    local: clone(options.local ?? {}),
    session: clone(options.session ?? {}),
  };
  const changeListeners: ChangeListener[] = [];
  const messageListeners: MessageListener[] = [];
  const installedListeners: InstalledListener[] = [];
  const grantedOrigins = new Set(options.grantedOrigins ?? []);
  const createdTabs: FakeChrome["createdTabs"] = [];
  const permissionPrompts: string[][] = [];
  const id = options.id ?? CHROME_WEB_STORE_ID;
  const scheme = options.scheme ?? "chrome-extension";
  const uiLanguage = options.uiLanguage ?? "en-US";
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "manifest.chrome.json"), "utf8"));

  const sendMessage = async (message: unknown) => {
    for (const listener of messageListeners) {
      let responded = false;
      let respond!: (response: unknown) => void;
      const response = new Promise((resolve) => {
        respond = (value) => {
          responded = true;
          resolve(value);
        };
      });
      // Answered at once, or later after `return true`; a returned promise is not an answer.
      if (listener(clone(message), { id }, respond) === true || responded) return clone(await response);
    }
    // No listener answered or kept the channel open: the sender gets nothing.
    return undefined;
  };

  const fake = {
    storage: {
      sync: createStorageArea("sync", storage.sync, changeListeners),
      local: createStorageArea("local", storage.local, changeListeners),
      ...(options.hasSessionStorage === false ? {} : { session: createStorageArea("session", storage.session, changeListeners) }),
      onChanged: addRemove(changeListeners),
    },
    runtime: {
      id,
      lastError: undefined,
      getURL: (resource: string) => `${scheme}://${id}/${resource.replace(/^\//, "")}`,
      getManifest: () => clone(manifest),
      sendMessage,
      onMessage: addRemove(messageListeners),
      onInstalled: addRemove(installedListeners),
    },
    i18n: {
      getUILanguage: () => uiLanguage,
      getMessage: createGetMessage(uiLanguage),
    },
    permissions: {
      contains: async ({ origins = [] }: { origins?: string[] }) => origins.every((origin) => grantedOrigins.has(origin)),
      request: async ({ origins = [] }: { origins?: string[] }) => {
        permissionPrompts.push(origins);
        const granted = options.answerPermissionPrompt?.(origins) ?? false;
        if (granted) origins.forEach((origin) => grantedOrigins.add(origin));
        return granted;
      },
    },
    tabs: {
      create: async ({ url }: { url?: string }) => {
        createdTabs.push({ url, sync: clone(storage.sync) });
        return { id: createdTabs.length };
      },
    },
    action: {
      openPopup: async () => {},
    },
  };

  return {
    chrome: fake as unknown as typeof chrome,
    storage,
    grantedOrigins,
    createdTabs,
    permissionPrompts,
    fireInstalled: (details) => installedListeners.forEach((listener) => listener(details)),
  };
}

/** Replaces `globalThis.chrome` with a new fake and returns it. */
export function installFakeChrome(options: FakeChromeOptions = {}): FakeChrome {
  const fake = createFakeChrome(options);
  (globalThis as { chrome?: unknown }).chrome = fake.chrome;
  return fake;
}

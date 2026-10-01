# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HoverTranslate — a Manifest V3 browser extension (Chrome, Firefox, Edge) that translates YouTube subtitle words on hover. Hovering a word shows a tooltip translation; Shift-select spans multiple words; results can be saved to a local dictionary and exported. Published on all three stores; `CHANGELOG.md` tracks releases.

## Repository Layout

Three independently-installed npm packages plus shared static assets:

- **`extension/`** — content script + background service worker (plain TypeScript, Vite, no framework)
- **`popup/`** — extension popup UI (React 19, MUI 7, React Router 7, i18next, Vite)
- **`_locales/<lang>/*.json`** — 24 languages, split into namespaces (`messages`, `settings`, `customize`, `dictionary`, `about`, `common`, `modals`, `languages`). Shared by both i18n systems (see i18n below).
- **`manifest.{chrome,edge,firefox}.json`** — `npm run setup:<browser>` copies one to `manifest.json` (gitignored, generated)
- **`scripts/`** — `archive.js` (store zips/xpi), `create-source-archive.js` (Firefox source submission), `update-amo-listing.js`
- **`docs/`** — only the GIFs the README shows
- **`extension/test/`, `popup/test/`, `scripts/*.test.js`, `e2e/`** — the tests, the fake `chrome` and the fake network, the end-to-end tests in Chromium (see "Testing"); `.husky/`, `.lintstagedrc.json` (root and both packages) and `.github/workflows/ci.yml` — the git hooks and CI
- **`.claude/`** — how agents work on this repository: `skills/` (`/task`, `/do`, `/release`), `agents/` (`implementer`, `reviewer`), `settings.json` (what agents may and may not run). Only these are in git; everything else there is local
- **`work/`** — every working document: `backlog.md` (what to do), `decisions.md` (what was decided and why), `tasks/NN-*.md` (open tasks), reports, `analytics/` (store statistics exported from the dashboards), and `runs/NN/` (a task's throwaway scripts, downloads and logs, deleted when the task is done). **Write these into `work/`, never into the repository root or `docs/`.** The folder is gitignored as a whole (private material in a public repo), which also keeps it out of the Firefox source archive, so nothing in it needs its own pattern

## Commands

```bash
npm ci                           # must be run in root, extension/, AND popup/ separately

npm run setup:chrome             # or setup:edge / setup:firefox — do this ONCE first
npm run watch                    # all three watch builds in parallel
npm run build                    # production build (extension + popup)
npm run build:dev                # unminified

npm test                         # all tests: scripts/ (node:test), extension/ and popup/ (Vitest)
npm run test:e2e                 # the built extension in Chromium on local YouTube pages (Playwright); after `npm run build`, not part of verify
                                 # once per machine and Playwright version: npx playwright install chromium
npm run verify                   # lint, typecheck, tests with the coverage thresholds, check:listing, check:version — run it before you finish
npm run lint                     # both packages (each also has lint / lint:fix / test:watch / typecheck / coverage)

npm run check:listing            # offline store-listing limits; first step of release* and update:amo
npm run check:version            # the version is the same in package.json, the lockfile and the 3 manifests
npm run version:set -- 1.2.0      # version in package.json, lockfile and all manifests
npm run release                  # build + all 3 store archives + source archive
npm run release:firefox          # single-browser archive; output lands in releases/<version>/
npm run update:amo               # push the AMO listing's name, summary and description (needs AMO_* keys in .env)
npm run update:language-names    # download Google Translate's language names again into _locales/*/languages.json
```

Dev loop: `npm run setup:<browser>`, `npm run watch`, then load the **repo root** (not `extension/`) as an unpacked extension. The manifest points at the built bundles inside `extension/dist/` and `popup/dist/`.

## Working with agents

- `/task <idea>` — research and a task file in `work/tasks/`, no code. `/do <NN>` — the `implementer` agent does it, the `reviewer` agent checks it, findings marked `[исправить]` go back to the implementer (two rounds at most), `[решить]` to the user. `/release <version>` — the release checklist.
- The user commits: agents never commit, push or touch uncommitted changes (`.claude/settings.json` denies it). A task the user has committed: its file and backlog line are deleted, a decision worth keeping goes into `work/decisions.md`.
- Everything written into `work/` is in Russian, so the user can check it; everything in git stays in English.

## Testing

**A change of behaviour comes with a test that fails before the change and passes after it** — run it on the unchanged code first and see it fail. `npm run verify` passes before the work is done.

**Extend the suite, never rebuild it.** The fakes, fixtures and helpers below took most of the effort; a task that writes its own copy wastes it and drifts from the real one.

- **Add cases to the test file that already covers the module** (map below). A new file only for a module that has none, next to the others and on the same helpers.
- **Never write a local fake** of `chrome`, `fetch`, the popup's rendering or a YouTube page. When a test needs something the shared ones cannot do, extend `extension/test/fakeChrome.ts`, `extension/test/fakeNetwork.ts`, `popup/test/renderPopup.tsx`, `e2e/extension.js` or `e2e/fixtures/player.js`, and cover the new ability in `extension/test/fakeChrome.test.ts` (or the spec that first needs it).
- **Pick the layer by what changed:** pure logic → `extension/test/common/` or `content/`; the service worker → `extension/test/background/`; the popup → `popup/test/`; anything the content script does on the player (hover, Shift, clicks, auto-pause, caption DOM, notifications, the rating card, the embedded player's layer, right-to-left lines) → `e2e/`; `scripts/` → `node:test` next to the script.
- **Never weaken a test to make a change pass**: no deleting, `.skip`/`.only`, loosened assertions, longer timeouts or `waitForTimeout`. The one timeout set on purpose is the popup's `asyncUtilTimeout` in `popup/test/setup.ts` (a file's first render is cold); never raise it, or a `timeout` of one test, to make a test pass. When behaviour changes on purpose, change the test in the same commit and say why. A test that fails unexpectedly is a finding — find out why before touching it.
- **Run** `npm run verify` always, and `npm run test:e2e` (needs `npm run build` first) whenever the change touches `extension/src/content/`, `extension/src/common/`, the manifests or the popup's settings flow — it is not part of `verify`, CI runs it.
- What these tests cannot reach — live YouTube, real browsers and their updates, research — is run by hand in `work/runs/<task>/` and deleted with it (recipes for Brave and LibreWolf: `.claude/agents/implementer.md`; the live checks before a release: the `/release` skill). A finding there that the fixtures can express ends as a test here.

| Area | Test file |
|---|---|
| Language matching (`findClosestLanguage`, `findUserLanguage`) | `extension/test/common/findClosestLanguage.test.ts` |
| Rating prompt conditions, store by install | `extension/test/common/ratingPrompt.test.ts` |
| `StorageService` | `extension/test/common/storageService.test.ts` |
| Error envelope | `extension/test/common/translatorError.test.ts` |
| Google / Bing / DeepL / replacement | `extension/test/common/translators/*.test.ts` |
| Translation cache, context key | `extension/test/content/translationCore.test.ts` |
| Word segmentation | `extension/test/content/wordSegmenter.test.ts` |
| Messages, install/update, migrations | `extension/test/background/{messageService,settingsService,migrations}.test.ts` |
| Popup: mounting per language, settings and translators, export | `popup/test/{app,settings,export}.test.tsx` |
| On the player: hover, clicks, captions, embed, errors, rating card, popup→page; the popup's width on every page, the tab labels in every language | `e2e/{hover,click,captions,embed,errors,rating,popup}.spec.js` |
| Listing limits, version, AMO listing body, source archive, language names | `scripts/{check-listing,set-version,update-amo-listing,create-source-archive,update-language-names}.test.js` |

- Tests live outside `src`, so they never reach a bundle: `extension/test/**/*.test.ts`, `popup/test/**/*.test.tsx`, `scripts/*.test.js` (`node:test`: the scripts are CommonJS in the root package, which has no Vitest). `extension/` runs in `node`; a file that needs a DOM starts with `// @vitest-environment jsdom`. `popup/` runs in jsdom and mounts the real `App` through `popup/test/renderPopup.tsx`.
- **`chrome` is faked as the global it is**, not as a module: `extension/test/fakeChrome.ts` (`installFakeChrome({ sync, local, uiLanguage, id, scheme, grantedOrigins, answerPermissionPrompt, hasSessionStorage })`; `test/setup.ts` installs an empty one before every test). Storage in both call styles with `onChanged`, `getMessage` from the real `_locales`, permissions, `tabs.create` recorded with the synced storage of that moment. A message is answered only through `sendResponse` and `return true`, as in Chrome before 147: for the background, create the real `MessageService` in the same process. The popup reaches the file through the `@extension-test` alias, so it imports nothing from npm (that would be a second copy of the package).
- **No test reaches the network**: `extension/test/fakeNetwork.ts` is `globalThis.fetch` — Google's real answers (`test/fixtures/`), Bing and DeepL in their live and documented shapes, the optional hosts unreachable until the fake grants their permission; `installFakeNetwork({ [host]: route })` replaces one host. It reads every request body: ky hangs on a POST otherwise.
- The Vitest configs extend the build ones: `extension/vite.base.config.ts` is shared by both bundles and the tests, `popup/vitest.config.ts` merges `vite.config.ts`. A change to them must leave `extension/dist` and `popup/dist` byte for byte the same.
- Layer 1 (pure logic: languages, error envelope, rating prompt, word segmenter, migrations, translation cache, `StorageService.update()`, the three translators, replacement and withdrawn ones, `check-listing`, `set-version`). Its modules in `extension/` have a per-file threshold in `extension/vitest.config.ts`, 90 % of lines and branches (`tooltipThemeMigrationsService.ts`: lines only, it has no migration yet), checked by `verify`; no threshold for the whole, none for `scripts/` (`node:test` measures nothing). Layer 2: `MessageService`, `SettingsService` on install and update, the popup in en/ru/ja/ar, switching to Bing, the fallback without its permission, the rating card, the dictionary export.
- Layer 3, `e2e/*.spec.js` (Playwright, `npm run test:e2e`, ~20 s; CommonJS like `scripts/`, config in `playwright.config.js`): the content script on a YouTube page. The build (`npm run build`) is copied with `manifest.chrome.json` and loaded into Playwright's Chromium, a fresh profile per test. `e2e/extension.js` answers requests through `context.route`: `e2e/fixtures/watch.html` and `embed.html` at `https://www.youtube.com/watch` and `/embed/` (the embed inside a page of another site), the translators in `e2e/translators.js`. Nothing reaches the network because no host name resolves (`--host-resolver-rules`) — `context.route` does not see everything: the Chrome Web Store tab "Rate" opens gets an error page, and the tests check the address the extension asked `chrome.tabs.create` for. The test drives the captions through `window.fixture` (`fixtures/player.js`: show, replace, grow by a word and roll up as auto-generated captions do, two windows, top, right to left, drag the window either way) and reads `chrome.storage` through the service worker. An optional host permission cannot be granted in a headless browser (the prompt is a dialog): `test.use({ grantedHosts })` moves the host to `host_permissions` in the copy. No `waitForTimeout`: wait for a condition (`expect.poll`, `waitForFunction`).
- The fixtures copy the markup of the live player — classes, nesting, position, z-index, pointer-events, sizes; the date is in each file. When YouTube changes it: `node e2e/youtube-dom/capture.js` (live YouTube, ~2 min) rewrites `e2e/youtube-dom/captured/` (the watch page, the embedded player with its controls layer, how auto-generated captions grow); read its `git diff` and bring the fixtures in line. YouTube's caption window has been seen following a drag two ways — the browser's own drag and drop (`pointercancel` at its start, in Playwright's Chromium) and the page's script on `mousemove`, after the browser has placed the pointer, so it leaves and re-enters the window on every step and the word gets no `pointermove` (Brave over plain CDP); `fixture.dragOn()` picks one, and the drag tests run on both: only the `mousemove` one reaches the extension's drag handling.

**Git hooks** (husky, installed by `npm ci` in the root). pre-commit, a few seconds: every package has its `node_modules`; no force-added `manifest.json`, `.env` (in any directory), `releases/`, `work/` or `.claude/settings.local.json`; `check:listing` on the whole listing (lint-staged never sees a deleted file); lint-staged — `eslint --max-warnings=0` and JSON validity on the staged files of each package (`extension/.lintstagedrc.json`, `popup/.lintstagedrc.json`; `tsconfig*.json` has comments and is left out), and from the root `.lintstagedrc.json` JSON validity and `check:version` for the files that carry the version. pre-push: `npm run verify` — on the working tree, not on the commits being pushed: a broken commit goes out if its fix sits uncommitted; CI catches it.

**CI** (`.github/workflows/ci.yml`, every push and pull request, no secrets): Node from `.nvmrc`, `npm ci` in the three packages, `verify` (its coverage report uploaded as an artifact, also when a step failed), `release` (the three store packages), `web-ext lint` on the Firefox package through `npx` at a pinned version, then `test:e2e` on that build (Playwright's Chromium cached by its version; traces and screenshots of failed tests uploaded as `e2e-results`). Actions are pinned to a commit.

## Architecture

### Content script pipeline (`extension/src/content/`)

The whole feature is one chain — understanding it top to bottom is usually necessary before changing any single piece:

1. `content.ts` first decides whether this frame is worth anything at all (`canHostPlayer()`), then reads `settings.translator` from sync storage, builds a translator via `TranslatorFactory`, and wires up the objects below. The script is injected into every youtube.com frame (`all_frames: true`, for players embedded on other sites): the top frame always passes (YouTube is an SPA), a subframe only when its path is a player — the reasons are in the comment above `canHostPlayer()`; don't narrow the manifest `matches` instead. Nothing below runs in a rejected frame, so keep module-level side effects out of the pipeline modules.
2. `services/mutationObserverService.ts` watches YouTube's `.ytp-caption-window-container` for new `.ytp-caption-segment` nodes (with retry when the player isn't ready yet), and also re-arms itself on SPA URL changes and tab visibility changes.
3. `core/subtitleCore.ts` `splitCaptionIntoSpans()` replaces each caption segment's text with one `<span class="custom-tooltip-word">` per word, attaching pointer handlers. Click behavior is drag-guarded (5px threshold) so dragging the caption box doesn't trigger `state.settings.leftClickAction`. The words come from `utils/wordSegmenter.ts`: whitespace first, then `Intl.Segmenter` for scripts without spaces (Han, kana, Thai, Lao, Myanmar, Khmer), whole runs where it is missing. Each span renders its word plus its `separator`, and `tooltipService.getSelectedText()` joins by those separators, not by a space. That separator is load-bearing for auto-generated captions — read the comments in `wordSegmenter.ts` before changing it.
4. `services/tooltipService.ts` (the largest file) owns hover state (`selectedWordsNodes`, first/last selected node), builds & positions the tooltip, applies theme (`utils/tooltipTheme.ts`), and implements save-to-dictionary / copy-to-clipboard. Its notifications ("Translation saved", errors) are placed at the top-left of the visible part of the player the word belongs to, scroll included — never from `document.querySelector("video")`, which can be a thumbnail preview. The tooltip, the notifications and the rating card take their direction from their own text (`dir="auto"`), never from the page (YouTube in Arabic is `rtl`) nor from `@@bidi_dir` (the browser's language, which gets English messages when the extension has no locale for it). In a right-to-left caption line the first selected word is the rightmost, so the tooltip ends at its right edge.
5. `core/translationCore.ts` resolves text → translation through a `QuickLRU` cache (5000 entries) keyed by `text_sourceLang_targetLang_translatorKey`, persisted to `local` storage under `translationCache`, falling through to the translator on miss.
6. `core/videoController.ts` handles auto-pause on hover.
7. `services/coveredCaptionPointerService.ts`, created and destroyed by `MutationObserverService`: YouTube's new embedded player (2026) draws its controls layer `#player-controls` over the captions, so the words get no pointer events at all. Capture-phase listeners on the document find the word under the pointer with `elementsFromPoint`, forward it the pointer events the browser would have sent, and keep that click from the player. They act only when the event went to that layer (`PLAYER_CONTROLS_LAYER` in `consts.ts`) and not to one of its buttons, links or sliders; anything else over the captions (player chrome, dialogs, menus) is left alone on purpose, and no CSS can lift the captions instead — the file's comments explain both.
8. `services/ratingPromptService.ts`: the request for a rating on the video, once ever, offered by `TooltipService` when nothing failed on the page — on the save that brings the list to ten words, or on a translation once `TranslationCore` caches thirty (for viewers who hover and never save). A card of its own (not the notification: that one has `pointer-events: none` and is replaced by the next save) in the player's corner away from the captions, shown only where it fits and recorded only once it is on screen; it goes after 10 s counted only while the video plays (or has ended) with neither the pointer nor the focus on it, follows the player's size (fullscreen, theatre mode) through a `ResizeObserver`, and is removed by `MutationObserverService` when YouTube moves to another page. The pointer on it pauses the video through `VideoController.pauseVideo()` — the same claim as the captions — and "Rate" leaves it paused (`keepPaused()`) and asks the background to open the store page (`openReviewPage`). When either card may appear and which store page "Rate" opens are pure functions in `common/ratingPrompt.ts`, shared with the popup's card (`features/RatingPrompt`, in the slot of the Settings page tips) and the About page. The store is told by the install — `moz-extension://`, or the Chrome Web Store / Edge Add-ons id — not by the browser; an unpacked build without the Chrome `key` belongs to no store and is never asked.

YouTube DOM class names live in `content/consts/consts.ts` — never hardcode them inline.

`content/state/stateManager.ts` exports a singleton `state` holding `settings` and `tooltipTheme`. `state.init()` (called by `content.ts` once the frame passes `canHostPlayer()`, idempotent) seeds it from sync storage and subscribes to `chrome.storage.onChanged`, so popup edits propagate live without a page reload. That work is deliberately *not* in the constructor: the module is imported by the whole pipeline, so the singleton exists in every injected frame, including the ones that build nothing. Read settings via `state.settings`, not by re-querying storage.

### Background service worker (`extension/src/background/`)

Only two live services: `SettingsService` (install/update lifecycle + migrations) and `MessageService` (`chrome.runtime.onMessage` for `getAvailableLanguages`, `translate`/`abortTranslate` from `ProxyTranslator`, `hasPermissions`/`claimSessionNotice` from the content script (see "Translators"), `openReviewPage` from the rating card on the video, and `verifyApiKey`/`getApiKeyUsage`/`setApiKey`/`removeApiKey` from the popup).

The background answers every message through `sendResponse` (a value, never a rejection), so a handler that fails answers with `{ translatorError: { code, message } }` (`serializeTranslatorError`), and the two senders — `sendMessageToBackground` (content script) and the popup's `sendMessage` — turn it back into an error with `unwrapTranslatorResponse` (both in `common/translators/translatorError.ts`); callers just see a rejection. The `code` (`api-key-missing`, `api-key-invalid`, `quota-exceeded`, `rate-limited`, `permission-missing`, `unsupported-language`, `network`, `service-unavailable`) is what lets the tooltip (`messages.json` `error*` keys, `$TRANSLATOR$` placeholder) and the popup (`settings.json` `errors.translator.*`) say what went wrong. A new message goes through the same `reply()` in `MessageService` and one of the two senders.

### Translators (`extension/src/common/translators/`)

`TranslatorFactory.create(key)` → `BaseTranslator` subclass. `google`, `bing` and `deepl` are registered.

A translator taken out of a release is listed in `WITHDRAWN_TRANSLATORS` (`withdrawnTranslators.ts`) with its replacement: the factory builds the replacement for it, wrapped in `ReplacementTranslator` (so a viewer who still has it in the synced settings keeps getting translations; the wrapper carries the withdrawn translator's language codes over to the replacement's with `matchSelectedLanguages`), the popup leaves it out of the list, and the settings page moves a viewer who had it selected to the replacement with the `errors.translatorWithdrawn` notice. Nothing is withdrawn now.

**Bing without access to its host translates through Google.** `https://www.bing.com/*` is an optional permission, and a viewer can have `bing` in the synced settings without it. `BingTranslator` checks `permissions.contains` before every request and throws `permission-missing` without it. `content.ts` asks the background (`hasPermissions`) once, when it builds the pipeline: without access it builds `ReplacementTranslator(Google)` instead of Bing and has `TooltipService.showWithFirstTranslation()` show `noticePermissionFallback` with the first translation, once per browser session (`claimSessionNotice`, recorded in `session` storage). The decision is not revisited on that page: granting access in the settings saves Bing again, which rebuilds the pipeline; granting it anywhere else (the browser's extension page) takes effect on the next page load, and access revoked mid-page shows `errorPermissionMissing` until then. The settings page, opened with Bing selected and no access, cannot prompt (a prompt needs a user gesture), so it moves the viewer to Google with `errors.translatorPermissionFallback`, which says that picking Bing in the list is how to allow it.

Translators that work with the viewer's own API key extend `ApiKeyTranslator` (`apiKeyTranslator.ts`): the key is read from `ApiKeyService` on every call (never from settings), they implement `verifyApiKey()` and `getUsage()`, and they fall back to the last language lists they returned (`translatorLanguages`) when the service is unreachable — never when the key was rejected. `apiKeyProviders.ts` holds what the popup needs about each one (sign-up URL, origins, plan detection) without pulling in the HTTP client. **Adding another key-based provider** is: an `ApiKeyTranslator` subclass in the factory, an entry in `API_KEY_PROVIDERS`, the `Translator` union (extension and popup) and `TRANSLATORS_OPTIONS`, and its hosts as optional permissions in all three manifests; the form, storage, permission prompt and error messages are shared.

DeepL (`deepl/deepl.ts`) sends no CORS headers, so it runs in the background like Bing. Free keys end in `:fx` and belong to `api-free.deepl.com`; a key on the wrong host gets a 403 "Wrong endpoint", which is retried once on the other host and remembered. Language codes are normalised to BCP 47 casing (`EN-US` → `en-US`, `ZH-HANS` → `zh-Hans`), and `source_lang` only takes the bare language (`en-US` → `EN`).

A translator that reports `supportsContext` (only DeepL, through its `context` parameter, which is not billed) is given the text of every `.caption-window` the selection touches, in order, one `.caption-visual-line` per line (`tooltipService.getSelectionContext()`). `ProxyTranslator` must forward that getter, or a proxied translator silently gets no context. `TranslationCore` drops a context that is empty or equal to the selection and appends a hash of it to the cache key (`…_deepl_<cyrb53>`), never the text itself; translators without the flag keep the old key and get no DOM walk at all. Returning `false` from `DeepLTranslator.supportsContext` switches the whole feature off.

### Popup (`popup/src/`)

The API key form and the connected-key card live in `features/TranslatorApiKey/`, driven from `SettingsForm`: picking a key-based translator without a stored key opens the form instead of switching; the key is saved only after `verifyApiKey` succeeded; a stored key that stopped working (missing on this device, rejected, permission revoked) falls back to Google on page load and opens the form with the reason. When switching translators, `findClosestLanguage()` (`extension/src/common/translators/findClosestLanguage.ts`, re-exported from the settings page's `lib/helpers`) carries the selected languages across spellings (`en` ↔ `en-US`, `zh-CN` ↔ `zh-Hans`) and only warns when the language itself changes. The viewer's own language is picked from a list by one rule, `findUserLanguage()` in the same file (the UI language as the translator spells it — `pt-BR` → `pt`, `nb` → `no`, `ku-Arab` → `ckb` — else `en`, else the first one): on install (`SettingsService.getInitialSettings()`, also run by an update that finds no `settings` at all), by "Reset to default" in the popup, and by `matchSelectedLanguages` when the selected language is lost. `findClosestLanguage` keeps the very code asked for when the list has it, since Google lists both `he` and `iw`, `fil` and `tl`. Existing settings are never re-picked.

The popup theme is set in `app/providers/ThemeAppProvider`: the stored `popupTheme` if the viewer clicked the header toggle (`widgets/ThemeToggle`, through `useThemeMode()` from `shared/lib/theme/popupTheme.ts`), otherwise `prefers-color-scheme`. Colours in components go through theme tokens (`text.secondary`, `divider`, `background.paper`…) — a literal colour stays the same in both themes; single-colour SVGs use `currentColor` (see `eth-logo.svg`).

Every page is laid out by `shared/ui/Page` (title, header actions, theme and language buttons, the tabs). Notifications go through `useNotifications()` (`shared/lib/notifications`): `show(message, { severity, autoHideDuration })` returns a key for `close(key)`; they are shown one at a time at the bottom, the rest queued, by the `NotificationsProvider` that `ThemeAppProvider` puts around the app.

The popup is as wide as the page's `min-content` (`popup/src/index.css`), which is the tab labels: nothing on a page may be wider without wrapping (`nowrap`, a fixed width), or the window grows on that page; text of any length, such as the saved words, wraps anywhere (`overflow-wrap: anywhere`). `html` always has its vertical scrollbar (`overflow-y: scroll`, for Firefox; Chrome sizes the popup and its bar itself, so a page shorter than 600 px is 15 px narrower there). MUI's scroll lock is off in the theme (`MuiModal`, `MuiPopover`): its padding in place of the scrollbar widens Chrome's popup — never turn it back on for one component.

"Translate from / to" are `shared/ui/LanguageSelect`: the field opens a full-screen panel (`Dialog`) with a search by the name in the popup's language and by the translator's English one; the short lists are `shared/ui/SettingsSelect`.

Feature-Sliced-ish: `app/` (providers, router, i18n) → `pages/` → `widgets/` → `features/` → `shared/`. Path alias `@/` → `popup/src/`.

Each page exports a lazy `*.async.tsx` plus a skeleton; `routeConfig.ts` pairs `element` with `skeleton`. Adding a page means adding an entry there and a `RouterPath` constant.

## Cross-cutting contracts

### `chrome` is a global, never an import

The extension runs on the browser's own `chrome.*`, typed by `@types/chrome` (`types` in the tsconfigs); both ESLint configs declare `chrome` as a readonly global. There is no webextension-polyfill: don't add one, and don't `import chrome from ...`. Use only what the native API does in Chrome 102 and Firefox 115 — for example, a `runtime.onMessage` listener must answer through `sendResponse` and `return true` (Chrome ignores a returned promise before 147 — 148 by its documentation; see `MessageService`).

The root `.env` holds only the AMO release keys (`AMO_API_KEY`, `AMO_API_SECRET`, `AMO_ADDON_ID`), read by `scripts/update-amo-listing.js`; the build does not read it.

`content.ts` also polyfills `globalThis.Headers` with `headers-polyfill` before any other import; that line must stay first.

### Storage keys

`StorageService` (`extension/src/common/services/storageService.ts`) is the one callback-to-promise wrapper over the API. The popup reaches it through the `@extension/*` alias (declared in both `popup/vite.config.ts` and `popup/tsconfig.app.json`, and meant for `extension/src/common` only) behind the thin `getFromStorage`/`setToStorage` façade in `popup/src/shared/lib/helpers/storage.ts`, used via `useStorage()`. Don't give the popup its own copy: two copies existed once and drifted apart.

| Key | Area | Written by |
| --- | --- | --- |
| `settings`, `settingsVersion` | sync | background on install/update, popup forms |
| `tooltipTheme`, `tooltipThemeVersion` | sync | background on install/update, Customize page |
| `popupTheme` | sync | popup theme toggle — `"light" \| "dark"`; absent means follow the OS, and nothing writes it on install/update, so existing users keep the OS theme. Mirrored to `localStorage` (`hoverTranslatePopupTheme`) so the first frame is painted in the right theme |
| `deeplTipDismissed`, `multipleSelectionTipDismissed` | sync | popup, when the viewer closes the Settings page tip ("DeepL understands context", "hold Shift…") — `true`; absent means show. Both go through `shared/ui/DismissibleTip`, one key per tip (an object changed entry by entry would need a single writing context). Not part of `settings`, so no migration, and the background never writes them |
| `ratingPromptDone` | sync | popup card and the card on the video, on "Rate" or "Don't ask again", and the About page's "Rate us" (which stays there) — `true`; a flag, written once, so several writers are harmless. Ends the request everywhere |
| `ratingPromptPopup` | sync | popup, whole, when the viewer closes the Settings page rating card with ✕ — `{ count, lastDismissedAt }`. The card shows in every opening until answered; ✕ puts it off for 30 days, three times at most. Opening the popup writes nothing |
| `ratingPromptVideoShown` | sync | content script, once the rating card on the video is on screen — `true`; a flag, written once. Read when a save could show the card, not at page load. The three `ratingPrompt*` keys are not part of `settings` (no migration) and the background never writes them |
| `installedAt`, `updatedAt` | sync | background lifecycle; also the rating request's clock — nothing is asked in the week after either |
| `savedTranslations` | local | tooltipService (save), Dictionary page (list/delete/clear) |
| `translationCache` | local | translationCore (LRU flush) |
| `languages` | local | language list cache |
| `apiKeys` | local | background, on the popup's `setApiKey`/`removeApiKey` — `{ [translatorKey]: key }` via `ApiKeyService`; credentials, so never `sync` |
| `translatorLanguages` | local | `ApiKeyTranslator` — `{ [translatorKey]: AvailableLanguages }`, offline fallback |
| `apiKeyDraft` | session | popup, while a permission prompt is open (Firefox may close the popup) |
| `shownSessionNotices` | session | background, on `claimSessionNotice` — `{ [noticeId]: true }` once a page has shown that notice (`bingPermissionFallback`: Google answers for Bing); cleared with the browser session |

User-visible data is `local` (unbounded and per-device); preferences are `sync`.

An object that several callers change entry by entry (`apiKeys`, `translatorLanguages`) is written with `StorageService.update()`, which queues read-modify-write cycles per key so overlapping updates don't drop each other's entries. The queue is per JavaScript context, so each such key has a single writing context — the background worker, for both. Two popup pages open at once are two contexts, which is why the popup asks the background to store or remove a key instead of writing `apiKeys` itself.

### Settings migrations

`SettingsService` holds `SETTINGS_VERSION` and `TOOLTIP_THEME_VERSION`; the actual per-version transforms live in `settingsMigrationsService.ts` / `tooltipThemeMigrationsService.ts` as a `Record<number, (old) => new>` applied stepwise from the stored version to the target. **Adding or renaming a setting requires:** the field in `common/types/settings.ts`, a default in `common/consts/defaultValues.ts`, a new numbered migration entry, a bump of the corresponding `*_VERSION` constant, the popup form control, and the strings in all 24 `_locales/*/settings.json`. Removed fields are set to `undefined` in the migration rather than deleted (see migration `4`), and `settingsMigrationsService.inferVersion()` needs a case for the new field. `extension/test/background/migrations.test.ts` pins the current version, so it fails until the new migration has its cases there.

**Migrations must be safe to run twice.** Each one fills in the fields its version introduces (`field: old.field ?? default`) instead of assigning them outright, and `migrate()` treats the stored `settingsVersion` as a floor — `Math.max(stored, inferVersion(settings))`. Both exist because the stored number is not trustworthy: `chrome.storage.sync` propagates keys independently, so a device can hold `settings` without the matching `settingsVersion`, and replaying the chain from zero over current settings used to reset the chosen translator to Google. A migration that renames or recomputes a field rather than filling it reintroduces that bug.

### i18n — two separate systems

- Extension/manifest strings use the Chrome i18n API (`__MSG_name__`, `_locales/<lang>/messages.json`).
- The popup uses i18next with an HTTP backend loading `_locales/{{lng}}/{{ns}}.json` off `chrome.runtime.getURL("/")`, with a custom `detectUILanguage` detector over `chrome.i18n.getUILanguage()` and the choice cached in `localStorage` under `hoverTranslatePopupLanguage`.
- Right-to-left languages are i18next's own list (`i18n.dir()`: ar, he, fa, ur…), read in `ThemeAppProvider`, which sets `<html dir>`, the MUI theme `direction` and an emotion cache with `stylis-plugin-rtl` — MUI writes its styles left to right, and the plugin mirrors them (`left`/`right`, margins, `translate`); the left-to-right cache equals emotion's default, so the other languages' CSS does not change. An icon that points somewhere (`OpenInNew` in `ApiKeyForm`) is mirrored by hand, and Latin-only values (API keys) are marked `dir="ltr"`.
- Language names in the popup, through `shared/lib/helpers/languageNames.ts`: Google Translate's own names in the popup's language (the `languages` namespace, matched in any translator's spelling; `GOOGLE_CODES` there lists the codes a translator uses for another language than Google), then `Intl.DisplayNames` (Chrome's does not know about a quarter of Google's languages), then the translator's English name; in English the translators' own names stay, and the menu of popup languages names each one in itself.
- Dates and numbers the popup shows are formatted by `Intl` in the popup's language (`pt_BR` → `pt-BR`, `toTag()` in `shared/lib/helpers/languageNames.ts`). dayjs has no locales loaded: it is only for formats that do not depend on the language (grouping the Dictionary by day, the CSV export).
- `_locales/*/languages.json` is Google's answer, not a translation: `npm run update:language-names` (`scripts/update-language-names.js`) downloads it again for every locale, e.g. when Google adds languages; read its `git diff`.

Adding a language means: a `_locales/<lang>/` directory with all 8 namespaces (`languages.json` from `npm run update:language-names`; `options` in `customize.json` copied word for word from YouTube's player in that language — the lists `{option:…,text:…}` in `https://www.youtube.com/s/player/<id>/player_ias.vflset/<locale>/base.js`, never translated), plus an entry in the `supportedLanguages` array in `popup/src/app/config/i18n.ts`. Its tab labels (`tabLabel`) must pass the tab label test in `e2e/popup.spec.js`; shorten them if they do not fit. Its store listing needs `store-assets/descriptions/<lang>.txt` and `store-assets/search-terms/<lang>.txt` too (`check:listing` fails `release*` without them), and a `LOCALE_MAP` entry in `scripts/update-amo-listing.js` (its AMO code) to reach AMO — `update:amo` only warns about an unmapped one. In a right-to-left language, a `messages.json` string shown on the video must not start with a Latin word (`$TRANSLATOR$`, HoverTranslate): those boxes take their direction from the first letter (`dir="auto"`).

### Browser differences

Firefox swaps `background.service_worker` for `background.scripts` and adds `browser_specific_settings.gecko`; Chrome carries `key` + `minimum_chrome_version`; Edge shortens `short_name`. Translator hosts (Bing's and the key-based translators') are **optional** permissions, requested from the popup when the viewer picks the translator or connects a key — adding them to `host_permissions` would make Chrome disable the extension on update until every user re-approves it. Chrome and Edge list them under `optional_host_permissions`, which is why both require Chrome 102 (`minimum_chrome_version`); Firefox lists them under `optional_permissions` (it only accepts `optional_host_permissions` from 128) and requires 115 (`strict_min_version`), the first version with `storage.session`. Any manifest change (permissions, content-script matches, web-accessible resources) must be applied to **all three** files.

**No permission that triggers a warning is ever added to the required ones — only to the optional ones, or Chrome disables the extension for everyone on update** (1.1.11 did this with Bing's host, and Chrome disabled it for most users). Moving the host to the optional ones afterwards does not re-enable it; only removing it from the manifest altogether does.

### Releasing

`CHANGELOG.md` is written for the viewer, not as a log of commits: one short entry per thing they notice, in a sentence or two, saying what changed and not how. A new commit adds to the entry it belongs to (more languages, another case of the same bug) instead of a new one; similar changes go into one entry (all translation fixes, all new popup languages), never one per language or group; leave out mechanics (thresholds, counters, browser version ranges, per-language word choices).

Versions follow semver, judged by the release's `CHANGELOG.md` section: only **Fixed** → patch; anything **Added**, or a change the viewer notices → minor; something the viewer loses or has to redo → major. The version string lives in `package.json` (and `package-lock.json`) and all three manifests; set it with `npm run version:set -- X.Y.Z` (`scripts/set-version.js`), which writes all of them and refuses a version that is not higher than the current one. `scripts/archive.js` backs up the working `manifest.json`, swaps in the browser-specific one, zips (`.xpi` for Firefox), and restores the backup — so it is safe to run regardless of which `setup:` you last ran. Archives land in `releases/<version>/` (gitignored). Firefox store submissions also need the source archive (`npm run source-archive`, see `FIREFOX_SOURCE_NOTES.txt` and `BUILD_INSTRUCTIONS.md`). It is made of the files git tracks (`git ls-files`), as they are in the working tree so that it matches the build (the new version is not committed yet), so nothing untracked or ignored reaches the reviewers — a new file the build needs goes in only once it is added to git, and the script ends with a warning naming the untracked files; it leaves out `docs/`, `store-assets/`, `.claude/` and `CLAUDE.md`, which the build does not need.

`npm run check:listing` (`scripts/check-listing.js`) runs first in `release`, `release:<browser>` (not `:dev`) and `update:amo`, and fails on: `name` over 50 (AMO) or `description` over 132 (Chrome/Edge cut the summary) in any `_locales/*/messages.json`; Edge search terms (`store-assets/search-terms/*.txt`) over 7 lines, 30 characters a line or 21 words; a store description outside 250–10,000 characters; a locale missing from any of the three places. `update-amo-listing.js` sends only the locales in its `AMO_LOCALES` (addons-server `PROD_LANGUAGES`; `hi` is not there) and warns about the rest.

The search terms are used by Edge alone — hidden keywords in Partner Center, pasted by hand — and Edge is by far the smallest of the three stores. Keep them within the limits and about what the extension does, and spend no research on them beyond that; the descriptions, summaries and names are what matter in all three stores.

### Dependencies

- Versions in all three `package.json` are exact (no `^`/`~`) and equal to their `package-lock.json`. Each package has an `.npmrc` with `save-exact=true` (a new dependency is written exactly) and `engine-strict=true` (npm refuses a Node/npm older than `engines`; `.nvmrc` names the version the project is built with).
- Install and build with `npm ci`. `npm install <pkg>@<version>` is only for adding or changing a dependency, in the package that needs it, and the lock file changes with it.
- A major version is updated only as its own task, after reading the changelog for the whole range. Any update of a package that ships in the bundle, minor included, needs its changelog read from the current version to the new one and the bundle diffed before and after.
- Everything in the bundle has to run in Chrome 102 and Firefox 115. The Vite configs set `build.target` explicitly (Vite 7's default starts at Chrome 107) — keep it; but a target only rewrites syntax, never a missing API. Before updating a package that ships in the bundle, look in its code for browser APIs newer than those versions and not guarded by a check (`AbortSignal.any`, for one, is Chrome 116 / Firefox 124).
- When a package that ships in the bundle or `build.target` changes, the build is run in the oldest browsers, downloaded into `work/runs/<task>/` for that and deleted with it: Chromium 102 — the snapshot `https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/992738/chrome-linux.zip` (102.0.5005.0), headless with extensions only as `--headless=chrome`; Firefox 115 — the last `115.*esr` from `https://ftp.mozilla.org/pub/firefox/releases/` with geckodriver 0.36.0 (on Arch it also needs `libdbus-glib-1.so.2`, package `dbus-glib`). Before 127, Firefox does not grant an MV3 extension its `content_scripts.matches` hosts on install, so grant them in the profile first. Check that the popup gets the language lists (messages to the background) and the tooltip translates on a page with captions.
- AMO reviewers build on Ubuntu ARM64 with the Node/npm listed on extensionworkshop.com ("Source code submission"); `BUILD_INSTRUCTIONS.md` has to state where our build environment differs.

## Code Style

**Simpler is better — the code must stay maintainable.** This rule outranks cleverness:

- Less code and fewer conditions mean fewer places for a bug, and a bug that does happen is easier to find. Prefer the plain, readable solution.
- If a task seems to need a complex construct or an abstraction that is hard to follow, think again whether it can be done without it. If it cannot, weigh what wins: the cleanliness of the code or the case being covered.
- If the choice is not obvious, do not decide alone: bring it to the user, explain the situation in detail (the options, what each costs, what each covers), and decide together.
- A piece of code that needs a 20–30-line comment to be understood is a sign it is too complicated. Comments say why, briefly; they do not make up for code that cannot be read.
- No generality for a single case ("in case we need it later"), no values that change meaning on the fly, no closures that rely on something declared later.

2-space indent, double quotes, semicolons, Unix newlines, `object-curly-spacing` — enforced by ESLint in each package. `no-console` allows only `console.warn` / `console.error`. TypeScript strict with `noUnusedLocals` / `noUnusedParameters`. Relative imports inside `extension/` carry the `.ts` extension.

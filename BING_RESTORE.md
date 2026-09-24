# Bringing the Bing translator back (1.1.15)

Temporary document. Delete it in the same change that completes the last step below.

## Why Bing is off in 1.1.14

1.1.11 added `https://www.bing.com/*` to `host_permissions`. A new host permission shows a warning, and Chrome disables an extension on update until the user accepts that warning. The day after 1.1.11 reached most users, more than half of the Chrome installs were disabled, and a month later a large share still was (figures in `notes/analytics/` and `notes/STORE_SEO_REPORT.md`, P0-1).

Declaring the host as optional in the next version does **not** switch those users back on. Only a version that leaves the host out of the manifest altogether does. Measured in Brave 153 (Chromium 153), installed from a `.crx` and updated through a locally served `update_url` — on a tiny test extension carrying each release's permissions, and for the 1.1.10 → 1.1.13 → 1.1.14 rows also on the real builds (starting from the manifest 1.1.10 actually shipped):

| Path                                                                                              | Result                                                            |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1.1.10 → 1.1.13 (bing required)                                                                   | disabled, `disable_reasons: [2]` (`DISABLE_PERMISSIONS_INCREASE`) |
| … → a version with bing in `optional_host_permissions`                                            | **still disabled**, bing still in the active permissions          |
| … → a version with bing in the manifest as `https://*.bing.com/*` or `https://www.bing.com:443/*` | **still disabled**                                                |
| … → 1.1.14 (no bing in the manifest at all)                                                       | **enabled again**, no bing access                                 |
| … → 1.1.14 → a version with bing optional                                                         | stays enabled; picking Bing shows the permission prompt           |
| accepted in 1.1.11 → 1.1.14 → bing optional                                                       | enabled; bing is no longer active, so picking Bing prompts again  |
| never had 1.1.11, or a fresh install                                                              | nothing about bing granted or asked for until Bing is picked      |

Why, in Chromium's code:

- `PermissionsUpdater::InitializePermissions` (`extensions/browser/permissions/permissions_updater.cc`) stores the extension's _desired active permissions_ in prefs on every install and update.
- `PermissionsManager::GetBoundedExtensionDesiredPermissions` (`extensions/browser/permissions_manager.cc`) computes the next version's active set as (stored desired ∩ (required ∪ optional)) ∪ required. The intersection is `kPatternsContainedByBoth`: any pattern that contains `www.bing.com`, or is contained by it, keeps it.
- `ChromeExtensionRegistrarDelegate::CheckPermissionsIncrease` (`chrome/browser/extensions/chrome_extension_registrar_delegate.cc`) compares that active set with the granted permissions. A disabled user never granted bing, so the check still reports a privilege increase. The `DISABLE_PERMISSIONS_INCREASE` reason is removed only when there is no increase, which happens only once bing has left both lists.

The stand that measured all this lives in `notes/harness/01/chromium-update/run.mjs`. It covers the tiny test extension plus `--real` with the real builds. It is gitignored, so it only exists on Dmytro's machine.

Firefox never disabled anything. For MV3, host permissions are stored in `ExtensionPermissions`, and `ExtensionData.migratePermissions` (`toolkit/components/extensions/Extension.sys.mjs`) revokes them on update only for policy-installed add-ons. So Firefox users simply lose Bing for one version, like everyone else.

## When to release 1.1.15

**Not right after 1.1.14.** The store serves only its latest version. A Chrome that has not fetched 1.1.14 before 1.1.15 is published goes straight from 1.1.13 to 1.1.15, which is the "bing optional" path above, and **that user stays disabled for good**.

- Chrome checks for updates at every start and then every 5 hours (`kDefaultUpdateFrequency = base::Hours(5)`, `extensions/common/constants.h`). Disabled extensions are updated too.
- For comparison, 1.1.11 became the main version one day after it was published.
- Count from the day 1.1.14 is **published**, not submitted. Do not upload 1.1.15 while 1.1.14 is still in review: a new upload replaces the one in the queue.
- Release 1.1.15 when both hold in the Chrome dashboard:
  - "Enabled / disabled": the enabled count has climbed back to roughly its level before 1.1.11 and stopped growing;
  - "By version": the share of 1.1.14 has levelled off.

  Expect 1–2 weeks. For Edge nothing is measured: no Edge run and no Edge statistics. It is built on the same Chromium extension code, so it most likely behaves the same — wait there too. Firefox can get 1.1.15 at any time.

## Steps

### 1. Manifests: Bing as an optional permission, in all three files

Never in `host_permissions` — see the rule in `CLAUDE.md`, "Browser differences".

`manifest.chrome.json` and `manifest.edge.json`:

```json
"optional_host_permissions": [
  "https://api-free.deepl.com/*",
  "https://api.deepl.com/*",
  "https://www.bing.com/*"
],
```

`manifest.firefox.json` uses `optional_permissions`, because Firefox 115 does not accept `optional_host_permissions`:

```json
"optional_permissions": [
  "https://api-free.deepl.com/*",
  "https://api.deepl.com/*",
  "https://www.bing.com/*"
],
```

Leave `minimum_chrome_version` (102) and `strict_min_version` (115.0) as they are, and do not re-add a `host_permissions` key.

### 2. Stop withdrawing Bing

Remove `bing: "google"` from `WITHDRAWN_TRANSLATORS` in `extension/src/common/translators/withdrawnTranslators.ts`.

The mechanism can stay with an empty map for the next time. If it goes instead, remove all of the following together:

- the module;
- its uses in `TranslatorFactory.ts`, `popup/src/pages/SettingsPage/ui/SettingsPage.tsx` (the `isTranslatorWithdrawn` branch in `setInitialSettings`) and `SettingsForm.tsx` (the filter in `translatorOptions`);
- the `errors.translatorWithdrawn` string in all 19 `_locales/*/settings.json`;
- the paragraph about it in `CLAUDE.md` under "Translators".

Either way, update the module's doc comment and the "In 1.1.14 Bing is withdrawn" sentence in `CLAUDE.md`.

### 3. The Bing translator checks its permission before every request

Without the permission, the background worker's `fetch` to <www.bing.com> fails as an anonymous `TypeError: Failed to fetch`. The tooltip would then say "network" instead of "not allowed". On HEAD before 1.1.14, the `translate` message answered `{ translatorError: { message: "Failed to fetch" } }`, with no code at all.

In `extension/src/common/translators/bing/bing.ts`, check the permission the same way `DeepLTranslator.ensurePermission()` does (`deepl/deepl.ts`):

```ts
import { TranslatorError } from "../translatorError.ts";

const BING_ORIGIN = "https://www.bing.com/*";

// in the class:
  /**
   * Without the permission the request fails as an anonymous "Failed to
   * fetch"; checking first is what lets the viewer be told to grant it.
   */
  private async ensurePermission(): Promise<void> {
    let granted = true;

    try {
      granted = await chrome.permissions.contains({ origins: [BING_ORIGIN] });
    } catch {
      // A browser that cannot answer: let the request itself find out.
    }

    if (!granted) {
      throw new TranslatorError("permission-missing", "The extension has no permission to reach www.bing.com");
    }
  }
```

Call it at the start of `requestTranslation()`, before `getCredentials()`. Both `/translator` and `/ttranslatev3` are on that host.

`getAvailableLanguages()` needs no check, because it talks to `api.cognitive.microsofttranslator.com`, which sends CORS headers. That also means the settings page cannot find out about a missing Bing permission by fetching the language list — see step 4.

`MessageService` already wraps the error in the `{ translatorError: { code } }` envelope. The tooltip already has `errorPermissionMissing` ("HoverTranslate is not allowed to connect to Bing. Allow it in the HoverTranslate settings").

### 4. Settings page: Bing selected, but no permission

This covers two groups:

- Chrome and Edge users who still have `translator: "bing"` in their synced settings because they never opened the settings during 1.1.14. 1.1.14 dropped bing from their active permissions.
- Firefox users who never granted the host.

In `SettingsPage.tsx` → `setInitialSettings`, before `fetchAvailableLanguages(settings.translator)`, check the origins of translators that are not key-based:

```ts
const origins = getTranslatorOrigins(settings.translator); // popup/src/shared/lib/helpers/permissions.ts
if (
  !requiresApiKey(settings.translator) &&
  origins.length &&
  !(await chrome.permissions.contains({ origins }).catch(() => true))
) {
  // fall back like every other failure here
}
```

Recommended reaction: **fall back to Google with a notice**, as the page already does for DeepL and for an unreachable translator (`showFallbackNotice` + `fallBackTo`).

- A permission prompt needs a user gesture, so the page cannot ask by itself. Picking Bing again in the list is that gesture: `switchTranslator` → `ensureTranslatorPermissions` already requests `TRANSLATOR_ORIGINS.bing`, and on refusal it keeps the previous translator with the reason.
- Keeping Bing with a warning and a button would leave every hover failing until the click.

The notice needs a new string in all 19 `_locales/*/settings.json` (English and a real translation for each, in the style of the neighbouring `errors.*` strings). For example, `errors.translatorPermissionFallback`: "{{translatorName}} needs access to <www.bing.com>. Pick {{translatorName}} in the list to allow it. Switching to {{fallbackTranslatorName}}."

### 5. `popup/src/shared/lib/helpers/permissions.ts`: fix the comments

- The `TRANSLATOR_ORIGINS` doc says Chrome grants manifest host permissions at install. For Bing that is no longer true: its host is optional everywhere, the same as the key-based translators.
- The `catch` in `ensureTranslatorPermissions` says "Chrome refuses to request permissions the manifest already grants". Once Bing is optional, no translator origin is a required one.
  - Keep the `catch`: `request()` still throws outside a user gesture in Firefox, and for an origin the manifest does not declare.
  - Reword the comment to say that.

### 6. Firefox: the popup may close on the prompt

Firefox may close the popup while the permission prompt is shown (see `apiKeyDraft`). Then `switchTranslator` never saves `bing`, even though the permission was granted.

Picking Bing again then resolves at once without a prompt, which is acceptable. Check it by hand (step 9), and add a draft like DeepL's only if it turns out to be a real problem.

### 7. `CHANGELOG.md`, `[1.1.15]`

Suggested entry: "Bing is back. Access to <www.bing.com> is now asked for only when you pick Bing in the settings; HoverTranslate no longer asks every user for it."

### 8. `CLAUDE.md`

- Remove the `BING_RESTORE.md` line from "Repository Layout".
- Update the "Translators" paragraph (step 2).
- Keep the rule in "Browser differences", and change its last sentence to say that 1.1.15 brought Bing back as an optional permission.

### 9. Verification

- The stand `notes/harness/01/run.mjs` holds the 1.1.14 checks. For 1.1.15, flip or extend them:
  - manifests: bing present in the optional key of each browser and absent from `host_permissions`;
  - factory: `bing` builds `BingTranslator`;
  - `translate` for bing:
    - with `permissions.contains` → false: the `permission-missing` envelope and no request to <www.bing.com>;
    - with true: a translation from the mocked `/translator` + `/ttranslatev3`;
  - popup:
    - Bing is listed again;
    - picking it calls `permissions.request(["https://www.bing.com/*"])`: false keeps Google and shows the reason, true saves `bing`;
    - opening the settings with Bing selected and no permission falls back with the step-4 notice, and with the permission shows no notice;
  - Google and DeepL unchanged; no unhandled rejections.
- `notes/harness/01/chromium-update/run.mjs --real`: add a 1.1.15 build and check that a profile that went 1.1.13 (disabled) → 1.1.14 → 1.1.15 stays enabled and has no bing until it is requested. The `disabled-two-step` scenario already shows this with the tiny extension.
- `npm run setup:chrome && npm run build`, both lints, `setup:firefox` and `setup:edge` for valid manifests, then back to `setup:chrome`.
- By hand:
  - Chrome: install 1.1.15 unpacked, pick Bing, and the prompt for <www.bing.com> should appear; allow it and hover a word, and you should get a Bing translation. Remove the access on the extension's details page, and hovering should now show "not allowed to connect to Bing"; opening the settings should fall back to Google with the notice.
  - Firefox: the same, plus reopen the popup if it closed on the prompt.

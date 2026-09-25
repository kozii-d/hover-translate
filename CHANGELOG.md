# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - unreleased

### Changed

- The Bing translator is back. HoverTranslate asks for access to <www.bing.com> only when you pick Bing in the settings, and no longer asks every user for it. If Bing was already your translator, pick it in the settings once more to allow that access: opening the settings switches you to Google and says so. Until then, words are translated with Google, as in the previous version, and a notice on the video says so once each time you start the browser.

### Added

- A request to rate HoverTranslate, the same for everyone and only once it has been in use for a while — never in the first week after installing or updating. In the settings, a card with "Rate", "Don't ask again" and a link for reporting a problem on GitHub; it stays until you answer it, and closing it puts it off for a month, at most three times. On the video, a small card once ever — when the tenth word is saved to your list, or, if you only hover over words, once you have translated thirty — unless notifications are off; the video pauses while the pointer is on it, as over the subtitles, and "Rate" leaves the video paused where it was. "Rate", "Don't ask again", or "Rate us" on the About page end the request for good.

### Fixed

- "Rate us" on the About page opened a page that does not exist when HoverTranslate was installed in Edge from the Chrome Web Store, and in Firefox a reviews page where a rating cannot be given. It now opens the page of the store HoverTranslate was installed from, where it can be rated.
- "Translation saved" and the other messages on the video were placed off screen when the page was scrolled down. They are now shown at the top-left of the visible part of the video.
- In YouTube players embedded on other websites, hovering a subtitle word did nothing since YouTube's new embedded player, rolled out from March 2026, placed its controls layer over the subtitles: no translation, no auto-pause, and a click did not save the word. Now it shows the translation, pauses the video and saves the word, as on YouTube itself, and a click anywhere else in the player still works as before.

## [1.1.14] - 2026-09-24

### Changed

- The Bing translator is not available in this version. It comes back in the next update, which will ask for access to <www.bing.com> only when you pick Bing. If Bing was your translator, Google is used in the meantime, and the settings say so when you open them.
- With DeepL, words are now translated in the context of the subtitle line they appear in, so a word with several meanings gets the one it has there — "bank" in "we sat on the bank of the river" is a riverbank, not a bank. The surrounding line is not counted against your DeepL allowance — only the selected words are, as before. A word hovered again once the line has changed is translated, and counted, again. Because the translation follows the sentence, a word may now be translated in the form it takes in that sentence rather than its dictionary form.

### Added

- A tip in the settings for Google users that DeepL translates words in context, with a button to connect or switch to DeepL. It can be closed for good.
- The "hold Shift to select several words" tip in the settings can now be closed for good too, and it is no longer shown while "Always enable multiple selection" is on.

### Fixed

- HoverTranslate no longer asks for access to <www.bing.com>. Version 1.1.11 started asking every user for it, and Chrome switched the extension off until that access was approved. If that happened to you, this update switches HoverTranslate back on by itself, with nothing to approve.
- With two subtitle windows on screen at once — two speakers, one caption at the top and one at the bottom — hovering a word in the second window showed nothing. It now shows its translation, placed next to its own window.
- On a first install in Brazilian or European Portuguese, or Latin American Spanish, the translation language was set to English instead of your language, so hovering a word in an English video showed the same English word. HoverTranslate now picks your language whenever the browser names it with a region the translator does not list — also Spanish (Spain) and Swedish in Firefox, Norwegian, Chinese (Hong Kong), Canadian French and others. Settings you already have are not changed; if yours shows English and you did not choose it, pick your language in the settings.
- Norwegian is no longer replaced with another language when you switch between Google and DeepL, or when Google stands in for Bing (Google calls it "no", DeepL and Bing "nb").

## [1.1.13] - 2026-09-19

### Added

- DeepL as a third translator, working with your own DeepL API key (the free DeepL plan covers 500,000 characters a month). Pick DeepL in the settings, paste your key, and HoverTranslate checks it before switching. The key is stored only on your device and sent only to DeepL; the settings show how much of your monthly allowance is used, and the key can be changed or removed at any time.
- When a translation fails for a reason you can fix — a missing or rejected API key, a used-up monthly limit, too many requests, no connection — the message on the video now says which, instead of a bare "Translation failed".
- A light/dark theme switch in the popup header. Until you use it, the popup keeps following your system theme, as before.

### Changed

- HoverTranslate now requires Chrome or Edge 102 and Firefox 115 or newer.

### Fixed

- Switching between translators no longer resets the languages you picked when the new translator only spells them differently (for example English vs. English (American), or Chinese (Taiwan) vs. Chinese (Traditional)).
- The popup no longer flashes white when it opens in dark mode.
- The Ethereum logo in the donation window is visible in the dark theme.

## [1.1.12] - 2026-08-24

### Fixed

- Fixed Google translations failing with a "too many requests" error, which left the tooltip empty on every word. Google stopped answering the kind of request the extension had been making since its first version; it now asks the way Google's own clients do, and moves on to another way of asking if that one is turned down too.

## [1.1.11] - 2026-08-23

### Added

- Word-by-word translation for subtitles written without spaces between words — Chinese, Japanese, Thai and others. Their subtitles used to be one solid line, so hovering translated the whole sentence instead of a word.

### Fixed

- Fixed the Bing translator, which stopped working after Microsoft retired the endpoint it used to authorize requests.
- Fixed the settings page hanging on a loading skeleton when the selected translator could not be reached. The error is now shown and the extension falls back to Google.
- A translator that fails while you are switching to it now reports the error and keeps the previous one selected.
- Failed translations now show a message on the video instead of silently showing nothing.
- Fixed the extension popup opening in English for everyone. It now follows the browser's language, in all 19 languages it is translated into.
- Fixed clicking a word right after hovering it saving or copying the previous word. You now always get the word you clicked.
- Fixed subtitles no longer reacting to the mouse after going from the home page to a video.
- Fixed the video resuming on its own after you had paused it yourself while the pointer was over the subtitles.
- Fixed settings resetting to their defaults when the extension updated, or when it was installed on a second device.
- Moving the pointer across a subtitle line no longer asks for a translation of every word it passes - the pointer has to stop on a word. This also stops Bing from asking for a captcha after a few minutes of watching.
- Words that could not be saved to the dictionary, and text that could not be copied to the clipboard, now say so instead of failing silently.
- Fixed the extension gradually slowing the page down after settings had been changed a few times without reloading it.
- Fixed Shift-selection collapsing to a single word. A phrase selected across two subtitle lines now survives the subtitles being redrawn, which auto-generated subtitles do on every word.
- Switching the translator now applies to subtitles already on screen instead of only the next line.
- Fixed dates in the dictionary being shown in the wrong language for European Portuguese, and the dictionary showing an untranslated title while it loaded.
- Firefox: fixed the dictionary export being cancelled instead of downloaded.

### Changed

- Bing translations are now requested by the background script, which requires access to <www.bing.com>.
- The extension no longer lets web pages read its files, so a site can no longer tell that you have it installed.
- The extension now does its work only where a player can actually be — a video page or an embedded player — instead of on every YouTube page and in every frame of it.
- Subtitle text in an exported dictionary can no longer be treated as a formula by Excel, LibreOffice or Google Sheets.

## [1.1.10] - 2026-02-28

### Added

- Added UI language support for: Chinese (Simplified), Chinese (Traditional), Turkish, Swedish, Italian, Czech, and Finnish.

### Fixed

- Fixed popup width and navigation tab display issues across browsers.

## [1.1.9] - 2025-10-19

### Added

- Added a setting to choose the action for left-clicking on words in subtitles.

## [1.1.8] - 2025-08-28

### Fixed

- Fixed an issue where settings would reset when installing it on another device.

## [1.1.7] - 2025-06-21

### Fixed

- Fixed the incorrect link for the review button for Firefox and Edge.

## [1.1.6] - 2025-06-16

### Fixed

- Fixed an issue where long translation tooltips could extend outside the video player boundaries.

## [1.1.5] - 2025-06-05

### Added

- Support for Microsoft Edge and Mozilla Firefox browsers.

## [1.1.4] - 2025-06-05

### Added

- **Support modal** with crypto wallet addresses for project donations.

## [1.1.3] - 2025-05-29

### Added

- **About page** with information about the extension.
- Toast notifications for errors and warnings.
- Warning notification when switching translators if the new translator does not support the selected language.

### Changed

- Enabled auto-save for Settings and Customize forms. Changes are now saved automatically without requiring a "Save" button.

## [1.1.2] - 2025-05-26

### Added

- UI language support for: Spanish, French, German, Polish, Portuguese (Brazil), Portuguese (Portugal), Japanese, Korean, and Hindi.

### Fixed

- Improved the logic for observing subtitles in the video player.

## [1.1.1] - 2025-05-02

### Added

- Added the ability to enable/disable the dictionary.
- Added the ability to enable/disable permanent multiply selection instead of holding the Shift key.
- Added the ability to enable/disable notifications.

## [1.1.0] - 2025-02-04

### Added

- Added the ability to export saved translations from the dictionary in JSON and CSV format.
- Added Bing translator.

### Changed

- Requests for translations are now sent directly to the Google Translate API from the client instead of my API server.
- Reduced the size of the extension bundle. Exclude unnecessary files.

### Fixed

- Fixed saving the translation to the dictionary when dragging subtitles.

### Removed

- Authentication logic.

## [1.0.1] - 2025-01-10

### Fixed

- Resolved an issue where the extension would stop working after navigating back to the YouTube homepage and then returning to a video.
- Fixed the notification tooltip not appearing on embedded YouTube videos.

## [1.0.0] - 2025-01-01

- First release!

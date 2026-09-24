/**
 * Translators taken out of this release, each with the one used in its place.
 *
 * A withdrawn translator is not offered in the settings, a viewer who had it
 * selected is moved to the replacement when the settings page opens, and until
 * then `TranslatorFactory` builds the replacement for it — wrapped in a
 * `ReplacementTranslator`, which carries the selected languages over to the
 * replacement's codes — so hovering keeps working without a trip to the
 * settings.
 *
 * Bing, in 1.1.14: 1.1.11 made www.bing.com a required host permission, Chrome
 * disabled the extension on update for everyone who did not accept it, and
 * Chrome only re-enables it by itself once an update no longer asks for that
 * host at all — declaring it optional instead is not enough. So 1.1.14 carries
 * no Bing permission, and Bing comes back as an optional permission in the
 * release after it. How to bring it back: `BING_RESTORE.md`.
 *
 * Kept apart from `TranslatorFactory` so the popup can read it without pulling
 * in the translators' HTTP client.
 */
export const WITHDRAWN_TRANSLATORS: Partial<Record<string, string>> = {
  bing: "google",
};

export const isTranslatorWithdrawn = (translatorKey: string): boolean =>
  Boolean(WITHDRAWN_TRANSLATORS[translatorKey]);

/** The translator to use for `translatorKey`: itself, or its replacement. */
export const resolveTranslatorKey = (translatorKey: string): string =>
  WITHDRAWN_TRANSLATORS[translatorKey] ?? translatorKey;

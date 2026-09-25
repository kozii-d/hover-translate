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
 * Nothing is withdrawn now; the mechanism is kept for the next time. Bing was,
 * in 1.1.14 only: 1.1.11 made www.bing.com a required host permission, Chrome
 * disabled the extension on update for everyone who did not accept it, and
 * Chrome only re-enables it by itself once an update no longer asks for that
 * host at all — declaring it optional instead is not enough. So 1.1.14 carried
 * no Bing permission, and 1.2.0 brought Bing back with its host as an optional
 * permission (see `PermissionFallbackTranslator` for a viewer who has not
 * granted it).
 *
 * Kept apart from `TranslatorFactory` so the popup can read it without pulling
 * in the translators' HTTP client.
 */
export const WITHDRAWN_TRANSLATORS: Partial<Record<string, string>> = {};

export const isTranslatorWithdrawn = (translatorKey: string): boolean =>
  Boolean(WITHDRAWN_TRANSLATORS[translatorKey]);

/** The translator to use for `translatorKey`: itself, or its replacement. */
export const resolveTranslatorKey = (translatorKey: string): string =>
  WITHDRAWN_TRANSLATORS[translatorKey] ?? translatorKey;

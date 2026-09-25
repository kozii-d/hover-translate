import { getApiKeyProvider } from "@extension/common/translators/apiKeyProviders.ts";

/**
 * Origins each translator needs the background script to reach. All of them
 * are optional permissions, in every browser, requested when the viewer picks
 * the translator — never required ones, see "Browser differences" in
 * CLAUDE.md. Translators that work with an API key take theirs from their
 * provider entry.
 */
const TRANSLATOR_ORIGINS: Record<string, string[]> = {
  bing: ["https://www.bing.com/*"],
};

export const getTranslatorOrigins = (translator: string) =>
  TRANSLATOR_ORIGINS[translator] || getApiKeyProvider(translator)?.origins || [];

/** The hosts of `origins`, for telling the viewer what access is asked for: `www.bing.com`. */
export const getOriginHosts = (origins: string[]) =>
  origins.map((origin) => new URL(origin.replace(/\*$/, "")).host).join(", ");

/**
 * Resolves to whether the translator may reach its hosts. Call it directly from
 * the event handler of the interaction that asked for the translator: Firefox
 * only opens a permission prompt while a user gesture is being handled.
 */
export const ensureTranslatorPermissions = async (translator: string) => {
  const origins = getTranslatorOrigins(translator);

  if (!origins.length) {
    return true;
  }

  try {
    return await chrome.permissions.request({ origins });
  } catch {
    // `request()` throws instead of prompting outside a user gesture in
    // Firefox, and for an origin the manifest does not declare. Whatever is
    // already granted still counts.
    return chrome.permissions.contains({ origins });
  }
};

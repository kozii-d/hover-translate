/**
 * Origins each translator needs the background script to reach. Chrome grants
 * manifest host permissions at install time, but Firefox treats them as opt-in,
 * so they may still have to be requested from the user.
 */
const TRANSLATOR_ORIGINS: Record<string, string[]> = {
  bing: ["https://www.bing.com/*"],
};

export const getTranslatorOrigins = (translator: string) => TRANSLATOR_ORIGINS[translator] || [];

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
    // Chrome refuses to "request" permissions the manifest already grants.
    return chrome.permissions.contains({ origins });
  }
};

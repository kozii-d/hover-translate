import { useCallback, useEffect, useState } from "react";

// Not the manifest's `*://*.youtube.com/*`: Chrome's site access "On this
// site" grants only the page's own address, and the extension works there.
const YOUTUBE_ORIGIN = "https://www.youtube.com/*";

/**
 * Whether the content script may run on YouTube — not in Firefox before 127,
 * nor in Chrome with site access "On click" — null until the browser answers;
 * and how to ask for it.
 */
export const useYouTubeAccess = () => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.permissions.contains({ origins: [YOUTUBE_ORIGIN] })
      .then(setHasAccess)
      // No line about access without a reason to think it is missing.
      .catch(() => setHasAccess(true));
  }, []);

  // Call it straight from the click: Firefox prompts only during a user
  // gesture. The content scripts' own hosts, which both browsers let the
  // extension ask for although they are not optional permissions.
  const requestAccess = useCallback(() => {
    const origins = chrome.runtime.getManifest().content_scripts?.flatMap(({ matches }) => matches ?? []) ?? [];
    chrome.permissions.request({ origins })
      .then((granted) => {
        if (granted) setHasAccess(true);
      })
      .catch((error) => console.error("Could not ask for access to YouTube", error));
  }, []);

  return { hasAccess, requestAccess };
};

import { useEffect, useState } from "react";

/**
 * Whether the extension's icon is pinned to the toolbar (`action.getUserSettings`,
 * Chrome 91+). Followed through `onUserSettingsChanged` where there is one
 * (Chrome 130+), else looked at again when the page comes back into view: the
 * icon is pinned from the browser's menu, outside the page. `null` until the
 * browser answers, so that a tip about pinning does not flash on screen and
 * go; `false` where it cannot tell.
 */
export const useIconOnToolbar = () => {
  const [onToolbar, setOnToolbar] = useState<boolean | null>(
    () => (typeof chrome.action?.getUserSettings === "function" ? null : false));

  useEffect(() => {
    const action = chrome.action;
    if (typeof action?.getUserSettings !== "function") return;

    const check = () => {
      action.getUserSettings()
        .then((settings) => setOnToolbar(Boolean(settings.isOnToolbar)))
        .catch((error) => {
          console.warn("Could not tell whether the icon is on the toolbar", error);
          setOnToolbar((known) => known ?? false);
        });
    };
    check();

    if (action.onUserSettingsChanged) {
      const handleChange = (change: chrome.action.UserSettingsChange) => {
        if (change.isOnToolbar !== undefined) setOnToolbar(change.isOnToolbar);
      };
      action.onUserSettingsChanged.addListener(handleChange);
      return () => action.onUserSettingsChanged.removeListener(handleChange);
    }

    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  return onToolbar;
};

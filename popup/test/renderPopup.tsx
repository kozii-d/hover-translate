import { StrictMode } from "react";
import { HashRouter } from "react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/app/App.tsx";
import i18n from "@/app/config/i18n.ts";
import { MessageService } from "@extension/background/services/messageService.ts";
import { FakeChromeOptions, installFakeChrome } from "@extension-test/fakeChrome.ts";
import { Route, installFakeNetwork } from "@extension-test/fakeNetwork.ts";

interface PopupOptions extends FakeChromeOptions {
  /** The page, as in the popup's hash: `/`, `/dictionary`… */
  route?: string;
  /** The locale directory the popup is shown in: `en`, `ar`, `pt_BR`… */
  language?: string;
  routes?: Record<string, Route>;
}

/**
 * The popup as `main.tsx` mounts it, in a fresh profile, with the real
 * background worker answering its messages in the same process.
 */
export async function renderPopup({ route = "/", language = "en", routes, ...chromeOptions }: PopupOptions = {}) {
  const fake = installFakeChrome(chromeOptions);
  const network = installFakeNetwork(routes);
  new MessageService();

  await i18n.changeLanguage(language);
  window.location.hash = `#${route}`;

  const user = userEvent.setup();
  const view = render(
    <StrictMode>
      <HashRouter>
        <App/>
      </HashRouter>
    </StrictMode>,
  );

  return { fake, network, user, ...view };
}

/**
 * Every text the field `selector` has shown since this call, the current one
 * last. A form drawn with other values and corrected or replaced before the
 * test looks leaves them here: mutation records keep what the page no longer has.
 */
export function recordFieldTexts(selector: string) {
  const shown: string[] = [];
  const observer = new MutationObserver((records) => records.forEach((record) => {
    if (record.type === "characterData" && record.target.parentElement?.closest(selector)) {
      shown.push(record.oldValue ?? "");
    }
    record.removedNodes.forEach((node) => {
      const field = node instanceof Element ? node.querySelector(selector) : null;
      if (field) shown.push(field.textContent ?? "");
      else if ((record.target as Element).closest?.(selector)) shown.push(node.textContent ?? "");
    });
  }));
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, characterDataOldValue: true });

  return () => {
    observer.disconnect();
    return [...shown, document.querySelector(selector)?.textContent ?? ""];
  };
}

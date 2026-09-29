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

import { StrictMode } from "react";
import { HashRouter } from "react-router";
import { ByRoleOptions, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/app/App.tsx";
import { WelcomeApp } from "@/app/WelcomeApp.tsx";
import i18n from "@/app/config/i18n.ts";
import { MessageService } from "@extension/background/services/messageService.ts";
import { FakeChromeOptions, installFakeChrome } from "@extension-test/fakeChrome.ts";
import { Route, installFakeNetwork } from "@extension-test/fakeNetwork.ts";

interface PopupOptions extends FakeChromeOptions {
  /** `welcome`: the page opened in a tab on install (`welcome.tsx`) instead of the popup. */
  page?: "popup" | "welcome";
  /** The popup's page, as in its hash: `/`, `/dictionary`… */
  route?: string;
  /** The locale directory the popup is shown in: `en`, `ar`, `pt_BR`… */
  language?: string;
  routes?: Record<string, Route>;
  /** `false`: no background worker answers the popup's messages, as when it is gone. */
  background?: boolean;
}

/**
 * The popup as `main.tsx` mounts it (or the welcome page as `welcome.tsx`
 * does), in a fresh profile, with the real background worker answering its
 * messages in the same process.
 */
export async function renderPopup({
  page = "popup",
  route = "/",
  language = "en",
  routes,
  background = true,
  ...chromeOptions
}: PopupOptions = {}) {
  const fake = installFakeChrome(chromeOptions);
  const network = installFakeNetwork(routes);
  if (background) new MessageService();

  await i18n.changeLanguage(language);
  window.location.hash = `#${route}`;

  const user = userEvent.setup();
  const view = render(
    <StrictMode>
      {page === "welcome" ? <WelcomeApp/> : (
        <HashRouter>
          <App/>
        </HashRouter>
      )}
    </StrictMode>,
  );

  return { fake, network, user, ...view };
}

/**
 * Every text the element `selector` (a field, or `body` for the whole popup)
 * has shown since this call, the current one last. A form drawn with other
 * values and corrected or replaced before the test looks leaves them here:
 * mutation records keep what the page no longer has.
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

/**
 * Escape pressed on the element that has the focus inside `opened` (an open
 * dialog, menu or list), as the keyboard sends it. Returns whether the page
 * left the key unhandled (`fireEvent`'s answer): Chrome then closes the whole
 * popup window, not only what was open in it.
 */
export async function pressEscapeIn(opened: HTMLElement) {
  await waitFor(() => {
    if (!opened.contains(document.activeElement)) throw new Error("The focus is not inside the open dialog or menu");
  });
  return fireEvent.keyDown(document.activeElement!, { key: "Escape" });
}

type User = ReturnType<typeof userEvent.setup>;

/** Opens the panel of the language field named `label` (`LanguageSelect`), as a viewer does: a click on the field. */
export async function openLanguagePanel(user: User, label: string) {
  await user.click(await screen.findByRole("combobox", { name: new RegExp(label) }));
  return screen.findByRole("dialog", { name: label });
}

/**
 * The languages listed in an open language panel, in order, or those that
 * match `filter`. `hidden: true`: the panel was found visible
 * (`findByRole("dialog")`), and checking each of Google's 249 languages again
 * (the computed style of it and its ancestors) takes jsdom 0.4 s a query —
 * these tests reached Vitest's 5 s on a slow CI machine.
 */
export function languageOptions(panel: HTMLElement, filter: Pick<ByRoleOptions, "selected"> = {}) {
  return within(panel).queryAllByRole("option", { ...filter, hidden: true });
}

/**
 * The one language `name` in an open language panel. Found by its text, which
 * is its accessible name too: `getByRole`'s `name` computes the names of all
 * 249 languages, half a second in jsdom.
 */
export function languageOption(panel: HTMLElement, name: string) {
  const found = languageOptions(panel).filter((option) => option.textContent === name);
  if (found.length !== 1) {
    throw new Error(`${found.length} languages "${name}" in the panel, not one`);
  }
  return found[0];
}

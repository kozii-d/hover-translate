import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { REPO_ROOT } from "@extension-test/fakeChrome.ts";
import { recordFieldTexts, renderPopup } from "./renderPopup.tsx";

const EMPTY = "Dictionary is empty";

const readLocale = (language: string, ns: string) =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "_locales", language, `${ns}.json`), "utf8"));
const ERROR_TITLE = "Couldn't load this page";

const SAVED = [{
  id: "w1",
  originalText: "riverbank",
  translatedText: "берег",
  sourceLanguageCode: "en",
  targetLanguageCode: "ru",
  translatorName: "Google",
  timestamp: Date.UTC(2026, 8, 23, 12),
}];

describe("the Dictionary page says \"empty\" only when it has read that there is nothing", () => {
  it("saved words: never the empty dictionary, not even before they are read", async () => {
    const shown = recordFieldTexts("body");
    await renderPopup({ route: "/dictionary", local: { savedTranslations: SAVED } });

    await screen.findByText("riverbank");

    expect(shown().filter((text) => text.includes(EMPTY))).toEqual([]);
  });

  it("nothing saved: the empty dictionary", async () => {
    await renderPopup({ route: "/dictionary" });

    expect(await screen.findByText(EMPTY)).toBeTruthy();
  });

  it("words that cannot be read: the error screen, never the empty dictionary, no export; Try again shows them", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const shown = recordFieldTexts("body");
    const { fake, user } = await renderPopup({
      route: "/dictionary",
      local: { savedTranslations: SAVED },
      failingReads: { local: ["savedTranslations"] },
    });

    await screen.findByText(ERROR_TITLE);
    expect(screen.getByRole("tab", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Export translations" })).toBeNull();
    expect(screen.queryByText("Failed to get translations")).toBeNull();
    expect(shown().filter((text) => text.includes(EMPTY))).toEqual([]);
    expect(error).toHaveBeenCalledWith("Could not load the saved translations", expect.objectContaining({
      message: "The local storage could not be read",
    }));

    fake.failingReads.local = [];
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("riverbank")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export translations" })).toBeTruthy();
    expect(screen.queryByText(ERROR_TITLE)).toBeNull();
    expect(fake.storage.local.savedTranslations).toEqual(SAVED);
  });
});

describe("the saved words' buttons", () => {
  it("in ru, the delete button is named in Russian, by its title", async () => {
    await renderPopup({ language: "ru", route: "/dictionary", local: { savedTranslations: SAVED } });

    expect(await screen.findByRole("button", { name: readLocale("ru", "dictionary").actions.deleteTranslation.tooltip })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
  });

  it("Clear all asks in a dialog named by its title, its button red; confirmed, nothing is left", async () => {
    const { fake, user } = await renderPopup({ route: "/dictionary", local: { savedTranslations: SAVED } });

    await user.click(await screen.findByRole("button", { name: "Clear all" }));
    const dialog = await screen.findByRole("dialog", { name: "Clear all translations?" });
    const clear = within(dialog).getByRole("button", { name: "Clear" });
    expect(clear.classList).toContain("MuiButton-colorError");
    await user.click(clear);

    expect(await screen.findByText(EMPTY)).toBeTruthy();
    expect(fake.storage.local.savedTranslations).toEqual([]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("a word that cannot be removed: a notification raised above the page, its close button named in the popup's language", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { user } = await renderPopup({
      language: "ru",
      route: "/dictionary",
      local: { savedTranslations: SAVED },
      failingWrites: { local: ["savedTranslations"] },
    });

    await user.click(await screen.findByRole("button", { name: readLocale("ru", "dictionary").actions.deleteTranslation.tooltip }));

    const notification = await screen.findByRole("alert");
    expect(notification.textContent).toContain("Failed to remove translation");
    expect(notification.classList).toContain("MuiPaper-elevation6");
    const close = within(notification).getByRole("button", { name: readLocale("ru", "modals").confirmation.actions.close.text });
    expect(close.getAttribute("title")).toBe(readLocale("ru", "modals").confirmation.actions.close.text);
  });
});

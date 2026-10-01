import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { recordFieldTexts, renderPopup } from "./renderPopup.tsx";

const EMPTY = "Dictionary is empty";
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

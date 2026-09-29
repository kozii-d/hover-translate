import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { defaultSettings } from "@extension/common/consts/defaultValues.ts";
import { BING_ORIGIN } from "@extension/common/translators/bing/bing.ts";
import { CHROME_WEB_STORE_ID, UNPACKED_ID } from "@extension-test/fakeChrome.ts";
import { renderPopup } from "./renderPopup.tsx";

const DAY = 24 * 60 * 60 * 1000;

const translatorSelect = () => screen.findByRole("combobox", { name: /Translator/ });

/** Opens the translator list and picks one, as a viewer does. */
const pickTranslator = async (user: Awaited<ReturnType<typeof renderPopup>>["user"], name: string) => {
  await user.click(await translatorSelect());
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${name}`) }));
};

describe("switching to Bing asks for access to www.bing.com", () => {
  it("refused: Google stays, saved and on screen, and the viewer is told why", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { fake, user } = await renderPopup({
      sync: { settings: defaultSettings },
      answerPermissionPrompt: () => false,
    });

    await pickTranslator(user, "Bing");

    expect(fake.permissionPrompts).toEqual([[BING_ORIGIN]]);
    await screen.findByText("HoverTranslate is not allowed to connect to Bing. Staying on Google.");
    expect((await translatorSelect()).textContent).toBe("Google");
    expect(fake.storage.sync.settings).toEqual(defaultSettings);
  });

  it("granted: Bing is saved, with the languages as Bing spells them", async () => {
    const { fake, user } = await renderPopup({
      uiLanguage: "en-US",
      sync: { settings: { ...defaultSettings, targetLanguageCode: "zh-CN" } },
      answerPermissionPrompt: () => true,
    });

    await pickTranslator(user, "Bing");

    await waitFor(() => expect(fake.storage.sync.settings).toMatchObject({ translator: "bing", targetLanguageCode: "zh-Hans" }));
    expect(fake.grantedOrigins.has(BING_ORIGIN)).toBe(true);
  });
});

describe("the settings opened with Bing selected and no access to it", () => {
  it("move to Google with a notice that says how to allow Bing; the languages move too", async () => {
    const { fake } = await renderPopup({
      uiLanguage: "uk",
      sync: { settings: { ...defaultSettings, translator: "bing", sourceLanguageCode: "prs", targetLanguageCode: "tlh-Latn" } },
    });

    await screen.findByText("Bing needs access to www.bing.com. Pick Bing in the list to allow it. Switching to Google.");
    await waitFor(() => expect(fake.storage.sync.settings).toMatchObject({
      translator: "google",
      sourceLanguageCode: "auto",
      targetLanguageCode: "uk",
    }));
    expect((await translatorSelect()).textContent).toBe("Google");
    // Asking needs a user gesture: the page never prompts by itself.
    expect(fake.permissionPrompts).toEqual([]);
  });

  it("with access, Bing stays", async () => {
    const settings = { ...defaultSettings, translator: "bing" as const };
    const { fake } = await renderPopup({ sync: { settings }, grantedOrigins: [BING_ORIGIN] });

    expect((await translatorSelect()).textContent).toBe("Bing");
    expect(screen.queryByText(/needs access/)).toBeNull();
    expect(fake.storage.sync.settings).toEqual(settings);
  });
});

describe("the rating card on the Settings page", () => {
  const due = { settings: defaultSettings, installedAt: Date.now() - 8 * DAY, updatedAt: Date.now() - 8 * DAY };
  const words = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `w${index}`, originalText: `w${index}` }));
  const cache = (count: number) => Array.from({ length: count }, (_, index) => ({ key: `k${index}`, value: {} }));
  const card = () => screen.queryByText("If HoverTranslate helps you learn, a rating helps other learners find it.");

  /** Settled: either the card or the tips it replaces are on screen. */
  const settled = () => waitFor(() => expect(card() ?? screen.queryByText(/hold Shift/)).not.toBeNull());

  it.each([
    ["4 saved words", { savedTranslations: words(4) }, false],
    ["5 saved words", { savedTranslations: words(5) }, true],
    ["29 cached translations", { translationCache: cache(29) }, false],
    ["30 cached translations", { translationCache: cache(30) }, true],
  ])("%s → shown: %j", async (_, local, shown) => {
    await renderPopup({ sync: due, local });
    await settled();
    expect(Boolean(card())).toBe(shown);
  });

  it("not in the week after an update", async () => {
    await renderPopup({ sync: { ...due, updatedAt: Date.now() - DAY }, local: { savedTranslations: words(5) } });
    await settled();
    expect(card()).toBeNull();
  });

  it("not in a build that belongs to no store", async () => {
    await renderPopup({ id: UNPACKED_ID, sync: due, local: { savedTranslations: words(5) } });
    await settled();
    expect(card()).toBeNull();
  });

  it("\"Rate\" records the answer before it opens the store: the popup closes with the new tab", async () => {
    const { fake, user } = await renderPopup({ sync: due, local: { savedTranslations: words(5) } });

    await user.click(await screen.findByRole("button", { name: "Rate" }));

    await waitFor(() => expect(fake.createdTabs).toHaveLength(1));
    expect(fake.createdTabs[0]).toEqual({
      url: `https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_ID}/reviews`,
      sync: expect.objectContaining({ ratingPromptDone: true }),
    });
    expect(card()).toBeNull();
  });

  it("\"Don't ask again\" ends the request without a tab", async () => {
    const { fake, user } = await renderPopup({ sync: due, local: { savedTranslations: words(5) } });

    await user.click(await screen.findByRole("button", { name: "Don't ask again" }));

    await waitFor(() => expect(fake.storage.sync.ratingPromptDone).toBe(true));
    expect(fake.createdTabs).toEqual([]);
  });

  it("✕ puts it off: the count and the moment, nothing else", async () => {
    const { fake, user } = await renderPopup({ sync: due, local: { savedTranslations: words(5) } });

    const status = await screen.findByRole("status");
    await user.click(within(status).getByRole("button", { name: "Not now" }));

    await waitFor(() => expect(fake.storage.sync.ratingPromptPopup).toEqual({ count: 1, lastDismissedAt: expect.any(Number) }));
    expect(fake.storage.sync).not.toHaveProperty("ratingPromptDone");
    expect(fake.createdTabs).toEqual([]);
  });
});

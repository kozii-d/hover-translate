import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { defaultSettings } from "@extension/common/consts/defaultValues.ts";
import { BING_ORIGIN } from "@extension/common/translators/bing/bing.ts";
import { DEEPL_FREE_API_URL } from "@extension/common/translators/deepl/consts.ts";
import { CHROME_WEB_STORE_ID, UNPACKED_ID } from "@extension-test/fakeChrome.ts";
import { json } from "@extension-test/fakeNetwork.ts";
import { renderPopup } from "./renderPopup.tsx";

const DAY = 24 * 60 * 60 * 1000;

const translatorSelect = (label = "Translator") => screen.findByRole("combobox", { name: new RegExp(label) });

/** Opens the translator list and picks one, as a viewer does. `label` is the field's name in the popup's language. */
const pickTranslator = async (user: Awaited<ReturnType<typeof renderPopup>>["user"], name: string, label?: string) => {
  await user.click(await translatorSelect(label));
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

describe("the language lists are named in the popup's language", () => {
  const sourceSelect = (label: string) => screen.findByRole("combobox", { name: new RegExp(label) });

  /** Opens a list, as a viewer does, and reads its items in order. */
  const openList = async (user: Awaited<ReturnType<typeof renderPopup>>["user"], label: string) => {
    await user.click(await sourceSelect(label));
    return (await screen.findAllByRole("option")).map((option) => option.textContent);
  };

  it("in Russian: Google Translate's names, capitalised, in the Russian alphabet, detection first", async () => {
    const { user } = await renderPopup({ language: "ru", uiLanguage: "ru", sync: { settings: defaultSettings } });

    const names = await openList(user, "Перевести с");

    expect(names[0]).toBe("Определить язык");
    // Alur is a language `Intl` does not know at all.
    expect(names).toEqual(expect.arrayContaining(["Английский", "Японский", "Китайский (упрощенный)", "Алур"]));
    expect(names.indexOf("Абхазский")).toBeLessThan(names.indexOf("Японский"));
    expect(names.filter((name) => /[A-Za-z]/.test(name ?? ""))).toEqual([]);
  });

  it("in English: the translator's own names, detection first", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    const names = await openList(user, "Translate from");

    expect(names[0]).toBe("Detect language");
    expect(names).toEqual(expect.arrayContaining(["Myanmar (Burmese)", "Chinese (Simplified)"]));
    expect(names.indexOf("Abkhaz")).toBeLessThan(names.indexOf("Zulu"));
  });

  it("detection carries the sparkles, in the list and in the closed field, without changing its name", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });
    const sparkles = "[data-testid='AutoAwesomeIcon']";

    expect((await sourceSelect("Translate from")).querySelector(sparkles)).not.toBeNull();
    expect((await sourceSelect("Translate to")).querySelector(sparkles)).toBeNull();

    await openList(user, "Translate from");
    const [detect, ...languages] = screen.getAllByRole("option");
    expect(detect).toBe(screen.getByRole("option", { name: "Detect language" }));
    expect(detect.querySelector(sparkles)).not.toBeNull();
    expect(languages.filter((option) => option.querySelector(sparkles))).toEqual([]);
  });

  it("the notice about a language the new translator lacks names both languages in Russian", async () => {
    const { fake, user } = await renderPopup({
      language: "ru",
      uiLanguage: "ru",
      sync: { settings: { ...defaultSettings, targetLanguageCode: "de" } },
      answerPermissionPrompt: () => true,
    });

    await pickTranslator(user, "Bing", "Переводчик");

    await screen.findByText("Немецкий недоступен в качестве целевого языка для переводчика Bing. Переключение на Русский.");
    await waitFor(() => expect(fake.storage.sync.settings).toMatchObject({ translator: "bing", targetLanguageCode: "ru" }));
  });

  it("Bing's spelling of a code gets Google's name; a code nobody can read keeps the name Bing gave it", async () => {
    const errors = vi.spyOn(console, "error");
    const { user } = await renderPopup({
      language: "ru",
      uiLanguage: "ru",
      sync: { settings: { ...defaultSettings, translator: "bing", targetLanguageCode: "ru" } },
      grantedOrigins: [BING_ORIGIN],
      routes: {
        "api.cognitive.microsofttranslator.com": () => json({
          translation: {
            en: { name: "English" },
            ru: { name: "Russian" },
            "zh-Hans": { name: "Chinese Simplified" },
            x: { name: "Unknown X" },
          },
        }),
      },
    });

    const names = await openList(user, "Перевести на");

    expect(names).toEqual(["Английский", "Китайский (упрощенный)", "Русский", "Unknown X"]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("Bing's two Kurdish languages get their own Google names: its `ku` is Google's Sorani `ckb`", async () => {
    const { user } = await renderPopup({
      language: "ru",
      uiLanguage: "ru",
      sync: { settings: { ...defaultSettings, translator: "bing", targetLanguageCode: "ru" } },
      grantedOrigins: [BING_ORIGIN],
      routes: {
        "api.cognitive.microsofttranslator.com": () => json({
          translation: {
            en: { name: "English" },
            ku: { name: "Kurdish (Central)" },
            kmr: { name: "Kurdish (Northern)" },
            ru: { name: "Russian" },
          },
        }),
      },
    });

    const names = await openList(user, "Перевести на");

    expect(names).toEqual(["Английский", "Курдский (курманджи)", "Курдский (сорани)", "Русский"]);
  });

  it("DeepL's source `pt` is any Portuguese, not Google's Brazilian one", async () => {
    const { user } = await renderPopup({
      language: "ru",
      uiLanguage: "ru",
      sync: { settings: { ...defaultSettings, translator: "deepl", targetLanguageCode: "ru" } },
      local: { apiKeys: { deepl: "deepl-key:fx" } },
      grantedOrigins: [`${DEEPL_FREE_API_URL}/*`],
    });

    const names = await openList(user, "Перевести с");

    expect(names).toContain("Португальский");
    expect(names).not.toContain("Португальский (Бразилия)");
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

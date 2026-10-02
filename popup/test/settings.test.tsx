import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { defaultSettings } from "@extension/common/consts/defaultValues.ts";
import { BING_ORIGIN } from "@extension/common/translators/bing/bing.ts";
import { DEEPL_FREE_API_URL } from "@extension/common/translators/deepl/consts.ts";
import googleLanguages from "@extension/common/translators/google/availableLanguages.json";
import { CHROME_WEB_STORE_ID, UNPACKED_ID } from "@extension-test/fakeChrome.ts";
import { json } from "@extension-test/fakeNetwork.ts";
import { apiKeyService } from "@/shared/lib/helpers/apiKeys.ts";
import { recordFieldTexts, renderPopup } from "./renderPopup.tsx";

const DAY = 24 * 60 * 60 * 1000;

const translatorSelect = (label = "Translator") => screen.findByRole("combobox", { name: new RegExp(label) });

/** Opens the translator list and picks one, as a viewer does. `label` is the field's name in the popup's language. */
const pickTranslator = async (user: Awaited<ReturnType<typeof renderPopup>>["user"], name: string, label?: string) => {
  await user.click(await translatorSelect(label));
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${name}`) }));
};

/** Every `settings` the page has written to the synced storage. */
const settingsWrites = (fake: Awaited<ReturnType<typeof renderPopup>>["fake"]) => {
  const set = vi.spyOn(fake.chrome.storage.sync, "set");
  return () => set.mock.calls.map(([items]) => items as Record<string, unknown>).filter((items) => "settings" in items);
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

it("the settings page shows its skeleton until the language lists are loaded, not fields with nothing to pick", async () => {
  const warn = vi.spyOn(console, "warn");
  await renderPopup({ sync: { settings: defaultSettings } });

  await translatorSelect();
  // MUI's warning about a select whose value is not among its options: the target language with an empty list.
  expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("out-of-range value"));
});

it("the page draws its fields once, with the stored settings", async () => {
  const shown = recordFieldTexts("#targetLanguageCode");
  await renderPopup({ sync: { settings: { ...defaultSettings, targetLanguageCode: "ru" } } });

  await screen.findByText("Russian");

  expect(shown()).toEqual(["Russian"]);
});

it("picking DeepL with a stored key switches to it, even when the keys are read after the language lists", async () => {
  // A slow disk: the keys arrive long after everything else the page reads.
  const getAll = apiKeyService.getAll.bind(apiKeyService);
  vi.spyOn(apiKeyService, "getAll").mockImplementation(() =>
    new Promise((resolve) => setTimeout(resolve, 500)).then(getAll));
  const { fake, user } = await renderPopup({
    sync: { settings: defaultSettings },
    local: { apiKeys: { deepl: "deepl-key:fx" } },
    grantedOrigins: [`${DEEPL_FREE_API_URL}/*`],
    answerPermissionPrompt: () => true,
  });

  await pickTranslator(user, "DeepL");

  await waitFor(() => expect(fake.storage.sync.settings).toMatchObject({ translator: "deepl" }));
  expect(screen.queryByText("Connect DeepL")).toBeNull();
});

it("DeepL's usage is written in the popup's language, also one named after its folder (`pt_BR`)", async () => {
  await renderPopup({
    language: "pt_BR",
    uiLanguage: "pt-BR",
    sync: { settings: { ...defaultSettings, translator: "deepl", targetLanguageCode: "ru" } },
    local: { apiKeys: { deepl: "deepl-key:fx" } },
    grantedOrigins: [`${DEEPL_FREE_API_URL}/*`],
  });

  // The fake DeepL has used 1250 of 500000 characters. A tag `Intl` rejects would fall back to the browser's own digits.
  expect(await screen.findByText("1.250 de 500.000 caracteres usados neste período de cobrança")).toBeTruthy();
});

it("keys that cannot be read leave the page usable, as without a key: DeepL asks for one", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(apiKeyService, "getAll").mockRejectedValue(new Error("The disk is gone"));
  const { fake, user } = await renderPopup({ sync: { settings: defaultSettings } });

  await pickTranslator(user, "DeepL");

  expect(await screen.findByText("Connect DeepL")).toBeTruthy();
  expect(fake.storage.sync.settings).toEqual(defaultSettings);
  expect(error).toHaveBeenCalledWith("Could not read the stored API keys", expect.any(Error));
});

describe("the settings page that cannot load says so, instead of a skeleton forever or a form with nothing in it", () => {
  const ERROR_TITLE = "Couldn't load this page";

  it("settings that cannot be read: the error screen with the tabs, nothing written; Try again shows the stored ones", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const settings = { ...defaultSettings, targetLanguageCode: "ru" };
    const { fake, user } = await renderPopup({ sync: { settings }, failingReads: { sync: ["settings"] } });
    const writes = settingsWrites(fake);

    await screen.findByText(ERROR_TITLE);
    expect(screen.getByText("If this keeps happening, restart your browser.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Customize" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: /Translator/ })).toBeNull();
    expect(screen.queryByText("Failed to get settings")).toBeNull();
    expect(error).toHaveBeenCalledWith("Could not load the settings", expect.objectContaining({
      message: "The sync storage could not be read",
    }));

    fake.failingReads.sync = [];
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect((await translatorSelect()).textContent).toBe("Google");
    expect(await screen.findByText("Russian")).toBeTruthy();
    expect(screen.queryByText(ERROR_TITLE)).toBeNull();
    expect(writes()).toEqual([]);
    expect(fake.storage.sync.settings).toEqual(settings);
  });

  it("the background does not answer and the translator is Google: the error screen, not a form with empty lists", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fake } = await renderPopup({ sync: { settings: defaultSettings }, background: false });
    const writes = settingsWrites(fake);

    await screen.findByText(ERROR_TITLE);
    expect(screen.queryByRole("combobox", { name: /Translator/ })).toBeNull();
    // The reason goes to the console, not to a notice next to the screen.
    expect(screen.queryByText(/translator is unavailable/)).toBeNull();
    expect(error).toHaveBeenCalledWith("Could not load the settings", expect.objectContaining({
      message: "The background script did not respond",
    }));
    expect(writes()).toEqual([]);
  });

  it("the background does not answer and the translator is Bing: the error screen, Bing kept, no notice of a switch that did not happen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const settings = { ...defaultSettings, translator: "bing" as const };
    const { fake } = await renderPopup({ sync: { settings }, grantedOrigins: [BING_ORIGIN], background: false });
    const writes = settingsWrites(fake);

    await screen.findByText(ERROR_TITLE);
    expect(screen.queryByRole("combobox", { name: /Translator/ })).toBeNull();
    expect(screen.queryByText(/Switching back to Google/)).toBeNull();
    expect(screen.queryByText("Failed to get settings")).toBeNull();
    expect(writes()).toEqual([]);
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

  it("in Brazilian Portuguese, named after its folder `pt_BR`: in its alphabet, \"Árabe\" among the A's", async () => {
    const { user } = await renderPopup({ language: "pt_BR", uiLanguage: "pt-BR", sync: { settings: defaultSettings } });

    const names = await openList(user, "Traduzir de");

    expect(names.indexOf("Árabe")).toBeGreaterThan(names.indexOf("Amárico"));
    expect(names.indexOf("Árabe")).toBeLessThan(names.indexOf("Basco"));
  });

  it("in English: the translator's own names, detection first", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    const names = await openList(user, "Translate from");

    expect(names[0]).toBe("Detect language");
    // As a source Google's `zh-CN` is just "Chinese": it reads traditional characters too.
    expect(names).toEqual(expect.arrayContaining(["Myanmar (Burmese)", "Chinese"]));
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

describe("Google's lists have one entry per language", () => {
  const languageField = (label: string) => screen.findByRole("combobox", { name: new RegExp(label) });

  /** The names in a language field's panel, read as a viewer opens it, and the panel closed again. */
  const panelNames = async (user: Awaited<ReturnType<typeof renderPopup>>["user"], label: string) => {
    await user.click(await languageField(label));
    const panel = await screen.findByRole("dialog", { name: label });
    const names = within(panel).getAllByRole("option").map((option) => option.textContent);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    return names;
  };

  const duplicates = (names: (string | null)[]) => names.filter((name, index) => names.indexOf(name) !== index);

  it.each([
    ["en", "Translate from", "Translate to", "Hebrew"],
    ["ru", "Перевести с", "Перевести на", "Иврит"],
  ])("in %j no two languages share a name", async (language, sourceLabel, targetLabel, hebrew) => {
    const { user } = await renderPopup({ language, uiLanguage: language, sync: { settings: defaultSettings } });

    const sources = await panelNames(user, sourceLabel);
    const targets = await panelNames(user, targetLabel);

    expect(duplicates(sources)).toEqual([]);
    expect(duplicates(targets)).toEqual([]);
    expect(targets).toContain(hebrew);
    expect(sources.length).toBeGreaterThan(240);
    expect(targets.length).toBeGreaterThan(240);
  });

  it("a language stored in a spelling Google no longer lists is saved as Google spells it, silently", async () => {
    const shown = recordFieldTexts("#targetLanguageCode");
    const { fake } = await renderPopup({
      sync: { settings: { ...defaultSettings, sourceLanguageCode: "zh-TW", targetLanguageCode: "he" } },
    });

    await waitFor(() => expect(fake.storage.sync.settings).toEqual({
      ...defaultSettings,
      sourceLanguageCode: "zh-CN",
      targetLanguageCode: "iw",
    }));
    expect((await languageField("Translate from")).textContent).toBe("Chinese");
    expect((await languageField("Translate to")).textContent).toBe("Hebrew");
    expect(shown()).toEqual(["Hebrew"]);
    expect(document.querySelector(".MuiSnackbar-root")).toBeNull();
  });

  it("the new spelling cannot be saved: the form shows it all the same, the old one stays stored, the error goes to the console", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const settings = { ...defaultSettings, sourceLanguageCode: "zh-TW", targetLanguageCode: "he" };
    const { fake } = await renderPopup({ sync: { settings }, failingWrites: { sync: ["settings"] } });

    expect((await languageField("Translate from")).textContent).toBe("Chinese");
    expect((await languageField("Translate to")).textContent).toBe("Hebrew");
    expect(screen.queryByText("Couldn't load this page")).toBeNull();
    expect(fake.storage.sync.settings).toEqual(settings);
    expect(error).toHaveBeenCalledWith("Could not save the languages as the translator spells them", expect.objectContaining({
      message: "The sync storage could not be written",
    }));
    expect(document.querySelector(".MuiSnackbar-root")).toBeNull();
  });

  it.each([["fil", "tl", "Filipino"], ["jv", "jw", "Javanese"], ["zh", "zh-CN", "Chinese (Simplified)"]])(
    "%j becomes %j", async (stored, spelled, name) => {
      const { fake } = await renderPopup({ sync: { settings: { ...defaultSettings, targetLanguageCode: stored } } });

      await waitFor(() => expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, targetLanguageCode: spelled }));
      expect((await languageField("Translate to")).textContent).toBe(name);
    });

  // Google's old list named `zh` "Chinese (Simplified)", next to `zh-TW`.
  it("\"zh\" becomes \"zh-CN\" with the browser in Traditional Chinese too", async () => {
    const { fake } = await renderPopup({ uiLanguage: "zh-TW", sync: { settings: { ...defaultSettings, targetLanguageCode: "zh" } } });

    await waitFor(() => expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, targetLanguageCode: "zh-CN" }));
    expect((await languageField("Translate to")).textContent).toBe("Chinese (Simplified)");
  });

  it("settings Google spells as it lists them are not written again", async () => {
    const settings = { ...defaultSettings, sourceLanguageCode: "pt-PT", targetLanguageCode: "iw" };
    const { fake } = await renderPopup({ sync: { settings } });
    const writes = settingsWrites(fake);

    expect((await languageField("Translate to")).textContent).toBe("Hebrew");
    expect((await languageField("Translate from")).textContent).toBe("Portuguese (Portugal)");
    expect(writes()).toEqual([]);
    expect(fake.storage.sync.settings).toEqual(settings);
  });

  // Either language missing leaves both as stored, even the other one in an old spelling.
  it.each([["tlh-Latn", "tlh-Latn"], ["tlh-Latn", "he"], ["zh-TW", "tlh-Latn"]])(
    "a language Google does not offer at all is left as stored, without a notice: from %j to %j", async (source, target) => {
      const settings = { ...defaultSettings, sourceLanguageCode: source, targetLanguageCode: target };
      const { fake } = await renderPopup({ sync: { settings } });
      const writes = settingsWrites(fake);

      expect((await translatorSelect()).textContent).toBe("Google");
      await languageField("Translate to");
      expect(writes()).toEqual([]);
      expect(fake.storage.sync.settings).toEqual(settings);
      expect(document.querySelector(".MuiSnackbar-root")).toBeNull();
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

// Firefox before 127 and Chrome's site access "On click" leave the content
// script without access to YouTube, and the extension does nothing there.
describe("the line about access to YouTube on the Settings page", () => {
  const LINE = "HoverTranslate has no access to YouTube, so it can't translate subtitles. Allow access, then reload the YouTube page.";
  const line = () => screen.queryByText(LINE);
  const ratingDue = {
    sync: { settings: defaultSettings, installedAt: Date.now() - 8 * DAY, updatedAt: Date.now() - 8 * DAY },
    local: { savedTranslations: Array.from({ length: 5 }, (_, index) => ({ id: `w${index}`, originalText: `w${index}` })) },
  };
  const ratingCard = () => screen.queryByText("If HoverTranslate helps you learn, a rating helps other learners find it.");
  const shiftTip = () => screen.queryByText(/hold Shift/);
  const deeplTip = () => screen.queryByText(/DeepL translates a word/);

  it.each([
    ["the rating card due", ratingDue],
    ["the tips due", { sync: { settings: defaultSettings } }],
  ])("no access, %s: the line above \"Translate from\", and nothing else in that slot; no prompt by itself", async (_, stored) => {
    const { fake } = await renderPopup({ ...stored, contentScriptAccess: false });

    const shown = await screen.findByText(LINE);
    await translatorSelect();

    const sourceField = document.querySelector("#sourceLanguageCode")!;
    expect(shown.compareDocumentPosition(sourceField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Allow access" })).toBeTruthy();
    expect(ratingCard()).toBeNull();
    expect(shiftTip()).toBeNull();
    expect(deeplTip()).toBeNull();
    // Asking needs a user gesture: the page never prompts by itself.
    expect(fake.permissionPrompts).toEqual([]);
  });

  it("\"Allow access\" granted: the content scripts' hosts are asked for; the line goes, the rating card comes", async () => {
    const { fake, user } = await renderPopup({ ...ratingDue, contentScriptAccess: false, answerPermissionPrompt: () => true });

    await user.click(await screen.findByRole("button", { name: "Allow access" }));

    expect(fake.permissionPrompts).toEqual([["*://*.youtube.com/*"]]);
    await waitFor(() => expect(line()).toBeNull());
    expect(await screen.findByText("If HoverTranslate helps you learn, a rating helps other learners find it.")).toBeTruthy();
  });

  it("\"Allow access\" granted, nothing due: the tips come", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings }, contentScriptAccess: false, answerPermissionPrompt: () => true });

    await user.click(await screen.findByRole("button", { name: "Allow access" }));

    await waitFor(() => expect(shiftTip()).not.toBeNull());
    expect(deeplTip()).not.toBeNull();
    expect(line()).toBeNull();
  });

  it("refused: the line stays", async () => {
    const { fake, user } = await renderPopup({ sync: { settings: defaultSettings }, contentScriptAccess: false, answerPermissionPrompt: () => false });

    await user.click(await screen.findByRole("button", { name: "Allow access" }));

    expect(fake.permissionPrompts).toEqual([["*://*.youtube.com/*"]]);
    expect(await chrome.permissions.contains({ origins: ["https://www.youtube.com/*"] })).toBe(false);
    expect(line()).not.toBeNull();
    expect(shiftTip()).toBeNull();
  });

  it("the prompt fails: the line stays, the error goes to the console", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { user } = await renderPopup({ sync: { settings: defaultSettings }, contentScriptAccess: false });
    const failure = new Error("This function must be called during a user gesture");
    vi.spyOn(chrome.permissions, "request").mockRejectedValue(failure);

    await user.click(await screen.findByRole("button", { name: "Allow access" }));

    await waitFor(() => expect(error).toHaveBeenCalledWith("Could not ask for access to YouTube", failure));
    expect(line()).not.toBeNull();
  });

  it("the browser cannot tell whether there is access: no line, the tips as usual", async () => {
    // Withheld, so only the failure can keep the line away. The form, and the
    // check with it, mounts once the settings are read: after this spy.
    await renderPopup({ sync: { settings: defaultSettings }, contentScriptAccess: false });
    const contains = vi.spyOn(chrome.permissions, "contains").mockRejectedValue(new Error("The permissions cannot be read"));

    await waitFor(() => expect(shiftTip()).not.toBeNull());
    expect(contains).toHaveBeenCalledWith({ origins: ["https://www.youtube.com/*"] });
    expect(line()).toBeNull();
  });

  it("only www.youtube.com granted, as by Chrome's \"On this site\": no line, the tips as usual", async () => {
    await renderPopup({ sync: { settings: defaultSettings }, contentScriptAccess: false, grantedOrigins: ["https://www.youtube.com/*"] });

    await waitFor(() => expect(shiftTip()).not.toBeNull());
    expect(line()).toBeNull();
  });

  it("access as after an install: no line", async () => {
    await renderPopup({ sync: { settings: defaultSettings } });

    await waitFor(() => expect(shiftTip()).not.toBeNull());
    expect(line()).toBeNull();
  });
});

// Chrome keeps the popup's scrollbar under `overflow: hidden`, so the padding
// MUI's scroll lock adds in its place would widen the popup window while the
// list or dialog is open. The lock is off in the theme, for every one of them.
describe("an open list or dialog leaves the page's style alone", () => {
  const expectNoScrollLock = () => {
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");
  };

  it("the translator list", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    await user.click(await translatorSelect());
    await screen.findByRole("option", { name: /^Bing/ });

    expectNoScrollLock();
  });

  it("the confirmation of \"Reset to default\"", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    await user.click(await screen.findByRole("button", { name: "Reset to default" }));
    await screen.findByText("Reset to default settings?");

    expectNoScrollLock();
  });

  it("the menu of popup languages", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    await user.click(await screen.findByRole("button", { name: "Change popup language" }));
    await screen.findByRole("menuitem", { name: "Русский" });

    expectNoScrollLock();
  });
});

describe("the language fields open a panel with a search", () => {
  type User = Awaited<ReturnType<typeof renderPopup>>["user"];

  const languageField = (label: string) => screen.findByRole("combobox", { name: new RegExp(label) });

  /** Opens the panel of a language field, as a viewer does. */
  const openPanel = async (user: User, label: string) => {
    await user.click(await languageField(label));
    return screen.findByRole("dialog", { name: label });
  };

  const optionNames = (panel: HTMLElement) => within(panel).queryAllByRole("option").map((option) => option.textContent);

  const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  it("opens on the field, named after it: the focus in the search, the current language selected and scrolled to", async () => {
    const scrolls = vi.spyOn(Element.prototype, "scrollIntoView");
    const errors = vi.spyOn(console, "error");
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");

    expect(document.activeElement).toBe(within(panel).getByRole("textbox", { name: "Search languages" }));
    expect(within(panel).getByRole("listbox", { name: "Translate to" })).toBeTruthy();
    const selected = within(panel).getByRole("option", { selected: true });
    expect(selected.textContent).toBe("English");
    expect(within(panel).getAllByRole("option", { selected: true })).toHaveLength(1);
    await waitFor(() => expect(scrolls.mock.contexts).toContain(selected));
    expect(scrolls).toHaveBeenCalledWith({ block: "center" });
    expect(errors).not.toHaveBeenCalled();
  });

  // Chrome keeps the popup's scrollbar under `overflow: hidden`, so the padding
  // MUI adds in its place would widen the popup window.
  it("leaves the page's style alone: no scroll lock, no padding in place of the scrollbar", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    await openPanel(user, "Translate to");

    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");
  });

  // Keyboard focus (`Mui-focusVisible`) is not reproduced by jsdom.
  it("the selected language is marked for the theme to show, and only it", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");
    const options = within(panel).getAllByRole("option");

    expect(options.filter((option) => option.classList.contains("Mui-selected")).map((option) => option.textContent)).toEqual(["English"]);
  });

  it("a part of the name finds the language, and Enter picks it: saved, the panel closed, the field shows it", async () => {
    const { fake, user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");
    await user.keyboard("germ");

    expect(optionNames(within(panel).getByRole("listbox"))).toEqual(["German"]);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, targetLanguageCode: "de" }));
    await closed();
    expect((await languageField("Translate to")).textContent).toBe("German");
  });

  it("a click on a language picks it", async () => {
    const { fake, user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate from");
    await user.click(within(panel).getByRole("option", { name: "Japanese" }));

    await waitFor(() => expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, sourceLanguageCode: "ja" }));
    await closed();
    expect((await languageField("Translate from")).textContent).toBe("Japanese");
  });

  it("the names that start with the search come first, then the alphabet", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");
    await user.keyboard("en");

    const names = optionNames(panel);
    expect(names[0]).toBe("English");
    expect(names.indexOf("Armenian")).toBeLessThan(names.indexOf("French"));
    expect(names.filter((name) => !/en/i.test(name ?? ""))).toEqual([]);
  });

  it("nothing found: no language, a line that says so, and Enter picks nothing", async () => {
    const { fake, user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");
    await user.keyboard("zzz{Enter}");

    expect(within(panel).queryAllByRole("option")).toEqual([]);
    expect(within(panel).getByText("No languages found")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Translate to" })).toBe(panel);
    expect(fake.storage.sync.settings).toEqual(defaultSettings);
  });

  it("Escape closes it without a change and gives the focus back to the field; the search starts empty again", async () => {
    const { fake, user } = await renderPopup({ sync: { settings: defaultSettings } });

    await openPanel(user, "Translate to");
    await user.keyboard("zzz{Escape}");

    await closed();
    expect(document.activeElement).toBe(await languageField("Translate to"));
    expect(fake.storage.sync.settings).toEqual(defaultSettings);

    const panel = await openPanel(user, "Translate to");
    expect(within(panel).getByRole("textbox", { name: "Search languages" })).toHaveProperty("value", "");
    expect(optionNames(panel)).toHaveLength(googleLanguages.targetLanguages.length);
  });

  // Chrome closes the whole popup on an Escape the page leaves unhandled.
  it("Escape is taken by the panel: it closes the panel, and the popup is left open", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");
    const notCancelled = fireEvent.keyDown(within(panel).getByRole("textbox", { name: "Search languages" }), { key: "Escape" });

    expect(notCancelled).toBe(false);
    await closed();
  });

  it("the back button closes it without a change", async () => {
    const { fake, user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");
    await user.click(within(panel).getByRole("button", { name: "Back" }));

    await closed();
    expect(fake.storage.sync.settings).toEqual(defaultSettings);
  });

  it("the keyboard opens it from the field and walks the two columns row by row", async () => {
    const { fake, user } = await renderPopup({ sync: { settings: defaultSettings } });

    (await languageField("Translate to")).focus();
    await user.keyboard("{Enter}");
    const panel = await screen.findByRole("dialog", { name: "Translate to" });
    const search = within(panel).getByRole("textbox", { name: "Search languages" });
    const options = within(panel).getAllByRole("option");
    expect(options.slice(0, 4).map((option) => option.textContent)).toEqual(["Abkhaz", "Acehnese", "Acholi", "Afar"]);

    const focused = () => document.activeElement;
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(options[0]);
    await user.keyboard("{ArrowRight}");
    expect(focused()).toBe(options[1]);
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe(options[3]);
    await user.keyboard("{ArrowLeft}");
    expect(focused()).toBe(options[2]);
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe(options[0]);
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe(search);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    expect(focused()).toBe(options[3]);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, targetLanguageCode: "aa" }));
    await closed();
  });

  it("Tab leaves the search for the selected language only, and a space picks the focused one", async () => {
    const { fake, user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");
    await user.tab();
    expect(document.activeElement).toBe(within(panel).getByRole("option", { name: "English" }));
    expect(within(panel).getAllByRole("option").filter((option) => option.tabIndex === 0)).toHaveLength(1);

    await user.keyboard("{ArrowRight} ");
    await waitFor(() => expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, targetLanguageCode: "eo" }));
    await closed();
  });

  it("with no selected language among those found, the first one is the one Tab reaches", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate to");
    await user.keyboard("germ");
    await user.tab();

    expect(document.activeElement).toBe(within(panel).getByRole("option", { name: "German" }));
  });

  it("detection is the first language of \"Translate from\", and is found by its name", async () => {
    const { user } = await renderPopup({ sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Translate from");
    expect(optionNames(panel)[0]).toBe("Detect language");
    expect(within(panel).getByRole("option", { selected: true }).textContent).toBe("Detect language");

    await user.keyboard("detect");
    expect(optionNames(panel)).toEqual(["Detect language"]);
  });

  it("in Russian: found by the Russian name and by the translator's English one", async () => {
    const { user } = await renderPopup({ language: "ru", uiLanguage: "ru", sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Перевести на");
    const search = within(panel).getByRole("textbox", { name: "Найти языки" });
    await user.keyboard("jap");
    expect(optionNames(panel)).toEqual(["Японский"]);

    await user.clear(search);
    await user.keyboard("ЯПОНС");
    expect(optionNames(panel)).toEqual(["Японский"]);
  });

  it("in Spanish: found without the accents", async () => {
    const { user } = await renderPopup({ language: "es", uiLanguage: "es", sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Traducir a");
    await user.keyboard("aleman");

    expect(optionNames(panel)).toEqual(["Alemán"]);
  });

  it("in Brazilian Portuguese, named after its folder `pt_BR`: found without the accents", async () => {
    const { user } = await renderPopup({ language: "pt_BR", uiLanguage: "pt-BR", sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Traduzir para");
    await user.keyboard("arab");

    expect(optionNames(panel)).toEqual(["Árabe"]);
  });

  it("in Turkish: a lowercase search finds the names that start with a dotted İ", async () => {
    const { user } = await renderPopup({ language: "tr", uiLanguage: "tr", sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "Şu dile çevir");
    const search = within(panel).getByRole("textbox", { name: "Dil ara" });
    await user.keyboard("isp");
    expect(optionNames(panel)).toEqual(["İspanyolca"]);

    await user.clear(search);
    await user.keyboard("ingilizce");
    expect(optionNames(panel)).toEqual(["İngilizce"]);
  });

  it("in Japanese: the voicing mark counts, \"ド\" is not \"ト\"", async () => {
    const { user } = await renderPopup({ language: "ja", uiLanguage: "ja", sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "翻訳先言語");
    await user.keyboard("ド");

    const names = optionNames(panel);
    expect(names).toContain("ドイツ語");
    expect(names).not.toContain("トルコ語");
    expect(names.filter((name) => !name?.includes("ド"))).toEqual([]);
  });

  it("in Arabic the arrows follow the reading direction", async () => {
    const { user } = await renderPopup({ language: "ar", uiLanguage: "ar", sync: { settings: defaultSettings } });

    const panel = await openPanel(user, "الترجمة إلى");
    const options = within(panel).getAllByRole("option");
    await user.keyboard("{ArrowDown}{ArrowLeft}");
    expect(document.activeElement).toBe(options[1]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(options[0]);
  });
});

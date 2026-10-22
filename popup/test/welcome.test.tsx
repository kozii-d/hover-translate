import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { defaultSettings } from "@extension/common/consts/defaultValues.ts";
import googleLanguages from "@extension/common/translators/google/availableLanguages.json";
import bingLanguages from "@extension-test/fixtures/bing-languages.json";
import { DEEPL_TARGET_LANGUAGES } from "@extension-test/fakeNetwork.ts";
import { DEEPL_FREE_API_URL } from "@extension/common/translators/deepl/consts.ts";
import { REPO_ROOT } from "@extension-test/fakeChrome.ts";
import { languageOption, languageOptions, openLanguagePanel, renderPopup } from "./renderPopup.tsx";

type User = Awaited<ReturnType<typeof renderPopup>>["user"];

const readLocale = (language: string, ns: string) =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "_locales", language, `${ns}.json`), "utf8"));

/** Every `a.b.c` key of the English page strings: shown instead of a text, it means a missing string. */
const keyPaths = (() => {
  const paths: string[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => walk(child, prefix ? `${prefix}.${key}` : key));
    } else if (prefix.includes(".")) {
      paths.push(prefix);
    }
  };
  walk(readLocale("en", "welcome"), "");
  return paths;
})();

const languageField = (label = "Translate to") => screen.findByRole("combobox", { name: new RegExp(label) });

/** Opens the language panel, looks `name` up in its search and picks it, as a viewer does. */
const pickLanguage = async (user: User, name: string) => {
  const panel = await openLanguagePanel(user, "Translate to");
  await user.type(within(panel).getByRole("textbox", { name: "Search languages" }), name);
  await user.click(languageOption(panel, name));
};

const optionNames = async (user: User) => {
  const panel = await openLanguagePanel(user, "Translate to");
  return languageOptions(panel).map((option) => option.textContent);
};

/** The subtitle line in the demo player, as the page put it there. */
const captionLine = () => [...document.querySelectorAll(".ytp-caption-segment")].map((segment) => segment.textContent).join(" / ");

const tryAgain = () => screen.findByRole("button", { name: "Try again" });

describe.each([
  { language: "en", dir: "ltr" },
  { language: "ru", dir: "ltr" },
  { language: "ja", dir: "ltr" },
  { language: "ar", dir: "rtl" },
])("the welcome page in $language", ({ language, dir }) => {
  const strings = readLocale(language, "welcome");
  const settingsStrings = readLocale(language, "settings");

  it("its title, also the tab's; the language field; every string translated; no errors", async () => {
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");
    await renderPopup({ page: "welcome", language, sync: { settings: defaultSettings } });

    await screen.findByRole("heading", { level: 1, name: strings.pageTitle });
    await languageField(settingsStrings.fields.targetLanguageCode.label);

    expect(document.title).toBe(strings.pageTitle);
    // jsdom plays no video: the demo's badge says it is paused, in the page's language.
    expect(screen.getByTestId("demo-status").textContent).toBe(strings.demo.paused);
    expect(document.documentElement.dir).toBe(dir);
    const text = document.body.textContent ?? "";
    for (const hint of [strings.try.hover, strings.try.shift, strings.try.click, strings.start.captions, strings.start.pin]) {
      expect(text).toContain(hint);
    }
    expect(keyPaths.filter((key) => text.includes(key))).toEqual([]);
    expect(text).not.toContain("{{");
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
  });

  it("the DeepL card: what DeepL does and where to connect it, the field named as in the settings; one button, to the settings, no links", async () => {
    await renderPopup({ page: "welcome", language, sync: { settings: defaultSettings } });

    const card = await screen.findByRole("note");
    const where = strings.deepl.where.replace("{{translatorField}}", settingsStrings.fields.translator.label);
    expect(card.textContent).toContain(settingsStrings.contextHint.text);
    expect(card.textContent).toContain(settingsStrings.contextHint.keyNote);
    expect(card.textContent).toContain(where);
    expect(within(card).getAllByRole("button").map((button) => button.textContent)).toEqual([strings.openSettings]);
    expect(within(card).queryAllByRole("link")).toEqual([]);
  });
});

describe("the DeepL card's button opens the popup", () => {
  const button = (card: HTMLElement) => within(card).queryByRole("button", { name: "Open settings" });

  it("a click opens it, and the button stays", async () => {
    const { fake, user } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

    const card = await screen.findByRole("note");
    await user.click(button(card)!);

    expect(fake.popupsOpened()).toBe(1);
    expect(button(card)).not.toBeNull();
  });

  it("a browser without `action.openPopup` (Chrome before 118): no button, the text says where", async () => {
    await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, openPopup: "missing" });

    const card = await screen.findByRole("note");
    expect(button(card)).toBeNull();
    expect(card.textContent).toContain("Connect it in the settings: the HoverTranslate icon → Translator → DeepL.");
  });

  it("the browser refusing it (Chrome 118–126): a warning, the button goes, the text stays", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fake, user } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, openPopup: "refuses" });

    const card = await screen.findByRole("note");
    await user.click(button(card)!);

    await waitFor(() => expect(button(card)).toBeNull());
    expect(warn).toHaveBeenCalledWith("Could not open the popup", expect.any(Error));
    expect(fake.popupsOpened()).toBe(0);
    expect(card.textContent).toContain("Connect it in the settings: the HoverTranslate icon → Translator → DeepL.");
  });
});

describe("the language to translate into", () => {
  it("the stored translator's languages, the stored one selected", async () => {
    const { user } = await renderPopup({ page: "welcome", sync: { settings: { ...defaultSettings, targetLanguageCode: "ru" } } });

    expect((await languageField()).textContent).toBe("Russian");
    expect(await optionNames(user)).toHaveLength(googleLanguages.targetLanguages.length);
    expect(languageOptions(screen.getByRole("dialog"), { selected: true }).map((option) => option.textContent)).toEqual(["Russian"]);
  });

  it("another translator's list when it is the stored one (Bing)", async () => {
    const { user } = await renderPopup({
      page: "welcome",
      sync: { settings: { ...defaultSettings, translator: "bing", targetLanguageCode: "ja" } },
    });

    expect((await languageField()).textContent).toBe("Japanese");
    expect(await optionNames(user)).toHaveLength(Object.keys(bingLanguages.translation).length);
  });

  it("a pick is saved at once: only the language changes in the stored settings", async () => {
    const stored = { ...defaultSettings, autoPause: false, leftClickAction: "nothing", showNotifications: false };
    const { fake, user } = await renderPopup({ page: "welcome", sync: { settings: stored } });

    await pickLanguage(user, "German");

    await waitFor(() => expect(fake.storage.sync.settings).toEqual({ ...stored, targetLanguageCode: "de" }));
    expect((await languageField()).textContent).toBe("German");
  });

  it("no settings stored: the error screen, no defaults; once they are there, \"Try again\" shows the field", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { fake, user } = await renderPopup({ page: "welcome" });

    await user.click(await tryAgain());
    await tryAgain();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(fake.storage.sync.settings).toBeUndefined();

    fake.storage.sync.settings = { ...defaultSettings, targetLanguageCode: "uk" };
    await user.click(await tryAgain());

    expect((await languageField()).textContent).toBe("Ukrainian");
  });

  it("settings that cannot be read: the error screen; read again after the fault, the field", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { fake, user } = await renderPopup({
      page: "welcome",
      sync: { settings: { ...defaultSettings, targetLanguageCode: "uk" } },
      failingReads: { sync: ["settings"] },
    });

    await tryAgain();
    expect(screen.queryByRole("combobox")).toBeNull();

    fake.failingReads.sync = [];
    await user.click(await tryAgain());

    expect((await languageField()).textContent).toBe("Ukrainian");
  });

  it("a pick that cannot be saved: the error screen, nothing written; \"Try again\" shows what is stored", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { fake, user } = await renderPopup({
      page: "welcome",
      sync: { settings: defaultSettings },
      failingWrites: { sync: ["settings"] },
    });

    await pickLanguage(user, "German");

    await tryAgain();
    expect(fake.storage.sync.settings).toEqual(defaultSettings);

    fake.failingWrites.sync = [];
    await user.click(await tryAgain());
    expect((await languageField()).textContent).toBe("English");
  });

  it("the background does not answer: the error screen, not an empty list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await renderPopup({ page: "welcome", background: false, sync: { settings: defaultSettings } });

    await tryAgain();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("access to YouTube", () => {
  const LINE = "HoverTranslate has no access to YouTube, so it can't translate subtitles. Allow access, then reload the YouTube page.";

  it("with access: no line about it", async () => {
    await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

    await languageField();
    expect(screen.queryByText(LINE)).toBeNull();
  });

  it("without: the line, and \"Allow access\" asks for the content scripts' hosts; granted, the line goes", async () => {
    const { fake, user } = await renderPopup({
      page: "welcome",
      sync: { settings: defaultSettings },
      contentScriptAccess: false,
      answerPermissionPrompt: () => true,
    });

    await screen.findByText(LINE);
    await user.click(screen.getByRole("button", { name: "Allow access" }));

    expect(fake.permissionPrompts).toEqual([["*://*.youtube.com/*"]]);
    await waitFor(() => expect(screen.queryByText(LINE)).toBeNull());
  });
});

describe("the demo player", () => {
  it("its caption container is there from the first frame, before the settings are read; the line comes after", async () => {
    await renderPopup({ page: "welcome", sync: { settings: { ...defaultSettings, targetLanguageCode: "de" } } });

    // Synchronously after mounting: the content script gives up looking for a container after a few tries.
    const container = document.querySelector(".html5-video-player .ytp-caption-window-container");
    expect(container).not.toBeNull();
    expect(container?.children).toHaveLength(0);

    await waitFor(() => expect(captionLine()).toBe("I'm going to the beach tomorrow / if the weather is nice"));
    // The nesting the content script looks for, and the video it pauses.
    expect(document.querySelector(".html5-video-player > video")).not.toBeNull();
    expect(document.querySelector(".ytp-caption-window-container > .caption-window > .caption-visual-line > .ytp-caption-segment"))
      .not.toBeNull();
  });

  it("translated into English, the line is Spanish; a pick across English replaces the whole line", async () => {
    const { user } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

    await waitFor(() => expect(captionLine()).toBe("Caminaremos por la montaña / cuando haga buen tiempo"));
    const spanishWindow = document.querySelector(".caption-window");
    expect(spanishWindow?.getAttribute("lang")).toBe("es");

    await pickLanguage(user, "French");

    await waitFor(() => expect(captionLine()).toBe("I'm going to the beach tomorrow / if the weather is nice"));
    expect(spanishWindow?.isConnected).toBe(false);
    expect(document.querySelectorAll(".caption-window")).toHaveLength(1);
    expect(document.querySelector(".caption-window")?.getAttribute("lang")).toBe("en");
  });

  it("a pick that stays on the same side of English keeps the line", async () => {
    const { user } = await renderPopup({ page: "welcome", sync: { settings: { ...defaultSettings, targetLanguageCode: "de" } } });

    await waitFor(() => expect(captionLine()).not.toBe(""));
    const captionWindow = document.querySelector(".caption-window");

    await pickLanguage(user, "French");

    await waitFor(() => expect((screen.getByRole("combobox", { name: /Translate to/ })).textContent).toBe("French"));
    expect(captionWindow?.isConnected).toBe(true);
  });
});

it("the tips about subtitles and pinning come before \"Open YouTube\", which leaves the page", async () => {
  await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

  const link = await screen.findByRole("link", { name: "Open YouTube" });
  const strings = readLocale("en", "welcome");
  await screen.findByText(strings.start.pin);
  for (const tip of [strings.start.captions, strings.start.pin]) {
    expect(screen.getByText(tip).compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});

it("\"Open YouTube\" comes right after the demo, before the DeepL card and the block about the rest of the popup", async () => {
  await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

  const link = await screen.findByRole("link", { name: "Open YouTube" });
  const more = await screen.findByRole("region", { name: readLocale("en", "welcome").more.title });
  for (const after of [screen.getByRole("note"), more]) {
    expect(link.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  expect(screen.getByTestId("demo-status").compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("the HoverTranslate icon next to the title, left out by screen readers", async () => {
  await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

  const heading = await screen.findByRole("heading", { level: 1 });
  const icon = heading.parentElement?.querySelector("img");
  expect(icon?.getAttribute("alt")).toBe("");
  expect(icon?.getAttribute("src")).toBe("../../assets/icons/logo-48.png");
  expect(icon?.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it("in a wide window the language panel closes with a cross, not an arrow back", async () => {
  const { user } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

  const panel = await openLanguagePanel(user, "Translate to");
  const close = within(panel).getByRole("button", { name: "Back" });

  expect(close.querySelector("[data-testid='CloseIcon']")).not.toBeNull();
  expect(close.querySelector("[data-testid='ArrowBackIcon']")).toBeNull();
});

it("\"Open YouTube\" leads to YouTube in this tab", async () => {
  await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

  const link = await screen.findByRole("link", { name: "Open YouTube" });
  expect(link.getAttribute("href")).toBe("https://www.youtube.com/");
  expect(link.getAttribute("target")).toBeNull();
});

describe("the theme and language buttons, the popup's own", () => {
  it("the theme button switches the page to dark and stores it for the popup too (`popupTheme`)", async () => {
    const { fake, user } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });
    await languageField();
    expect(getComputedStyle(document.body).backgroundColor).toBe("rgb(255, 255, 255)");

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    await waitFor(() => expect(fake.storage.sync.popupTheme).toBe("dark"));
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy();
    expect(getComputedStyle(document.body).backgroundColor).toBe("rgb(18, 18, 18)");
  });

  it("a language picked in the menu redraws the page in it, the tab's title and the direction too; the subtitle line and \"Translate to\" stay", async () => {
    const { fake, user } = await renderPopup({ page: "welcome", sync: { settings: { ...defaultSettings, targetLanguageCode: "de" } } });
    await waitFor(() => expect(captionLine()).toBe("I'm going to the beach tomorrow / if the weather is nice"));

    await user.click(screen.getByRole("button", { name: readLocale("en", "common").tooltips.languageSelector }));
    await user.click(await screen.findByRole("menuitem", { name: "العربية" }));

    const arabic = readLocale("ar", "welcome");
    expect(await screen.findByRole("heading", { level: 1, name: arabic.pageTitle })).toBeTruthy();
    expect(document.title).toBe(arabic.pageTitle);
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByTestId("demo-status").textContent).toBe(arabic.demo.paused);
    expect(captionLine()).toBe("I'm going to the beach tomorrow / if the weather is nice");
    expect(fake.storage.sync.settings).toMatchObject({ targetLanguageCode: "de" });
    // Where the popup keeps its language: it opens in Arabic from now on, as the page does.
    expect(localStorage.getItem("hoverTranslatePopupLanguage")).toBe("ar");
  });
});

describe("the tip to pin the icon shows only while it is not on the toolbar", () => {
  const PIN = /^Pin the HoverTranslate icon/;
  const tipShown = () => screen.queryByText(PIN) !== null;
  const rendered = () => screen.findByRole("link", { name: "Open YouTube" });

  it("nothing until the browser has answered: no tip that flashes and goes", async () => {
    const { fake } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, userSettings: "held" });
    await rendered();
    expect(tipShown()).toBe(false);

    await act(async () => fake.answerUserSettings());

    expect(tipShown()).toBe(true);
  });

  it("pinned: no tip", async () => {
    await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, isOnToolbar: true });
    await rendered();
    // Asked a turn later: give it the time to answer, then look.
    await waitFor(() => expect(tipShown()).toBe(false));
    expect(await chrome.action.getUserSettings()).toEqual({ isOnToolbar: true });
    expect(tipShown()).toBe(false);
  });

  it("not pinned: the tip; pinned while the page is open, it goes", async () => {
    const { fake } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, isOnToolbar: false });
    await rendered();
    expect(tipShown()).toBe(true);

    act(() => fake.pinIcon(true));

    await waitFor(() => expect(tipShown()).toBe(false));
  });

  it("without the event (Chrome before 130): pinned in another window, the tip goes when the page is back in view", async () => {
    const { fake } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, userSettings: "no-event" });
    await rendered();
    expect(tipShown()).toBe(true);

    fake.pinIcon(true);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });

    await waitFor(() => expect(tipShown()).toBe(false));
  });

  it.each(["missing", "refuses"] as const)("the browser cannot tell (%s): the tip, as before", async (userSettings) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, userSettings, isOnToolbar: true });
    await rendered();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(tipShown()).toBe(true);
  });
});

describe("the page follows the settings changed elsewhere (the popup), as the content script does", () => {
  const deepl = { local: { apiKeys: { deepl: "deepl-key:fx" } }, grantedOrigins: [`${DEEPL_FREE_API_URL}/*`] };
  const card = () => screen.queryByRole("note");

  it("DeepL picked in the popup: its card goes and the field lists DeepL's languages; back to Google, the card returns", async () => {
    const { user } = await renderPopup({ page: "welcome", sync: { settings: { ...defaultSettings, targetLanguageCode: "de" } }, ...deepl });
    await languageField();
    expect(card()).not.toBeNull();

    await act(() => chrome.storage.sync.set({ settings: { ...defaultSettings, translator: "deepl", targetLanguageCode: "de" } }));

    await waitFor(() => expect(card()).toBeNull());
    expect(await optionNames(user)).toHaveLength(DEEPL_TARGET_LANGUAGES.length);
    await user.keyboard("{Escape}");

    await act(() => chrome.storage.sync.set({ settings: { ...defaultSettings, targetLanguageCode: "de" } }));

    await waitFor(() => expect(card()).not.toBeNull());
    expect(await optionNames(user)).toHaveLength(googleLanguages.targetLanguages.length);
  });

  it("only the latest change lands: DeepL's list answered after the switch back to Google does not replace Google's", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const { fake, user } = await renderPopup({
      page: "welcome",
      sync: { settings: { ...defaultSettings, targetLanguageCode: "de" } },
      ...deepl,
      // DeepL's list comes late; anything else of DeepL's as by default.
      routes: { "api-free.deepl.com": async ({ url }) => { if (url.pathname === "/v2/languages") await held; return undefined; } },
    });
    await languageField();
    // The page's requests to the background, to know when DeepL's answer has reached it.
    const sendMessage = vi.spyOn(fake.chrome.runtime, "sendMessage");
    const deeplAnswer = () => sendMessage.mock.calls.findIndex(([message]) =>
      (message as { action?: string; value?: string }).action === "getAvailableLanguages" && (message as { value?: string }).value === "deepl");

    await act(() => chrome.storage.sync.set({ settings: { ...defaultSettings, translator: "deepl", targetLanguageCode: "de" } }));
    await waitFor(() => expect(deeplAnswer()).toBeGreaterThanOrEqual(0));
    // Back to Google, with French: drawn once Google's answer, the later read, has landed.
    await act(() => chrome.storage.sync.set({ settings: { ...defaultSettings, targetLanguageCode: "fr" } }));
    await waitFor(async () => expect((await languageField()).textContent).toBe("French"));

    await act(async () => {
      release();
      await sendMessage.mock.results[deeplAnswer()].value;
      // What the page does with the answer is all promise continuations: done before the next task.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect((await languageField()).textContent).toBe("French");
    expect(card()).not.toBeNull();
    expect(await optionNames(user)).toHaveLength(googleLanguages.targetLanguages.length);
  });

  it("the language changed in the popup: the field shows it, and the demo line follows it across English", async () => {
    await renderPopup({ page: "welcome", sync: { settings: { ...defaultSettings, targetLanguageCode: "de" } } });
    await waitFor(() => expect(captionLine()).toBe("I'm going to the beach tomorrow / if the weather is nice"));

    await act(() => chrome.storage.sync.set({ settings: { ...defaultSettings, targetLanguageCode: "en" } }));

    await waitFor(() => expect(captionLine()).toBe("Caminaremos por la montaña / cuando haga buen tiempo"));
    expect((await languageField()).textContent).toBe("English");
  });
});

describe("the block about the rest of the popup", () => {
  const block = (language = "en") => screen.findByRole("region", { name: readLocale(language, "welcome").more.title });
  const openButton = (element: HTMLElement) => within(element).queryByRole("button", { name: "Open settings" });

  it.each(["en", "ru", "ar"])("%s: the three tabs, named as in the popup, each with what it holds", async (language) => {
    await renderPopup({ page: "welcome", language, sync: { settings: defaultSettings } });

    const region = await block(language);
    const strings = readLocale(language, "welcome").more;
    for (const [ns, line] of [["settings", strings.settings], ["customize", strings.customize], ["dictionary", strings.dictionary]]) {
      expect(within(region).getByText(readLocale(language, ns).tabLabel)).toBeTruthy();
      expect(region.textContent).toContain(line);
    }
  });

  it("its button opens the popup, on its own: a refusal takes it away and leaves the DeepL card's", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { user } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, openPopup: "refuses" });

    const region = await block();
    await user.click(openButton(region)!);

    await waitFor(() => expect(openButton(region)).toBeNull());
    expect(openButton(screen.getByRole("note"))).not.toBeNull();
    expect(region.textContent).toContain(readLocale("en", "welcome").more.settings);
  });

  it("its button is the page's plain one, not the DeepL card's blue", async () => {
    await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

    const button = openButton(await block())!;
    expect(button.classList).toContain("MuiButton-colorPrimary");
    expect(button.classList).not.toContain("MuiButton-colorInfo");
    expect(openButton(screen.getByRole("note"))!.classList).toContain("MuiButton-colorInfo");
  });

  it("a click opens the popup", async () => {
    const { fake, user } = await renderPopup({ page: "welcome", sync: { settings: defaultSettings } });

    await user.click(openButton(await block())!);

    expect(fake.popupsOpened()).toBe(1);
  });

  it("without `action.openPopup`: no button, the block stays", async () => {
    await renderPopup({ page: "welcome", sync: { settings: defaultSettings }, openPopup: "missing" });

    expect(openButton(await block())).toBeNull();
  });

  it("on DeepL: no DeepL card, the block stays", async () => {
    await renderPopup({
      page: "welcome",
      sync: { settings: { ...defaultSettings, translator: "deepl", targetLanguageCode: "de" } },
      local: { apiKeys: { deepl: "deepl-key:fx" } },
      grantedOrigins: [`${DEEPL_FREE_API_URL}/*`],
    });

    expect(openButton(await block())).not.toBeNull();
    await languageField();
    expect(screen.queryByRole("note")).toBeNull();
  });
});


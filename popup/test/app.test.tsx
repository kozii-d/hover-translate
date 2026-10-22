import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { REPO_ROOT } from "@extension-test/fakeChrome.ts";
import i18n from "@/app/config/i18n.ts";
import { renderPopup } from "./renderPopup.tsx";

const NAMESPACES = ["messages", "modals", "settings", "customize", "dictionary", "about", "common"];
const PAGES = [
  { route: "/", ns: "settings" },
  { route: "/customize", ns: "customize" },
  { route: "/dictionary", ns: "dictionary" },
  { route: "/about", ns: "about" },
];

const readLocale = (language: string, ns: string) =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "_locales", language, `${ns}.json`), "utf8"));

/** Every `a.b.c` key of the English strings: shown instead of a text, it means a missing string. */
const keyPaths = (() => {
  const paths: string[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => walk(child, prefix ? `${prefix}.${key}` : key));
    } else if (prefix.includes(".")) {
      paths.push(prefix);
    }
  };
  NAMESPACES.forEach((ns) => walk(readLocale("en", ns), ""));
  return paths;
})();

/** What a viewer can read or hear: the text, and the attributes a screen reader or a tooltip shows. */
const visibleText = () => [
  document.body.textContent ?? "",
  ...[...document.querySelectorAll("[title], [aria-label], [placeholder], [alt]")]
    .flatMap((element) => ["title", "aria-label", "placeholder", "alt"].map((name) => element.getAttribute(name) ?? "")),
].join("\n");

const SAVED = [{
  id: "w1",
  originalText: "riverbank",
  translatedText: "берег",
  sourceLanguageCode: "en",
  targetLanguageCode: "ru",
  translatorName: "Google",
  timestamp: Date.UTC(2026, 8, 23, 12),
}];

describe.each([
  { language: "en", dir: "ltr", savedOn: "Wednesday, September 23, 2026" },
  { language: "ru", dir: "ltr", savedOn: "среда, 23 сентября 2026 г." },
  { language: "ja", dir: "ltr", savedOn: "2026年9月23日水曜日" },
  { language: "ar", dir: "rtl", savedOn: "الأربعاء، 23 سبتمبر 2026" },
])("the popup in $language", ({ language, dir, savedOn }) => {
  it.each(PAGES)("$route: its title, every string translated, no errors", async ({ route, ns }) => {
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");
    await renderPopup({ language, route, local: { savedTranslations: SAVED } });

    await screen.findByRole("heading", { name: readLocale(language, ns).pageTitle });
    await waitFor(() => expect(document.querySelector(".MuiSkeleton-root")).toBeNull());

    const text = visibleText();
    expect(keyPaths.filter((key) => text.includes(key))).toEqual([]);
    expect(text).not.toContain("{{");
    expect(document.documentElement.dir).toBe(dir);
    expect(document.documentElement.lang).toBe(language);
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
  });

  it("/dictionary: the day above the saved words is written as the language writes dates", async () => {
    await renderPopup({ language, route: "/dictionary", local: { savedTranslations: SAVED } });

    expect(await screen.findByText(savedOn)).toBeTruthy();
  });
});

it("a popup language named after its folder with a region (`pt_BR`) is the page's language as a tag (`pt-BR`)", async () => {
  await renderPopup({ language: "pt_BR", uiLanguage: "pt-BR" });

  await screen.findByRole("heading", { name: readLocale("pt_BR", "settings").pageTitle });
  expect(document.documentElement.lang).toBe("pt-BR");
});

it("the menu of popup languages names each language in itself", async () => {
  const { user } = await renderPopup({ language: "ru" });

  await user.click(await screen.findByRole("button", { name: readLocale("ru", "common").tooltips.languageSelector }));
  const names = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);

  expect(names).toEqual(expect.arrayContaining(["English", "Русский", "日本語", "العربية", "Português (Brasil)", "中文（繁體）"]));
});

it("the day above the saved words follows a change of the popup's language at once", async () => {
  const { user } = await renderPopup({ language: "en", route: "/dictionary", local: { savedTranslations: SAVED } });
  await screen.findByText("Wednesday, September 23, 2026");

  await user.click(screen.getByRole("button", { name: readLocale("en", "common").tooltips.languageSelector }));
  await user.click(await screen.findByRole("menuitem", { name: "Magyar" }));

  expect(await screen.findByText("2026. szeptember 23., szerda")).toBeTruthy();
});

it("a page that fails to render: the error screen with the tabs, the other pages still open, Try again reloads the popup", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  // As `Intl` once did on a viewer's machine (`ApiKeyStatus`): the Dictionary formats its days with it.
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function () {
    throw new RangeError("Incorrect locale information provided");
  });
  const { user } = await renderPopup({ route: "/dictionary", local: { savedTranslations: SAVED } });

  expect(await screen.findByText("Couldn't load this page")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Dictionary" })).toBeTruthy();
  expect(errors).toHaveBeenCalledWith("The page could not be shown", expect.any(RangeError), expect.any(String));

  // `React.lazy` keeps a failed import: drawing the page again would fail again.
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(reload).toHaveBeenCalledOnce();
  vi.unstubAllGlobals();

  await user.click(screen.getByRole("tab", { name: "Customize" }));
  expect(await screen.findByRole("heading", { name: "Customize" })).toBeTruthy();
  expect(await screen.findByRole("combobox", { name: /^Font size/ })).toBeTruthy();
  expect(screen.queryByText("Couldn't load this page")).toBeNull();
});

it.each(PAGES)("$route: one heading of the first level, the page's title", async ({ route, ns }) => {
  await renderPopup({ route, local: { savedTranslations: SAVED } });
  const title = readLocale("en", ns).pageTitle;

  await screen.findByRole("heading", { name: title });
  await waitFor(() => expect(document.querySelector(".MuiSkeleton-root")).toBeNull());

  expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual([title]);
});

it("/about: its sentences are not headings, and Changelog is a button the keyboard reaches that opens the changelog", async () => {
  const { fake, user } = await renderPopup({ route: "/about" });
  const strings = readLocale("en", "about").blocks.description;

  const changelog = await screen.findByRole("button", { name: "Changelog" });
  expect(screen.queryByRole("heading", { name: strings.subtitle })).toBeNull();
  expect(screen.queryByRole("heading", { name: new RegExp(strings["thank-you"]) })).toBeNull();

  for (let presses = 0; presses < 30 && document.activeElement !== changelog; presses++) await user.tab();
  expect(document.activeElement).toBe(changelog);
  await user.keyboard("{Enter}");

  expect(fake.createdTabs.map((tab) => tab.url)).toEqual(["https://github.com/kozii-d/hover-translate/blob/master/CHANGELOG.md"]);
});

it("/about in ru: the support dialog's title is one heading, with none inside it, and its close button is named in Russian", async () => {
  const { user } = await renderPopup({ language: "ru", route: "/about" });
  const about = readLocale("ru", "about");
  const modals = readLocale("ru", "modals");

  await user.click(await screen.findByRole("button", { name: about.blocks.support.actions.donate.text }));
  const dialog = await screen.findByRole("dialog", { name: modals.support.title });

  const title = within(dialog).getByRole("heading", { level: 2 });
  expect(title.textContent).toBe(modals.support.title);
  expect(title.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
  await user.click(within(dialog).getByRole("button", { name: modals.confirmation.actions.close.text }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("a button that cannot be used looks it: \"Rate us\" in a build that belongs to no store", async () => {
  await renderPopup({ route: "/about", id: "unpackedbuildid" });

  const rate = await screen.findByRole("button", { name: readLocale("en", "about").blocks.support.actions.review.text });

  expect(rate).toHaveProperty("disabled", true);
  // MUI's colours for a disabled contained button, not the enabled one's near black.
  expect(getComputedStyle(rate).backgroundColor).toBe("rgba(0, 0, 0, 0.12)");
  expect(getComputedStyle(rate).color).toBe("rgba(0, 0, 0, 0.26)");
});

it("the menu of popup languages marks the current one as selected, and picking it changes nothing", async () => {
  const { user } = await renderPopup({ language: "ru" });
  const changeLanguage = vi.spyOn(i18n, "changeLanguage");

  await user.click(await screen.findByRole("button", { name: readLocale("ru", "common").tooltips.languageSelector }));
  const current = await screen.findByRole("menuitem", { name: "Русский" });
  expect(current.getAttribute("aria-disabled")).toBeNull();
  expect(current.classList).toContain("Mui-selected");

  await user.click(current);

  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(changeLanguage).not.toHaveBeenCalled();
  expect(i18n.language).toBe("ru");
});

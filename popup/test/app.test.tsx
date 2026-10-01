import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { REPO_ROOT } from "@extension-test/fakeChrome.ts";
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

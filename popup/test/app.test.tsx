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
  { language: "en", dir: "ltr" },
  { language: "ru", dir: "ltr" },
  { language: "ja", dir: "ltr" },
  { language: "ar", dir: "rtl" },
])("the popup in $language", ({ language, dir }) => {
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
    // Known, and development-only: the settings form is drawn once before the
    // language lists arrive (notes/TASKS.md, "Найдено по дороге").
    const knownWarning = /^MUI: You have provided an out-of-range value `[\w-]+` for the select component/;
    expect(warnings.mock.calls.filter(([message]) => !knownWarning.test(String(message)))).toEqual([]);
  });
});

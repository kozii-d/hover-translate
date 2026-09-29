import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderPopup } from "./renderPopup.tsx";

const saved = (originalText: string, translatedText: string, extra = {}) => ({
  id: originalText,
  originalText,
  translatedText,
  sourceLanguageCode: "en",
  targetLanguageCode: "ru",
  translatorName: "Google",
  timestamp: new Date(2026, 8, 23, 12, 30, 5).getTime(),
  ...extra,
});

const SAVED = [
  saved("riverbank", "берег", { transliteration: "bereg", dictionary: "noun: берег, откос;\n" }),
  saved("=HYPERLINK(\"https://example.test\",\"click\")", "=1+1"),
  saved("+1", "-1", { transcription: "@SUM(A1)" }),
  saved("\tTab", "a, b \"c\"\nd"),
];

/** Downloads made by the popup: the file name and the bytes of the blob. */
let downloads: { name: string; bytes: Promise<ArrayBuffer> }[];

beforeEach(() => {
  downloads = [];
  const blobs = new Map<string, Blob>();
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:popup/${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, bytes: blobs.get(this.href)!.arrayBuffer() });
  });
});

const exportAs = async (format: "CSV" | "JSON") => {
  const { user } = await renderPopup({ route: "/dictionary", local: { savedTranslations: SAVED } });
  await screen.findByText("riverbank");
  await user.click(screen.getByRole("button", { name: "Export translations" }));
  await user.click(await screen.findByRole("menuitem", { name: `Export ${format}` }));
  await waitFor(() => expect(downloads).toHaveLength(1));
  // Decoded as is: `Blob.text()` would drop the byte order mark.
  return { name: downloads[0].name, text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(await downloads[0].bytes) };
};

describe("exporting the dictionary", () => {
  it("CSV: a byte order mark, and no cell a spreadsheet would run as a formula", async () => {
    const { name, text } = await exportAs("CSV");

    expect(name).toMatch(/^hover-translate-dictionary-[0-9a-z]+\.csv$/);
    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text.slice(1).split("\n").slice(0, 3)).toEqual([
      "Date,Translator,Language,Original,Translation,Transliteration,Transcription,Dictionary",
      "23/09/2026 12:30:05,Google,en-ru,riverbank,берег,bereg,,\"noun: берег, откос;",
      "\"",
    ]);
    expect(text).toContain("'=HYPERLINK(\"\"https://example.test\"\",\"\"click\"\")\",'=1+1,,,");
    expect(text).toContain("'+1,'-1,,'@SUM(A1),");
    expect(text).toContain("'\tTab,\"a, b \"\"c\"\"\nd\",,,");
  });

  it("JSON: every field as it was saved", async () => {
    const { name, text } = await exportAs("JSON");

    expect(name).toMatch(/^hover-translate-dictionary-[0-9a-z]+\.json$/);
    const rows = JSON.parse(text);
    expect(rows).toHaveLength(SAVED.length);
    expect(rows[1]).toEqual({
      Date: "23/09/2026 12:30:05",
      Translator: "Google",
      Language: "en-ru",
      Original: "=HYPERLINK(\"https://example.test\",\"click\")",
      Translation: "=1+1",
      Transliteration: "",
      Transcription: "",
      Dictionary: "",
    });
  });
});

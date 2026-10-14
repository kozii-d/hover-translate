import { describe, expect, it } from "vitest";
import {
  getReviewPageUrl,
  isRatingPromptDue,
  nextRatingPromptDismissals,
} from "../../src/common/ratingPrompt.ts";
import { CHROME_WEB_STORE_ID, EDGE_ADD_ONS_ID, UNPACKED_ID } from "../fakeChrome.ts";

// When the rating cards may appear, and which store page "Rate" opens, case by case.
const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 29, 12);
const daysAgo = (days: number) => now - days * DAY;
const base = { installedAt: daysAgo(8), updatedAt: daysAgo(8) };

describe("both cards: a week after the install and the last update, until answered", () => {
  it.each<[string, Record<string, unknown>, boolean]>([
    ["installedAt absent", {}, false],
    ["installed 6 days ago", { installedAt: daysAgo(6), updatedAt: daysAgo(6) }, false],
    ["installed 7 days ago", { installedAt: daysAgo(7), updatedAt: daysAgo(7) }, true],
    ["installedAt in the future", { installedAt: now + DAY, updatedAt: daysAgo(8) }, false],
    ["installedAt a string", { installedAt: "2025-01-01", updatedAt: daysAgo(8) }, false],
    ["installedAt null", { installedAt: null, updatedAt: daysAgo(8) }, false],
    ["installedAt NaN", { installedAt: Number.NaN, updatedAt: daysAgo(8) }, false],
    ["updated 6 days ago", { installedAt: daysAgo(30), updatedAt: daysAgo(6) }, false],
    ["updated 7 days ago", { installedAt: daysAgo(30), updatedAt: daysAgo(7) }, true],
    ["no updatedAt, installed 8 days ago", { installedAt: daysAgo(8) }, true],
    ["updated yesterday, installed a year ago", { installedAt: daysAgo(365), updatedAt: daysAgo(1) }, false],
    ["updatedAt in the future", { installedAt: daysAgo(30), updatedAt: now + DAY }, false],
    ["updatedAt null", { installedAt: daysAgo(30), updatedAt: null }, false],
    ["ratingPromptDone", { ...base, ratingPromptDone: true }, false],
    ["ratingPromptDone a string", { ...base, ratingPromptDone: "yes" }, false],
  ])("%s → %j", (_, sync, expected) => {
    expect(isRatingPromptDue(sync, now)).toBe(expected);
  });
});

describe("either card put off puts off both: for 30 days, three times at most", () => {
  it.each<[string, unknown, boolean]>([
    ["never put off", undefined, true],
    ["put off once, 29 days ago", { count: 1, lastDismissedAt: daysAgo(29) }, false],
    ["put off once, 30 days ago", { count: 1, lastDismissedAt: daysAgo(30) }, true],
    ["put off twice, the last 30 days ago", { count: 2, lastDismissedAt: daysAgo(30) }, true],
    ["put off three times", { count: 3, lastDismissedAt: daysAgo(90) }, false],
    ["a string", "1", false],
    ["null", null, false],
    ["an array", [1, daysAgo(40)], false],
    ["lastDismissedAt missing", { count: 1 }, false],
    ["lastDismissedAt in the future", { count: 1, lastDismissedAt: now + DAY }, false],
    ["count negative", { count: -1, lastDismissedAt: daysAgo(40) }, false],
    ["count not a whole number", { count: 1.5, lastDismissedAt: daysAgo(40) }, false],
  ])("%s → %j", (_, ratingPromptDismissals, expected) => {
    const sync = ratingPromptDismissals === undefined ? base : { ...base, ratingPromptDismissals };
    expect(isRatingPromptDue(sync, now)).toBe(expected);
  });
});

// 1.2.0 kept a count of ✕ in the popup and a flag for the card on the video
// shown, and nothing of when: both count from the update to this version.
describe("put off under 1.2.0: counted from the last update", () => {
  const updated = (days: number) => ({ installedAt: daysAgo(365), updatedAt: daysAgo(days) });

  it.each<[string, Record<string, unknown>, boolean]>([
    ["the card on the video shown, updated 29 days ago", { ...updated(29), ratingPromptVideoShown: true }, false],
    ["the card on the video shown, updated 30 days ago", { ...updated(30), ratingPromptVideoShown: true }, true],
    ["the card on the video shown, no updatedAt, installed 30 days ago", { installedAt: daysAgo(30), ratingPromptVideoShown: true }, true],
    ["the card on the video shown, no updatedAt, installed 29 days ago", { installedAt: daysAgo(29), ratingPromptVideoShown: true }, false],
    ["popup put off twice and the video card shown: three, for good",
      { ...updated(400), ratingPromptPopup: { count: 2, lastDismissedAt: daysAgo(500) }, ratingPromptVideoShown: true }, false],
    ["popup put off once, updated 30 days ago", { ...updated(30), ratingPromptPopup: { count: 1, lastDismissedAt: daysAgo(100) } }, true],
    ["popup put off once, updated 29 days ago", { ...updated(29), ratingPromptPopup: { count: 1, lastDismissedAt: daysAgo(100) } }, false],
    // Garbage in the old record counts as no dismissal: the new rule decides from here on.
    ["popup record garbage, updated 8 days ago", { ...updated(8), ratingPromptPopup: "1" }, true],
    ["the new record wins: the video card shown before, put off once 40 days ago",
      { ...updated(40), ratingPromptVideoShown: true, ratingPromptDismissals: { count: 1, lastDismissedAt: daysAgo(40) } }, true],
    ["the new record wins: popup put off three times before, once now",
      { ...updated(40), ratingPromptPopup: { count: 3, lastDismissedAt: daysAgo(40) }, ratingPromptDismissals: { count: 1, lastDismissedAt: daysAgo(40) } }, true],
  ])("%s → %j", (_, sync, expected) => {
    expect(isRatingPromptDue(sync, now)).toBe(expected);
  });
});

describe("nextRatingPromptDismissals: one more, now, written whole by either card", () => {
  it.each<[string, number, Record<string, unknown>]>([
    ["never put off", 1, base],
    ["put off once", 2, { ...base, ratingPromptDismissals: { count: 1, lastDismissedAt: daysAgo(40) } }],
    ["1.2.0: popup put off once and the video card shown", 3, { ...base, ratingPromptPopup: { count: 1, lastDismissedAt: daysAgo(40) }, ratingPromptVideoShown: true }],
    ["1.2.0: the video card shown", 2, { ...base, ratingPromptVideoShown: true }],
    ["the new record wins over 1.2.0", 2, { ...base, ratingPromptVideoShown: true, ratingPromptDismissals: { count: 1, lastDismissedAt: daysAgo(40) } }],
    ["nothing stored at all", 1, {}],
  ])("%s → count %j", (_, count, sync) => {
    expect(nextRatingPromptDismissals(sync, now)).toEqual({ count, lastDismissedAt: now });
  });
});

describe("getReviewPageUrl: the store is told by the install", () => {
  it.each<[string, string, string, string | null]>([
    ["Chrome Web Store id", `chrome-extension://${CHROME_WEB_STORE_ID}/`, CHROME_WEB_STORE_ID,
      `https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_ID}/reviews`],
    // Edge installs from the Chrome Web Store keep the Chrome Web Store id.
    ["Edge Add-ons id", `chrome-extension://${EDGE_ADD_ONS_ID}/`, EDGE_ADD_ONS_ID,
      `https://microsoftedge.microsoft.com/addons/detail/${EDGE_ADD_ONS_ID}`],
    ["moz-extension", "moz-extension://1b2c3d4e-0000-4000-8000-000000000000/", "{C49CC196-68CC-441D-9224-2A05F1A073BF}",
      "https://addons.mozilla.org/firefox/addon/hovertranslate/"],
    ["an unpacked build", `chrome-extension://${UNPACKED_ID}/`, UNPACKED_ID, null],
  ])("%s", (_, url, id, expected) => {
    expect(getReviewPageUrl(url, id)).toBe(expected);
  });
});

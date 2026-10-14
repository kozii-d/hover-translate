/**
 * The request for a rating: when it may be shown and where "Rate" leads. Pure
 * functions over values the caller has read, shared by the popup (its card and
 * the About page), the background (which opens the page for the video card) and
 * the content script.
 *
 * Whether someone has rated cannot be known — the stores say nothing and no
 * content script runs on their pages — so "Rate" and "Don't ask again" end the
 * request for good, and the limits below cover a "Rate" that was not followed.
 */

/** `true` once the viewer pressed "Rate" or "Don't ask again", anywhere. */
export const RATING_PROMPT_DONE_KEY = "ratingPromptDone";
/**
 * `{ count, lastDismissedAt }`: how often either card was put off — ✕ in the
 * popup, or the card on the video shown — and when last. Written whole by the
 * popup and by any tab with a video: two writes at once lose one dismissal,
 * which only means one more request a month later.
 */
export const RATING_PROMPT_DISMISSALS_KEY = "ratingPromptDismissals";
/** 1.2.0: the popup's ✕, as `{ count, lastDismissedAt }`. Read only while there is no `ratingPromptDismissals`. */
const RATING_PROMPT_POPUP_KEY = "ratingPromptPopup";
/** 1.2.0: `true` once the card on the video was shown. Read only while there is no `ratingPromptDismissals`. */
const RATING_PROMPT_VIDEO_SHOWN_KEY = "ratingPromptVideoShown";

export interface RatingPromptDismissals {
  count: number;
  lastDismissedAt: number;
}

/** Either is enough for both cards: some words saved, or plenty translated. */
export const MIN_SAVED_WORDS = 10;
/**
 * Entries of `translationCache`, one per distinct text, languages and
 * translator: for viewers who hover and never save.
 */
export const MIN_CACHED_TRANSLATIONS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Since the install, and since the last update: not in the week a regression may ship in. */
const MIN_DAYS_INSTALLED = 7;
const MAX_DISMISSALS = 3;
const MIN_DAYS_AFTER_DISMISSAL = 30;

const CHROME_WEB_STORE_ID = "jbddomeagbjjdoaehkdffdhifdhnmfic";
const EDGE_ADD_ONS_ID = "emnbmkhbohfjmbkdipkppnbdlhgnhmhm";

/**
 * The page of the store this copy was installed from, where it can be rated,
 * or null when that store is unknown (an unpacked build).
 *
 * Told by the install, not by the browser: Edge installs from the Chrome Web
 * Store too, and such a copy carries the Chrome Web Store id — its Edge Add-ons
 * page does not exist. AMO takes ratings on the add-on page itself (its
 * `/reviews/` page has no rating form) and picks the viewer's language on its
 * own; Edge Add-ons has no separate reviews page either.
 */
export function getReviewPageUrl(extensionUrl: string, extensionId: string): string | null {
  if (extensionUrl.startsWith("moz-extension://")) return "https://addons.mozilla.org/firefox/addon/hovertranslate/";
  if (extensionId === CHROME_WEB_STORE_ID) return `https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_ID}/reviews`;
  if (extensionId === EDGE_ADD_ONS_ID) return `https://microsoftedge.microsoft.com/addons/detail/${EDGE_ADD_ONS_ID}`;
  return null;
}

/** A moment that has passed, or null for anything else — absent, not a number, in the future. */
const pastTime = (value: unknown, now: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value <= now ? value : null;

const daysSince = (time: number, now: number) => (now - time) / DAY_MS;

/** A dismissals record as stored, or null for anything else. */
function parseDismissals(value: unknown, now: number): RatingPromptDismissals | null {
  if (typeof value !== "object" || value === null) return null;

  const { count, lastDismissedAt } = value as Partial<RatingPromptDismissals>;
  const lastDismissed = pastTime(lastDismissedAt, now);
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || lastDismissed === null) return null;

  return { count, lastDismissedAt: lastDismissed };
}

/**
 * Both cards' dismissals so far, or null when the record is not one. Without
 * a record, those of 1.2.0, which kept no date for the video card, count from
 * `updatedAt` (absent: the install). Every update rewrites it, so their pause
 * starts again with each release until a card is put off under the new rule:
 * on purpose, with no migration.
 */
function getDismissals(sync: Record<string, unknown>, now: number): RatingPromptDismissals | null {
  const stored = sync[RATING_PROMPT_DISMISSALS_KEY];
  if (stored !== undefined) return parseDismissals(stored, now);

  const popupCount = parseDismissals(sync[RATING_PROMPT_POPUP_KEY], now)?.count ?? 0;
  const videoCount = sync[RATING_PROMPT_VIDEO_SHOWN_KEY] === undefined ? 0 : 1;
  const since = pastTime(sync.updatedAt ?? sync.installedAt, now);
  return since === null ? null : { count: popupCount + videoCount, lastDismissedAt: since };
}

/**
 * Whether either card may be shown: a week since the install and since the
 * last update (`updatedAt` absent: the install date), no "Rate" or "Don't ask
 * again" yet, and 30 days since either card was last put off, three times at
 * most. `sync` is the synced storage as read — a key that is absent is
 * `undefined` there — and anything unexpected in it counts as "not yet". How
 * much the viewer has used the extension is the caller's to check.
 */
export function isRatingPromptDue(sync: Record<string, unknown>, now: number): boolean {
  if (sync[RATING_PROMPT_DONE_KEY] !== undefined) return false;

  const installedAt = pastTime(sync.installedAt, now);
  const updatedAt = sync.updatedAt === undefined ? installedAt : pastTime(sync.updatedAt, now);
  if (installedAt === null || updatedAt === null) return false;
  if (daysSince(installedAt, now) < MIN_DAYS_INSTALLED || daysSince(updatedAt, now) < MIN_DAYS_INSTALLED) return false;

  const dismissals = getDismissals(sync, now);
  if (!dismissals) return false;

  return dismissals.count === 0
    || (dismissals.count < MAX_DISMISSALS && daysSince(dismissals.lastDismissedAt, now) >= MIN_DAYS_AFTER_DISMISSAL);
}

/** The record to write when a card is put off now: ✕ in the popup, or the card on the video on screen. */
export function nextRatingPromptDismissals(sync: Record<string, unknown>, now: number): RatingPromptDismissals {
  return { count: (getDismissals(sync, now)?.count ?? 0) + 1, lastDismissedAt: now };
}

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
/** `{ count, lastDismissedAt }`: how often the popup card was put off with ✕, and when last; written whole, by the popup only. */
export const RATING_PROMPT_POPUP_KEY = "ratingPromptPopup";
/** `true` once the card on the video was shown: it is shown once, ever. */
export const RATING_PROMPT_VIDEO_SHOWN_KEY = "ratingPromptVideoShown";

export interface RatingPromptPopupDismissals {
  count: number;
  lastDismissedAt: number;
}

/** Either is enough for the popup card: some words saved, or plenty translated. */
export const POPUP_MIN_SAVED_WORDS = 5;
/**
 * Entries of `translationCache`, one per distinct text, languages and
 * translator: enough for the popup card, and for the card on the video with a
 * translation — for viewers who hover and never save.
 */
export const MIN_CACHED_TRANSLATIONS = 30;
/** The card on the video comes with the save that brings the word list to this many. */
export const VIDEO_MIN_SAVED_WORDS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Since the install, and since the last update: not in the week a regression may ship in. */
const MIN_DAYS_INSTALLED = 7;
const POPUP_MAX_DISMISSALS = 3;
const POPUP_MIN_DAYS_AFTER_DISMISSAL = 30;

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

/**
 * What both cards require of the synced keys: a week since the install and
 * since the last update (`updatedAt` absent: the install date), and no "Rate"
 * or "Don't ask again" yet. `sync` is the synced storage as read — a key that
 * is absent is `undefined` there — and anything unexpected in it counts as
 * "not yet".
 */
function isRatingPromptDue(sync: Record<string, unknown>, now: number): boolean {
  if (sync[RATING_PROMPT_DONE_KEY] !== undefined) return false;

  const installedAt = pastTime(sync.installedAt, now);
  const updatedAt = sync.updatedAt === undefined ? installedAt : pastTime(sync.updatedAt, now);
  if (installedAt === null || updatedAt === null) return false;

  return daysSince(installedAt, now) >= MIN_DAYS_INSTALLED && daysSince(updatedAt, now) >= MIN_DAYS_INSTALLED;
}

/**
 * The popup card: in every opening until answered; ✕ puts it off for a month,
 * three times at most. How much the viewer has used the extension is the
 * caller's to check.
 */
export function isPopupRatingPromptDue(sync: Record<string, unknown>, now: number): boolean {
  if (!isRatingPromptDue(sync, now)) return false;

  const dismissals = sync[RATING_PROMPT_POPUP_KEY];
  if (dismissals === undefined) return true;
  if (typeof dismissals !== "object" || dismissals === null) return false;

  const { count, lastDismissedAt } = dismissals as Partial<RatingPromptPopupDismissals>;
  const lastDismissed = pastTime(lastDismissedAt, now);
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || lastDismissed === null) return false;

  return count < POPUP_MAX_DISMISSALS && daysSince(lastDismissed, now) >= POPUP_MIN_DAYS_AFTER_DISMISSAL;
}

/** The card on the video: once, ever. */
export function isVideoRatingPromptDue(sync: Record<string, unknown>, now: number): boolean {
  return isRatingPromptDue(sync, now) && sync[RATING_PROMPT_VIDEO_SHOWN_KEY] === undefined;
}

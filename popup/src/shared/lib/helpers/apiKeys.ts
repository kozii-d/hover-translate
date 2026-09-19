import { ApiKeyService } from "@extension/common/services/apiKeyService.ts";

/**
 * The popup's read access to the stored API keys — see `ApiKeyService`.
 * Writes go through the background worker (`requestApiKeySave`,
 * `requestApiKeyRemoval`).
 */
export const apiKeyService = new ApiKeyService();

/**
 * A key typed into the form while the permission prompt is showing.
 *
 * Firefox can close the popup when it opens the permission prompt, and the
 * key the viewer just pasted went with it. It is parked in `session` storage —
 * memory only, gone when the browser closes, never written to disk — so the
 * form can come back filled in. Browsers without `storage.session` simply do
 * without it.
 */
const API_KEY_DRAFT_STORAGE_KEY = "apiKeyDraft";

export interface ApiKeyDraft {
  translatorKey: string;
  apiKey: string;
}

const getSessionStorage = () => (chrome.storage as { session?: typeof chrome.storage.local }).session;

/** Fire-and-forget on purpose: it must not delay the permission request after it. */
export const saveApiKeyDraft = (draft: ApiKeyDraft): void => {
  getSessionStorage()
    ?.set({ [API_KEY_DRAFT_STORAGE_KEY]: draft })
    ?.catch?.(() => { /* a lost draft only means retyping the key */ });
};

/**
 * Rejects when the draft could not be removed: a caller telling the viewer a
 * key is gone must not say so while a copy of it is still around.
 */
export const clearApiKeyDraft = async (): Promise<void> => {
  await getSessionStorage()?.remove(API_KEY_DRAFT_STORAGE_KEY);
};

/** For callers that only tidy up; a draft left behind is harmless there. */
export const discardApiKeyDraft = (): void => {
  clearApiKeyDraft().catch(() => { /* nothing to clean up */ });
};

export const loadApiKeyDraft = async (): Promise<ApiKeyDraft | null> => {
  try {
    const result = await getSessionStorage()?.get(API_KEY_DRAFT_STORAGE_KEY);
    const draft = result?.[API_KEY_DRAFT_STORAGE_KEY] as ApiKeyDraft | undefined;
    return draft?.translatorKey && draft.apiKey ? draft : null;
  } catch {
    return null;
  }
};

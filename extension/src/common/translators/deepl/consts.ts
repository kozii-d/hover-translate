export const DEEPL_FREE_API_URL = "https://api-free.deepl.com";
export const DEEPL_PRO_API_URL = "https://api.deepl.com";

/** Keys of the free plan end with `:fx` and only work against the free host. */
export const isDeepLFreeKey = (apiKey: string) => apiKey.trim().endsWith(":fx");

function getUserLanguage() {
  return chrome.i18n.getUILanguage();
}

async function getInitialSettings() {
  try {
    // available languages for deepl
    const response = await fetch(`${__API_URL__}/translation/languages`);
    const data = await response.json();

    if (!data || !Array.isArray(data.targetLanguages)) {
      throw new Error("Invalid data from server");
    }

    const userLanguage = getUserLanguage();

    const availableTargetLanguages = data.targetLanguages.map((lang) => lang.code);
    const targetLanguageCode = availableTargetLanguages.includes(userLanguage) ? userLanguage : "en-US";

    return {
      sourceLanguageCode: "auto",
      targetLanguageCode,
      autoPause: true,
    };
  } catch (error) {
    console.error("Failed to fetch languages from server:", error);
    return {
      sourceLanguageCode: "auto",
      targetLanguageCode: "en-US",
      autoPause: true,
    };
  }
}

async function initializeLanguages() {
  chrome.storage.sync.get(["settings"], async (result) => {
    if (!result.settings) {
      const initialSettings = await getInitialSettings();
      chrome.storage.sync.set({ settings: initialSettings });
    }
  });
}

// Event listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  initializeLanguages();
});
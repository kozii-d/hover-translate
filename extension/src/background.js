function getUserLanguage() {
  return chrome.i18n.getUILanguage();
}

async function initializeLanguages() {
  const userLanguage = getUserLanguage();

  try {
    // available languages for deepl
    const response = await fetch("http://localhost:4000/languages"); // fixme: url to env
    const data = await response.json();

    if (!data || !Array.isArray(data.targetLanguages)) {
      throw new Error("Invalid data from server");
    }

    const availableTargetLanguages = data.targetLanguages.map((lang) => lang.code);
    chrome.storage.sync.get(["sourceLanguageCode", "targetLanguageCode"], (result) => {
      if (!result.sourceLanguageCode) {
        chrome.storage.sync.set({ sourceLanguageCode: "auto" });
      }

      if (!result.targetLanguageCode) {
        const targetLanguageCode = availableTargetLanguages.includes(userLanguage) ? userLanguage : "en-US";
        chrome.storage.sync.set({ targetLanguageCode });
      }
    });

  } catch (error) {
    console.error("Failed to fetch languages from server:", error);
  }
}

// Event listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  initializeLanguages();
});
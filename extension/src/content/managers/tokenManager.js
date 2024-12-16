export class TokenManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
  }
  sendMessage = async (action) => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError?.message || "Failed to send message to service worker."));
        }
        if (response?.error || !response?.success) {
          return reject(new Error(response?.error || "Failed to send message to service worker."));
        }
        resolve(response);
      });
    });
  };

  checkIsTokenExpired = (tokenExp) => {
    const currentTime = Math.floor(Date.now() / 1000);
    return tokenExp < currentTime;
  };

  getIdTokenFromStorage = async () => {
    return this.storageManager.get("idTokenData", "local");
  };
}
export class TokenManager {
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
    return new Promise((resolve, reject) => {
      chrome.storage.local.get("idTokenData", (result) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError?.message || "Failed to get token from storage."));
        }
        const { idTokenData } = result;

        if (!idTokenData) {
          return resolve(null);
        }

        resolve(idTokenData);
      });
    });
  };
}
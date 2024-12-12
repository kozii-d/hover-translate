export class TokenManager {
  sendMessageForRestoreIdToken = async () => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "restoreIdToken" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to send message to restore token:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError?.message || "Failed to send message to restore token."));
        }
        if (response?.error || !response?.success) {
          console.error("Failed to restore token:", response?.error);
          reject(new Error(response?.error || "Failed to restore token."));
        }
        resolve(response);
      });
    });
  };

  checkIsTokenExpired = (tokenExp) => {
    const currentTime = Math.floor(Date.now() / 1000);
    return  tokenExp < currentTime;
  };

  getIdTokenFromStorage = async () => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get("idTokenData", (result) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to get token from storage:", chrome.runtime.lastError);
          return reject(new Error(chrome.runtime.lastError.message ||  "Failed to get token from storage."));
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
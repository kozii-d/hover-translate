import { jwtDecode } from "jwt-decode";

export class TokenManager {
  static GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  static GOOGLE_ISSUER = "https://accounts.google.com";

  constructor(storageManager) {
    this.storageManager = storageManager;
    this.initialize();
  }

  initialize() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "restoreIdToken") {
        this.restoreToken()
          .then(() => sendResponse({ success: true }))
          .catch((error) => sendResponse({ success: false, error: error?.message || "Unknown error" }));
      }
      if (message.action === "openPopup") {
        chrome.action.openPopup()
          .then(() => sendResponse({ success: true }));
      }
      return true;
    });
  }

  checkIsTokenExpired = (tokenExp) => {
    const currentTime = Math.floor(Date.now() / 1000);
    return  tokenExp < currentTime;
  };

  getIdToken = async (option) => {
    const { interactive } = option;

    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2.client_id;
    const scopes = manifest.oauth2.scopes;
    const redirectUri = chrome.identity.getRedirectURL();
    const nonce = self.crypto.randomUUID();

    let authUrl = `${TokenManager.GOOGLE_AUTH_BASE_URL}?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        "response_type=id_token&" +
        `nonce=${encodeURIComponent(nonce)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes.join(" "))}`;

    const idTokenData = await this.getIdTokenFromStorage();

    const email = idTokenData?.idTokenPayload?.email || "";

    if (email) {
      authUrl += `&login_hint=${encodeURIComponent(email)}`;
    }

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive },
        (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            return reject(new Error(chrome.runtime.lastError?.message || "Failed to get redirect URL."));
          }

          const urlParams = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
          const idToken = urlParams.get("id_token");

          if (!idToken) return reject(new Error("Authorization failed: No ID Token in redirect URL."));

          const idTokenPayload = jwtDecode(idToken);

          if (idTokenPayload.iss !== TokenManager.GOOGLE_ISSUER) return reject(new Error("Authorization failed: Invalid issuer in ID Token"));
          if (idTokenPayload.aud !== clientId) return reject(new Error("Authorization failed: Invalid audience in ID Token"));
          if (idTokenPayload.nonce !== nonce) return reject(new Error("Authorization failed: Invalid nonce in ID Token"));

          return resolve({ idToken, idTokenPayload });
        }
      );
    });
  };

  getIdTokenFromStorage = async () => {
    return this.storageManager.get("idTokenData", "local");
  };
  saveIdTokenToStorage = async (idTokenData) => {
    return this.storageManager.set("idTokenData", idTokenData, "local");
  };

  removeIdTokenFromStorage = async () => {
    return this.storageManager.remove("idTokenData", "local");
  };

  restoreToken = async () => {
    try {
      const idTokenData = await this.getIdToken({ interactive: false });
      if (!idTokenData) {
        chrome.action.openPopup();
        return;
      }
      return this.saveIdTokenToStorage(idTokenData);
    } catch (error) {
      this.removeIdTokenFromStorage();
      chrome.action.openPopup();
      throw error;
    }
  };
}
import {RouterPath} from "@/app/config/routerPath.ts";
import {jwtDecode} from "jwt-decode";
import {GOOGLE_AUTH_BASE_URL, GOOGLE_ISSUER, GoogleTokenPayload} from "../../types/google.ts";

interface IdTokenData {
  idToken: string;
  idTokenPayload: GoogleTokenPayload;
}

export const checkIsTokenExpired = (tokenExp: number) => {
  const currentTime = Math.floor(Date.now() / 1000);
  return  tokenExp < currentTime;
};

export const getIdToken = async (option: { interactive: boolean; }) => {
  try {
    const { interactive } = option;

    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2!.client_id;
    const scopes = manifest.oauth2!.scopes!;
    const redirectUri = chrome.identity.getRedirectURL();
    const nonce = self.crypto.randomUUID();

    const authUrl = `${GOOGLE_AUTH_BASE_URL}?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=id_token&` +
      `nonce=${encodeURIComponent(nonce)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}`;

    return new Promise<{ idToken: string; idTokenPayload: GoogleTokenPayload }>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {url: authUrl, interactive},
        (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            return reject(new Error(chrome.runtime.lastError?.message || "Authorization failed: Unable to complete OAuth flow."));
          }

          const urlParams = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
          const idToken = urlParams.get('id_token');

          if (!idToken) return reject(new Error("Authorization failed: No ID Token in redirect URL."));

          const idTokenPayload = jwtDecode<GoogleTokenPayload>(idToken);

          if (idTokenPayload.iss !== GOOGLE_ISSUER) return reject(new Error("Authorization failed: Invalid issuer in ID Token"));
          if (idTokenPayload.aud !== clientId) return reject(new Error("Authorization failed: Invalid audience in ID Token"));
          if (idTokenPayload.nonce !== nonce) return reject(new Error("Authorization failed: Invalid nonce in ID Token"));

          return resolve({idToken, idTokenPayload});
        }
      );
    });
  } catch (error) {
    throw error;
  }
};

export const saveIdTokenToStorage = async (idTokenData: IdTokenData) => {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ idTokenData }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError?.message || "Failed to save token and user profile in storage."));
      } else {
        resolve();
      }
    });
  });
};

export const getIdTokenFromStorage = async () => {
  return new Promise<IdTokenData | undefined>((resolve, reject) => {
    chrome.storage.local.get("idTokenData", (result) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message || "Failed to get token from storage."));
      }
      const { idTokenData } = result;

      if (!idTokenData) {
        return resolve(null);
      }

      resolve(idTokenData);
    });
  });
};

export const removeIdTokenFromStorage = async () => {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.local.remove("idTokenData", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError?.message || "Failed to remove token from sync storage."));
      } else {
        resolve();
      }
    });
  })
};

export const restoreToken = async () => {
  try {
    const idTokenData = await getIdToken({ interactive: false });
    if (!idTokenData) {
      window.location.hash = `#${RouterPath.login}`;
      return;
    }
    return saveIdTokenToStorage(idTokenData);
  } catch (error) {
    console.error("Failed to resolve token:", error);
    removeIdTokenFromStorage();
    window.location.hash = `#${RouterPath.login}`;
  }
};

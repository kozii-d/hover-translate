import { jwtDecode, JwtPayload } from "jwt-decode";
import { StorageService } from "../../common/services/storageService.ts";

interface IdTokenPayload extends JwtPayload {
  email?: string;
  nonce?: string;
  aud?: string;
  iss?: string;
}

interface IdTokenData {
  idToken: string;
  idTokenPayload: IdTokenPayload;
}

interface GetIdTokenOptions {
  interactive: boolean;
}

export class TokenService {
  static readonly GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  static readonly GOOGLE_ISSUER = "https://accounts.google.com";

  constructor(
    private readonly storageService: StorageService = new StorageService(),
  ) {
    this.setupMessageListeners();
  }

  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message,_ , sendResponse) => {
      if (message.action === "restoreIdToken") {
        this.restoreToken()
          .then(() => sendResponse({ success: true }))
          .catch((error) => sendResponse({ success: false, error: error?.message || "Unknown error" }));
      }
      if (message.action === "openPopup") {
        chrome.action.openPopup()
          .then(() => sendResponse({ success: true }))
          .catch(() => sendResponse({ success: false }));
      }
      return true;
    });
  }

  private buildAuthUrl(
    clientId: string,
    scopes: string[],
    redirectUri: string,
    nonce: string,
    email: string
  ): string {
    let authUrl = `${TokenService.GOOGLE_AUTH_BASE_URL}?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      "response_type=id_token&" +
      `nonce=${encodeURIComponent(nonce)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes.join(" "))}`;

    if (email) {
      authUrl += `&login_hint=${encodeURIComponent(email)}`;
    }

    return authUrl;
  }

  async requestIdToken(option: GetIdTokenOptions): Promise<IdTokenData> {
    const { interactive } = option;

    const manifest = chrome.runtime.getManifest();

    const clientId = manifest.oauth2!.client_id;
    const scopes = manifest.oauth2!.scopes!;
    const redirectUri = chrome.identity.getRedirectURL();
    const nonce = crypto.randomUUID();

    const idTokenData = await this.getIdTokenFromStorage();
    const email = idTokenData?.idTokenPayload?.email || "";

    const authUrl = this.buildAuthUrl(clientId, scopes, redirectUri, nonce, email);

    return new Promise<IdTokenData>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive },
        (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            return reject(new Error(chrome.runtime.lastError?.message || "Failed to get redirect URL."));
          }

          const urlParams = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
          const idToken = urlParams.get("id_token");

          if (!idToken) return reject(new Error("Authorization failed: No ID Token in redirect URL."));

          const idTokenPayload = jwtDecode<IdTokenPayload>(idToken);

          if (idTokenPayload.iss !== TokenService.GOOGLE_ISSUER) return reject(new Error("Authorization failed: Invalid issuer in ID Token"));
          if (idTokenPayload.aud !== clientId) return reject(new Error("Authorization failed: Invalid audience in ID Token"));
          if (idTokenPayload.nonce !== nonce) return reject(new Error("Authorization failed: Invalid nonce in ID Token"));

          resolve({ idToken, idTokenPayload });
        }
      );
    });
  }

  private async getIdTokenFromStorage(): Promise<IdTokenData | null> {
    return this.storageService.get<IdTokenData | null>("idTokenData", "local");
  }

  private async saveIdTokenToStorage(idTokenData: IdTokenData): Promise<void> {
    return this.storageService.set("idTokenData", idTokenData, "local");
  }

  private async removeIdTokenFromStorage(): Promise<void> {
    return this.storageService.remove("idTokenData", "local");
  }

  private async restoreToken(): Promise<void> {
    try {
      const idTokenData = await this.requestIdToken({ interactive: false });
      if (!idTokenData) {
        chrome.action.openPopup();
        return;
      }
      await this.saveIdTokenToStorage(idTokenData);
    } catch (error) {
      await this.removeIdTokenFromStorage();
      chrome.action.openPopup();
      throw error;
    }
  }
}
import { StorageService } from "../../common/services/storageService.js";
import { IdTokenData } from "../../common/types/token.ts";

type Action = "openPopup" | "restoreIdToken";

export class TokenService {
  constructor(
    private readonly storageService: StorageService = new StorageService(),
  ) {}
  public sendMessage = async (action: Action) => {
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

  private checkIsTokenExpired = (tokenExp: number) => {
    const currentTime = Math.floor(Date.now() / 1000);
    return tokenExp < currentTime;
  };

  public getIdTokenFromStorage = async () => {
    const idTokenData = await this.storageService.get<IdTokenData>("idTokenData", "local");

    if (!idTokenData?.idToken || !idTokenData.idTokenPayload) {
      this.sendMessage("openPopup");
      return null;
    }

    let authToken = idTokenData.idToken;

    if (this.checkIsTokenExpired(idTokenData.idTokenPayload.exp)) {
      await this.sendMessage("restoreIdToken");

      const newIdTokenData = await this.storageService.get<IdTokenData>("idTokenData", "local");
      if (!newIdTokenData?.idToken) {
        return null;
      }

      authToken = newIdTokenData.idToken;
    }

    return authToken;
  };
}
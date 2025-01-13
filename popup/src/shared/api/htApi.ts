import axios from "axios";
import { checkIsTokenExpired, getIdTokenFromStorage, restoreToken } from "@/shared/lib/helpers/idToken.ts";

export const htApi = axios.create({
  baseURL: __API_URL__,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

htApi.interceptors.request.use(async (config) => {
  const idTokenData = await getIdTokenFromStorage();

  if (idTokenData && idTokenData.idToken && !checkIsTokenExpired(idTokenData.idTokenPayload.exp)) {
    config.headers.Authorization = `Bearer ${idTokenData.idToken}`;
  } else {
    await restoreToken();
    throw new Error("Authorization failed: No ID Token in storage.");
  }

  return config;
}, Promise.reject);
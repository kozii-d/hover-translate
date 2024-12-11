import axios from "axios";
import {checkIsTokenExpired, getIdTokenFromStorage} from "@/shared/lib/helpers/idToken.ts";

export const api = axios.create({
  baseURL: __API_URL__,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  const idTokenData = await getIdTokenFromStorage();

  if (idTokenData && idTokenData.idToken && !checkIsTokenExpired(idTokenData.idTokenPayload.exp)) {
    config.headers.Authorization = `Bearer ${idTokenData.idToken}`;
  }

  return config;
}, Promise.reject);

export const authApi = axios.create({
  baseURL: __API_URL__ + "/auth",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
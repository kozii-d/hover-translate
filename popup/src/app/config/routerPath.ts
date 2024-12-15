export enum AppRoutes {
  SETTINGS = "settings",
  CUSTOMIZE = "customize",
  DICTIONARY = "dictionary",
  LOGIN = "login",
}

export const RouterPath: Record<AppRoutes, string> = {
  [AppRoutes.SETTINGS]: "/",
  [AppRoutes.CUSTOMIZE]: "/customize",
  [AppRoutes.DICTIONARY]: "/dictionary",
  [AppRoutes.LOGIN]: "/login",
};

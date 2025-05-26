export enum AppRoutes {
  SETTINGS = "settings",
  CUSTOMIZE = "customize",
  DICTIONARY = "dictionary",
  ABOUT = "about",
  LOGIN = "login",
}

export const RouterPath: Record<AppRoutes, string> = {
  [AppRoutes.SETTINGS]: "/",
  [AppRoutes.CUSTOMIZE]: "/customize",
  [AppRoutes.DICTIONARY]: "/dictionary",
  [AppRoutes.ABOUT]: "/about",
  [AppRoutes.LOGIN]: "/login",
};

export enum AppRoutes {
  SETTINGS = "settings",
  LOGIN = "login",
}

export const RouterPath: Record<AppRoutes, string> = {
  [AppRoutes.SETTINGS]: "/",
  [AppRoutes.LOGIN]: "/login",
};

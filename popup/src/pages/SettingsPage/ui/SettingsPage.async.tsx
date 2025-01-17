import { lazy } from "react";

export const SettingsPageAsync = lazy(
  () => import("./SettingsPage.tsx")
);

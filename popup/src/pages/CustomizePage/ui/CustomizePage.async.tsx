import { lazy } from "react";

export const CustomizePageAsync = lazy(
  () => import("./CustomizePage.tsx")
);

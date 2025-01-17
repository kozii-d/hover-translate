import { lazy } from "react";

export const DictionaryPageAsync = lazy(
  () => import("./DictionaryPage.tsx")
);

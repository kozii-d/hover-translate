import { FC } from "react";

import { RouterPath } from "./routerPath";
import { SettingsPage, SettingsPageSkeleton } from "@/pages/SettingsPage";
import { CustomizePage, CustomizePageSkeleton } from "@/pages/CustomizePage";
import { DictionaryPage, DictionaryPageSkeleton } from "@/pages/DictionaryPage";
import { AboutPage, AboutPageSkeleton } from "@/pages/AboutPage";

export interface RouteConfig {
  path: string,
  element: FC,
  skeleton: FC,
  /** The page's i18next namespace: the title of its error screen. */
  ns: string,
}

export const routeConfig: RouteConfig[] = [
  {
    path: RouterPath.settings,
    element: SettingsPage,
    skeleton: SettingsPageSkeleton,
    ns: "settings",
  },
  {
    path: RouterPath.customize,
    element: CustomizePage,
    skeleton: CustomizePageSkeleton,
    ns: "customize",
  },
  {
    path: RouterPath.dictionary,
    element: DictionaryPage,
    skeleton: DictionaryPageSkeleton,
    ns: "dictionary",
  },
  {
    path: RouterPath.about,
    element: AboutPage,
    skeleton: AboutPageSkeleton,
    ns: "about",
  }
];

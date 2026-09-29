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
}

export const routeConfig: RouteConfig[] = [
  {
    path: RouterPath.settings,
    element: SettingsPage,
    skeleton: SettingsPageSkeleton,
  },
  {
    path: RouterPath.customize,
    element: CustomizePage,
    skeleton: CustomizePageSkeleton,
  },
  {
    path: RouterPath.dictionary,
    element: DictionaryPage,
    skeleton: DictionaryPageSkeleton,
  },
  {
    path: RouterPath.about,
    element: AboutPage,
    skeleton: AboutPageSkeleton,
  }
];

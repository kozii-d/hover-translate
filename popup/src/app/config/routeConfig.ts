import { FC, ReactNode } from "react";

import { RouterPath } from "./routerPath";
// import { LoginPage } from "@/pages/LoginPage";
// import { AuthGuard } from "../guards/AuthGuard.tsx";
import { SettingsPage, SettingsPageSkeleton } from "@/pages/SettingsPage";
import { CustomizePage, CustomizePageSkeleton } from "@/pages/CustomizePage";
import { DictionaryPage, DictionaryPageSkeleton } from "@/pages/DictionaryPage";

export interface RouteConfig {
  path: string,
  element: FC,
  skeleton: FC,
  guards?: FC<{ children: ReactNode }>[]
}

export const routeConfig: RouteConfig[] = [
  // {
  //   path: RouterPath.login,
  //   element: LoginPage,
  // },
  {
    path: RouterPath.settings,
    element: SettingsPage,
    skeleton: SettingsPageSkeleton,
    // guards: [AuthGuard]
  },
  {
    path: RouterPath.customize,
    element: CustomizePage,
    skeleton: CustomizePageSkeleton,
    // guards: [AuthGuard]
  },
  {
    path: RouterPath.dictionary,
    element: DictionaryPage,
    skeleton: DictionaryPageSkeleton,
    // guards: [AuthGuard]
  }
];

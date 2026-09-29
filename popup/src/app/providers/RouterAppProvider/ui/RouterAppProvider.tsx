import { RouteConfig } from "../../../config/routeConfig.ts";
import { Routes, Route } from "react-router";
import { Suspense, useMemo } from "react";

interface RouterAppProviderProps {
  routes: RouteConfig[];
}

export const RouterAppProvider = (props: RouterAppProviderProps) => {
  const { routes } = props;

  const renderRoutes = useMemo(() => {
    return routes.map((route, index) => {
      const { element: Element, path, skeleton: Skeleton } = route;

      return (
        <Route key={index} path={path} element={<Suspense fallback={<Skeleton/>}><Element /></Suspense>} />
      );
    });
  }, [routes]);

  return <Routes>{renderRoutes}</Routes>;
};
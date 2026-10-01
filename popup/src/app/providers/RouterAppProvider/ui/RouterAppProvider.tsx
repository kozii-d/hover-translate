import { RouteConfig } from "../../../config/routeConfig.ts";
import { Routes, Route } from "react-router";
import { Suspense, useMemo } from "react";
import { PageErrorBoundary } from "./PageErrorBoundary.tsx";

interface RouterAppProviderProps {
  routes: RouteConfig[];
}

export const RouterAppProvider = (props: RouterAppProviderProps) => {
  const { routes } = props;

  const renderRoutes = useMemo(() => {
    return routes.map((route, index) => {
      const { element: Element, path, skeleton: Skeleton, ns } = route;

      // Inside `Suspense`, so that the error screen's tabs can wait for the
      // strings of a newly picked language. Keyed by the path: the routes
      // share their place in the tree, and a page that failed must not leave
      // the next one on its error screen.
      return (
        <Route
          key={index}
          path={path}
          element={(
            <Suspense fallback={<Skeleton/>}>
              <PageErrorBoundary key={path} ns={ns}><Element/></PageErrorBoundary>
            </Suspense>
          )}
        />
      );
    });
  }, [routes]);

  return <Routes>{renderRoutes}</Routes>;
};
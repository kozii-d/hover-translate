import { RouteConfig } from "../../config/routeConfig";
import { Routes, Route } from "react-router";
import { Suspense, useMemo } from "react";
import { PageSkeleton } from "@/shared/ui/Skeletons/PageSkeleton.tsx";

interface RouterAppProviderProps {
  routes: RouteConfig[];
}

export const RouterAppProvider = (props: RouterAppProviderProps) => {
  const { routes } = props;

  const renderRoutes = useMemo(() => {
    return routes.map((route, index) => {
      const { element: Element, path, guards = [] } = route;

      let wrappedElement = <Element />;
      if (guards.length > 0) {
        wrappedElement = guards.reduce(
          (child, Guard) => <Guard>{child}</Guard>,
          wrappedElement
        );
      }
      
      wrappedElement = <Suspense fallback={<PageSkeleton/>}>{wrappedElement}</Suspense>;

      return (
        <Route key={index} path={path} element={wrappedElement} />
      );
    });
  }, [routes]);

  return <Routes>{renderRoutes}</Routes>;
};
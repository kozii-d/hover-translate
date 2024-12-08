import { RouteConfig } from "../../config/routeConfig";
import { Routes, Route } from "react-router";
import { Fragment, Suspense, useMemo} from "react";

interface RouterAppProviderProps {
  routes: RouteConfig[];
}

export const RouterAppProvider = (props: RouterAppProviderProps) => {
  const { routes } = props;

  const renderRoutes = useMemo(() => {
    return routes.map((route, index) => {
      const { element: Element, path, guards = [], skeleton: Skeleton } = route;

      let wrappedElement = <Element />;
      if (guards.length > 0) {
        wrappedElement = guards.reduce(
          (child, Guard) => <Guard>{child}</Guard>,
          wrappedElement
        );
      }

      wrappedElement = (
        <Suspense fallback={Skeleton ? <Skeleton /> : <Fragment/>}>
          {wrappedElement}
        </Suspense>
      );

      return (
        <Route key={index} path={path} element={wrappedElement} />
      );
    });
  }, [routes]);

  return <Routes>{renderRoutes}</Routes>;
};
import { Component, ErrorInfo, FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { ErrorState } from "@/shared/ui/ErrorState/ErrorState.tsx";

interface PageErrorBoundaryProps {
  /** The page's namespace, for its title. */
  ns: string;
  children: ReactNode;
}

/** The page with its tabs, theme and language, and the error screen for its content. */
const PageError: FC<{ ns: string }> = ({ ns }) => {
  const { t } = useTranslation(ns);

  // A reload, not a new render: `React.lazy` keeps an import that failed.
  return (
    <Page title={t("pageTitle")}>
      <ErrorState onRetry={() => window.location.reload()}/>
    </Page>
  );
};

/**
 * Catches what a page throws while it is drawn, which would otherwise leave
 * the popup blank, and lets the viewer move to another tab.
 */
export class PageErrorBoundary extends Component<PageErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("The page could not be shown", error, info.componentStack);
  }

  render() {
    return this.state.failed ? <PageError ns={this.props.ns}/> : this.props.children;
  }
}

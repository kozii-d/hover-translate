/**
 * Developer breadcrumbs — the running commentary that helps when YouTube changes
 * its player markup again.
 *
 * `__DEV__` is a build-time constant, so in a production build the body folds
 * away to nothing. These used to be plain `console.log` calls, each carrying its
 * own `eslint-disable`, and they filled the console of every YouTube tab.
 */
export const debugLog = (...args: unknown[]): void => {
  if (!__DEV__) return;

  // eslint-disable-next-line no-console
  console.log(...args);
};

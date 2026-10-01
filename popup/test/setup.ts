import { afterEach, beforeEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import { installFakeChrome } from "@extension-test/fakeChrome.ts";
import { installFakeNetwork } from "@extension-test/fakeNetwork.ts";

// What the popup uses and jsdom lacks. No dark mode, no resizing, no scrolling.
window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// How long `findBy*` and `waitFor` wait. The first render in a file is cold
// (~0.8 s here against ~0.2 s after) and went past the default 1 s on CI.
configure({ asyncUtilTimeout: 3000 });

// Installed before the test file is imported: `app/config/i18n.ts` asks
// `chrome.runtime.getURL` as it loads.
installFakeChrome();
installFakeNetwork();

beforeEach(() => {
  installFakeChrome();
  installFakeNetwork();
});

// Testing Library unmounts after each test by itself only with Vitest's globals.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

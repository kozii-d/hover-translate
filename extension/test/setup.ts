import { beforeEach } from "vitest";
import { installFakeChrome } from "./fakeChrome.ts";
import { installFakeNetwork } from "./fakeNetwork.ts";

// Every test starts from an empty profile and a network that never leaves the
// process; a test that needs other storage, permissions or answers installs
// its own.
beforeEach(() => {
  installFakeChrome();
  installFakeNetwork();
});

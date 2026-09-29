const { test, expect } = require("./extension.js");

// A change in the popup reaches a YouTube page that is already open, without
// reloading it: the content script follows `chrome.storage.onChanged`
// (`stateManager.ts`), and a different translator rebuilds its pipeline
// (`content.ts`).

/** The popup's Settings page, opened in a tab of its own. */
async function openSettings(context, extensionId) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/dist/index.html`);
  return popup;
}

async function pick(popup, field, option) {
  await popup.getByRole("combobox", { name: field }).click();
  await popup.getByRole("option", { name: option, exact: true }).click();
}

test.beforeEach(async ({ storage }) => {
  await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ru" });
});

test("a new target language applies on the open page", async ({ context, extensionId, openPlayer, storage, network }) => {
  const player = await openPlayer();
  await player.captions("run for your life");
  await player.word("run").hover();
  await expect(player.tooltip).toHaveText("бегать");

  const popup = await openSettings(context, extensionId);
  await pick(popup, /Translate to/, "German");
  await expect.poll(async () => (await storage.get("sync", "settings")).targetLanguageCode).toBe("de");

  await player.page.bringToFront();
  await player.word("life").hover();
  await expect(player.tooltip).toHaveText("[de] life");
  expect(network.to("translate.googleapis.com").at(-1).url.searchParams.get("tl")).toBe("de");
});

test.describe("with access to www.bing.com", () => {
  test.use({ grantedHosts: ["https://www.bing.com/*"] });

  test("switching to Bing applies on the open page", async ({ context, extensionId, openPlayer, storage, network }) => {
    const player = await openPlayer();
    await player.captions("run for your life");
    await player.word("run").hover();
    await expect(player.tooltip).toHaveText("бегать");

    const popup = await openSettings(context, extensionId);
    await pick(popup, /Translator/, "Bing");
    await expect.poll(async () => (await storage.get("sync", "settings")).translator).toBe("bing");

    await player.page.bringToFront();
    await player.word("life").hover();
    // Bing is asked from the service worker; the fake answers there as well.
    await expect(player.tooltip).toHaveText("life (bing)");
    expect(new URLSearchParams(network.to("www.bing.com").at(-1).body).get("to")).toBe("ru");
  });
});

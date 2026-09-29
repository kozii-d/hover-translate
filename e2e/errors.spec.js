const { test, expect, INVALID_DEEPL_KEY } = require("./extension.js");

// What the viewer is told on the video when a translation fails. Only a
// translator that says why (DeepL, with its status codes) gets a message of
// its own; anything else is "Translation failed".

test("Google refusing every request: \"Translation failed\" on the video", async ({ openPlayer, storage, network }) => {
  await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ru" });
  network.answer("translate.googleapis.com", () => ({ status: 429, body: "Too Many Requests" }));
  const player = await openPlayer();
  await player.captions("run for your life");

  await player.word("run").hover();

  await expect(player.notification).toHaveText("Translation failed");
  await expect(player.tooltip).toHaveCount(0);
});

test.describe("DeepL", () => {
  test.use({ grantedHosts: ["https://api-free.deepl.com/*", "https://api.deepl.com/*"] });

  const useDeepL = async (storage, key) => {
    await storage.updateSettings({ translator: "deepl", sourceLanguageCode: "auto", targetLanguageCode: "ru" });
    await storage.set("local", { apiKeys: { deepl: key } });
  };

  test("translates with a working key", async ({ openPlayer, storage }) => {
    await useDeepL(storage, "free-key:fx");
    const player = await openPlayer();
    await player.captions("run for your life");

    await player.word("run").hover();
    await expect(player.tooltip).toHaveText("run (deepl)");
  });

  const failures = [
    { name: "a key DeepL does not accept", key: INVALID_DEEPL_KEY, message: "DeepL did not accept your API key. Check it in the HoverTranslate settings" },
    { name: "too many requests (429)", answer: () => ({ status: 429, body: "{\"message\":\"Too many requests\"}" }), message: "DeepL: too many requests, try again in a moment" },
    { name: "no connection", answer: () => "abort", message: "Could not reach DeepL. Check your connection" },
  ];

  for (const { name, key = "free-key:fx", answer, message } of failures) {
    test(`${name}: the message says so`, async ({ openPlayer, storage, network }) => {
      await useDeepL(storage, key);
      if (answer) network.answer("api-free.deepl.com", answer);
      const player = await openPlayer();
      await player.captions("run for your life");

      await player.word("run").hover();

      await expect(player.notification).toHaveText(message);
      await expect(player.tooltip).toHaveCount(0);
    });
  }
});

import { describe, expect, it } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/config/i18n.ts";
import { renderPopup } from "./renderPopup.tsx";

const AUTO_THEME = {
  useYouTubeSettings: false,
  fontFamily: "auto",
  fontColor: "auto",
  fontSize: "auto",
  fontOpacity: "auto",
  backgroundColor: "auto",
  backgroundOpacity: "auto",
  characterEdgeStyle: "auto",
};

/**
 * A field of the page once the stored theme is on it: the page renders the
 * defaults (every field disabled) before it has read `tooltipTheme`.
 * `label` is the field's name in the popup's language.
 */
const field = (label: string) => waitFor(() => {
  const select = screen.getByRole("combobox", { name: new RegExp(`^${label}`) });
  expect(select.getAttribute("aria-disabled")).not.toBe("true");
  return select;
});

const openMenu = async (user: Awaited<ReturnType<typeof renderPopup>>["user"], label: string) => {
  await user.click(await field(label));
  return (await screen.findAllByRole("option")).map((option) => option.textContent);
};

describe("the Customize page's menus are in the popup's language, named as in YouTube's caption options", () => {
  it("the closed fields show the stored values in the popup's language", async () => {
    await renderPopup({
      route: "/customize",
      language: "ru",
      sync: { tooltipTheme: { ...AUTO_THEME, fontColor: "red", fontSize: "50%", characterEdgeStyle: "drop-shadow" } },
    });

    expect((await field("Шрифт")).textContent).toBe("Как на YouTube");
    expect((await field("Цвет шрифта")).textContent).toBe("Красный");
    expect((await field("Размер шрифта")).textContent).toBe("50\u00a0%");
    expect((await field("Стиль контура символов")).textContent).toBe("С тенью");
  });

  it("follow the popup's language when it changes on the page", async () => {
    await renderPopup({ route: "/customize", language: "en", sync: { tooltipTheme: { ...AUTO_THEME, fontSize: "50%" } } });
    expect((await field("Font size")).textContent).toBe("50%");

    await act(() => i18n.changeLanguage("tr"));

    expect((await field("Yazı tipi boyutu")).textContent).toBe("%50");
    expect((await field("Yazı tipi ailesi")).textContent).toBe("YouTube'daki gibi");
  });

  it("ru: the font families, in YouTube's order", async () => {
    const { user } = await renderPopup({ route: "/customize", language: "ru", sync: { tooltipTheme: AUTO_THEME } });

    expect(await openMenu(user, "Шрифт")).toEqual([
      "Как на YouTube",
      "Моноширинный с засечками",
      "Пропорциональный с засечками",
      "Моноширинный без засечек",
      "Пропорциональный без засечек",
      "Обычный",
      "Курсив",
      "Малые прописные",
    ]);
  });

  it("en: the character edge styles, with \"auto\" said as what it is", async () => {
    const { user } = await renderPopup({ route: "/customize", language: "en", sync: { tooltipTheme: AUTO_THEME } });

    expect(await openMenu(user, "Character edge style")).toEqual([
      "As on YouTube", "None", "Drop Shadow", "Raised", "Depressed", "Outline",
    ]);
  });

  it("tr: the percentages are written as Turkish writes them", async () => {
    const { user } = await renderPopup({ route: "/customize", language: "tr", sync: { tooltipTheme: AUTO_THEME } });

    expect((await openMenu(user, "Yazı tipi boyutu"))[1]).toBe("%50");
  });

  it("picking a translated item stores its value, not its label", async () => {
    const { fake, user } = await renderPopup({ route: "/customize", language: "ru", sync: { tooltipTheme: AUTO_THEME } });

    await openMenu(user, "Цвет шрифта");
    await user.click(screen.getByRole("option", { name: "Синий" }));

    await waitFor(() => expect(fake.storage.sync.tooltipTheme).toEqual({ ...AUTO_THEME, fontColor: "blue" }));
  });
});

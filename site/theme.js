// The theme the viewer picked with the button in the header, as the popup's ThemeToggle works:
// nothing picked means the system's theme (CSS alone does that), a click picks the other one and
// keeps it. Loaded in <head> without defer, so the theme is on <html> before the first paint.
(function () {
  var KEY = "hoverTranslateSiteTheme";
  var root = document.documentElement;
  var system = matchMedia("(prefers-color-scheme: dark)");
  var current = function () {
    return root.dataset.theme || (system.matches ? "dark" : "light");
  };

  try {
    var kept = localStorage.getItem(KEY);
    if (kept === "light" || kept === "dark") root.dataset.theme = kept;
  } catch (error) {
    // Storage blocked: the system's theme
  }

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector(".theme-toggle");
    if (!button) return;
    // The label names the theme a click switches to, as the icon does
    var label = function () {
      var text =
        current() === "dark" ? "Switch to light theme" : "Switch to dark theme";
      button.setAttribute("aria-label", text);
      button.title = text;
    };
    button.addEventListener("click", function () {
      root.dataset.theme = current() === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, root.dataset.theme);
      } catch (error) {
        // Kept for this page only
      }
      label();
    });
    system.addEventListener("change", label);
    label();
    button.hidden = false;
  });
})();

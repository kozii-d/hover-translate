import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  { languageOptions: { globals: { ...globals.browser, ...globals.webextensions, chrome: "readonly", } } },
  pluginJs.configs.recommended,
  {
    rules: {
      "indent": ["error", 2],
      "linebreak-style": ["error", "unix"],
      "quotes": ["error", "double"],
      "semi": ["error", "always"],
      "object-curly-spacing": ["warn", "always"],
      "no-console": ["error", { "allow": ["warn", "error"] }],
      "no-import-assign": "off",
    },
  }
];
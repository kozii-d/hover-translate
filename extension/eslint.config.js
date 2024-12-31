import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.webextensions,
      ...globals.node,
      chrome: "readonly",
      __API_URL__: "readonly",
    },
  } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      indent: ["error", 2],
      "linebreak-style": ["error", "unix"],
      quotes: ["error", "double"],
      semi: ["error", "always"],
      "object-curly-spacing": ["warn", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-import-assign": "off",
    },
  }
];
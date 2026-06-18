import js from "@eslint/js";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import security from "eslint-plugin-security";
import globals from "globals";

export default [
  { ignores: ["docs/", "dist/", "dist-test/", "coverage/", "node_modules/"] },

  js.configs.recommended,
  security.configs.recommended,
  noUnsanitized.configs.recommended,

  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-proto": "error",
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      // off for board indexes
      "security/detect-object-injection": "off",
      // no innerHTML and friends
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Use textContent." },
        { property: "outerHTML", message: "Use textContent." },
        { property: "insertAdjacentHTML", message: "Build DOM nodes instead." },
        { object: "document", property: "write", message: "Not allowed." },
      ],
    },
  },

  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // tests run in Node and jsdom
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // build and test tools read files by path
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-object-injection": "off",
    },
  },
];

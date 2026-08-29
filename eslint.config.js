import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "android/**",
      "release/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "docker/**",
      ".cursor/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["server/**/*.js"],
    rules: {
      "no-control-regex": "off",
      "no-useless-escape": "warn",
      "no-undef": "warn",
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    rules: {
      "no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "no-useless-escape": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react/no-unknown-property": "warn",
    },
  },
  prettier,
];

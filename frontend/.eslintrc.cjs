/* eslint-env browser */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["react", "react-hooks"],
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  settings: {
    react: { version: "detect" },
  },
  rules: {
    // The guard that matters: a name used in a component must exist in the
    // scope that brings it in. This is what caught `language is not defined`
    // in Budgets.jsx and `raw is not defined` in the direction classifier.
    "no-undef": "error",
    // The new JSX transform does not need React in scope.
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    // The codebase mixes styles; these do not affect correctness.
    "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
    "no-empty": ["warn", { allowEmptyCatch: true }],
  },
  ignorePatterns: ["dist/", "node_modules/", "build/"],
};

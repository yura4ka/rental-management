// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*"],
    rules: {
      "import/order": [
        "error",
        {
          groups: [
            "builtin", // Node "fs", "path", etc.
            "external", // Packages like "react", "expo-status-bar"
            "internal", // Aliases like "@/lib/hooks"
            ["parent", "sibling", "index"], // Relative imports
          ],
          pathGroups: [
            {
              pattern: "@/**",
              group: "external",
              position: "after",
            },
            {
              pattern: "react",
              group: "builtin",
              position: "after",
            },
            {
              pattern: "react*",
              group: "external",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin", "react"],
          "newlines-between": "never",
        },
      ],
    },
  },
]);

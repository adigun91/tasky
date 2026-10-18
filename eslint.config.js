// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions run on Deno, a separate runtime/lint environment from the Expo app.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);

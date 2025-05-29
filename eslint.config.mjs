import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

export default defineConfig([
    { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], plugins: { js }, extends: ["js/recommended"] },
    { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx,js,jsx}"],
        rules: {
            // Allow unused function parameters (disable rule)
            '@typescript-eslint/no-unused-vars': 'off',
            'quotes': ['error', 'double']
        }
    },
    { files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] },
    { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
]);

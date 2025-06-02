import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import css from "@eslint/css";
import prettier from "eslint-plugin-prettier";

export default [
    // Base JavaScript configuration
    js.configs.recommended,

    // TypeScript configuration
    ...tseslint.configs.recommended,

    // General configuration for JS/TS files
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
    },

    // TypeScript and Prettier rules
    {
        files: ["**/*.{ts,tsx,js,jsx}"],
        plugins: {
            prettier,
        },
        rules: {
            // TypeScript rules
            "@typescript-eslint/no-unused-vars": "off",

            // Prettier rules
            "prettier/prettier": "warn",

            // Style rules
            quotes: ["warn", "double", { avoidEscape: true }],
        },
    },

    // CSS configuration
    {
        files: ["**/*.css"],
        plugins: {
            css,
        },
        language: "css/css",
        rules: {
            ...css.configs.recommended.rules,
        },
    },
];

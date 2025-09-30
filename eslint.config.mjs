import js from "@eslint/js";
import globals from "globals";

export default [
  // ✅ Config recommandée d'ESLint
  js.configs.recommended,

  // ✅ Ta config personnalisée
  {
    files: ["**/*.{js,mjs,cjs}"],

    languageOptions: {
      globals: {
        ...globals.node,     // Node.js globals
        ...globals.browser,  // Browser globals si nécessaire
        ...globals.jest,     // ✅ Ajout des globals Jest (describe, it, expect…)
      },
    },

    rules: {
      // ignore les arguments non utilisés nommés "next" (pratique pour Express)
      "no-unused-vars": [
        "warn",
        { 
          args: "after-used",
          argsIgnorePattern: "^next$" // ignore "next" spécifiquement
        }
      ],

      "no-console": "off", // utile en dev
    },
  },
];

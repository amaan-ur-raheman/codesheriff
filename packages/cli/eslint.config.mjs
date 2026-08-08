import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript already catches undefined identifiers at compile time.
      "no-undef": "off",
      // Mirror the web package: explicit `any` annotations are allowed.
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);

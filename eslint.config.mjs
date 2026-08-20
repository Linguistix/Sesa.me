import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    // Prisma regenerates these on every build; they are not ours to lint.
    ignores: [
      "src/generated/**",
      ".next/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      // Plain Node scripts standing in for external services during tests.
      "test-harness/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Route handlers and actions legitimately discard a caught error after
      // deciding what to return; everything else stays flagged.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
];

export default config;

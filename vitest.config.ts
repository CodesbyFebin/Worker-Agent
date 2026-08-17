import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/tests/**/*.test.ts", "client/src/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "c8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: [
        "server/**/*.ts",
        "server/**/*.js",
        "client/src/**/*.ts",
        "client/src/**/*.tsx"
      ],
      exclude: [
        "server/tests/**",
        "server/**/*.test.ts",
        "server/**/*.spec.ts",
        "server/dist/**",
        "client/src/**/*.test.ts",
        "client/src/**/*.spec.ts",
        "client/dist/**",
        "client/public/**",
        "node_modules/**"
      ],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 60,
        statements: 70
      }
    }
  }
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/tests/**/*.test.ts", "client/src/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
    setupFiles: ["./vitest.setup.ts"],
  },
});

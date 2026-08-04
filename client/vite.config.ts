import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // npm workspaces may hoist @trpc/* to the monorepo root while leaving
    // @tanstack/react-query nested under client/ — alias so Vite can resolve it.
    alias: {
      "@tanstack/react-query": path.resolve(root, "../node_modules/@tanstack/react-query"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  server: {
    port: 5173,
    proxy: {
      "/trpc": "http://localhost:4000",
      "/events": "http://localhost:4000",
      "/health": "http://localhost:4000",
    },
  },
});

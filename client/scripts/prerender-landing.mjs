/**
 * Post-build prerender script: renders the public LandingPage component to
 * static HTML and writes a fully-formed HTML document to dist/prerendered.html.
 *
 * The Vercel rewrite routes "/" to this file so search engines see real content
 * instead of an empty <div id="root">.
 *
 * Run: node scripts/prerender-landing.mjs
 * (must be executed AFTER `vite build` so dist/assets/ exists)
 */
import { createServer } from "vite";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function main() {
  const cwd = process.cwd();
  const distDir = path.join(cwd, "dist");

  // Use Vite's dev server in middleware mode to load the TypeScript/React
  // module with full transform pipeline (no need to listen on a port).
  const server = await createServer({
    server: { middlewareMode: true },
    appDir: cwd,
    plugins: [],
    configFile: false,
  });

  const mod = await server.ssrLoadModule("/src/marketing/LandingPage.tsx");
  const appHtml = renderToStaticMarkup(
    React.createElement(mod.LandingPage, { onLaunchApp: () => {} }),
  );

  await server.close();

  const indexHtmlPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexHtmlPath)) {
    console.error("dist/index.html not found. Run 'vite build' first.");
    process.exit(1);
  }
  const template = fs.readFileSync(indexHtmlPath, "utf-8");

  const cssAsset = fs
    .readdirSync(path.join(distDir, "assets"))
    .find((f) => f.endsWith(".css"));

  const fullHtml = template
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-ssr="landing">${appHtml}</div>` +
        `<script>window.__SSR=true;</script>`,
    )
    .replace(
      /<link rel="stylesheet"[^>]*>/,
      cssAsset
        ? `<link rel="stylesheet" href="/assets/${cssAsset}" />`
        : "",
    );

  fs.writeFileSync(path.join(distDir, "prerendered.html"), fullHtml);
  console.log("prerendered.html written to dist/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

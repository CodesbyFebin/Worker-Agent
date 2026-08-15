#!/usr/bin/env node
/*
 * Worker Agent Cloud — Local Development Bootstrap
 *
 * Starts the API server and the client dev server concurrently.
 * - API runs on PORT (default 3001) with HMR via tsx
 * - Client runs on Vite dev server (default 5173)
 *
 * Usage:
 *   npm run dev          # starts both
 *   npm run dev:api      # API only
 *   npm run dev:web      # Client only
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const isWin = process.platform === "win32";
const clientExists = existsSync("client");
const serverExists = existsSync("server");

const children = [];

function spawnCmd(cmd, args, cwd, label) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: isWin,
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  child.on("close", (code) => {
    if (code !== 0 && !child.killed) {
      console.log(`[${label}] exited with code ${code}`);
    }
  });

  children.push(child);
  return child;
}

const api = spawnCmd("npx", ["tsx", "src/index.ts"], "server", "api");
const web = spawnCmd("npx", ["vite"], "client", "web");

function shutdown(signal) {
  console.log(`\n${signal} — shutting down...`);
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Exit if either process exits
api.on("exit", (code) => {
  console.log(`[api] exited with ${code}`);
  for (const child of children) {
    if (child !== api && !child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(code ?? 1);
});

web.on("exit", (code) => {
  console.log(`[web] exited with ${code}`);
  for (const child of children) {
    if (child !== web && !child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(code ?? 1);
});

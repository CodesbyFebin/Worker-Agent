import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

const rootEl = document.getElementById("root")!;

if (typeof window !== "undefined" && (window as unknown as { __SSR?: boolean }).__SSR) {
  hydrateRoot(
    rootEl,
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

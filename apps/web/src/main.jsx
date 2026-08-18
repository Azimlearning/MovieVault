import "./ipc/polyfill";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Without an explicit check a client can sit on an old worker (and the
        // build it cached) for as long as the tab or installed PWA lives —
        // which is how a fixed bug keeps reproducing for one user and nobody
        // else. The new worker calls skipWaiting, so one reload adopts it.
        registration.update?.().catch(() => {});
      })
      .catch(() => {});

    // Only a *replacement* worker warrants a reload. On a first visit the
    // page is uncontrolled and the new worker claiming it changes nothing that
    // is already on screen, so reloading there would just be a visible flash.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

// A tab left open across a deploy still holds the old index, so its lazy chunk
// hashes 404 and the error boundary catches "Failed to fetch dynamically
// imported module". The fix is simply to fetch the new index — but only once
// per session, or a genuinely missing chunk would reload forever.
// Clearing the flag on load would defeat it: a chunk that is genuinely gone
// would reload forever. A timestamp instead allows one recovery per minute, so
// a second deploy later in a long session is still handled, while a real
// failure falls through to the error boundary and its Reload button.
const RELOAD_STAMP = "movievault_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 60000;
window.addEventListener("vite:preloadError", (event) => {
  const last = Number(sessionStorage.getItem(RELOAD_STAMP) || 0);
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
  sessionStorage.setItem(RELOAD_STAMP, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

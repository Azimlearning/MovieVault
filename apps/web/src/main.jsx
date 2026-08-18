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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

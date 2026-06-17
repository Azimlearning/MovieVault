# Architectural Decisions — MovieVault

> Record decisions here so they aren't re-debated in future sessions.
> Format: **Decision** → **Why** → **Trade-offs / what was rejected**

---

## App Architecture

### ADR-001 — Electron + separate web app (not Electron-as-PWA)
**Decision:** Maintain two separate codebases — Electron (`src/`) for desktop, Vite+React (`apps/web/`) for browser.

**Why:** Electron enables native file downloads, mpv/external player integration, secure credential storage, `webview` tags for casting, and system-level features (Discord RPC, PiP windows). These cannot be polyfilled in a browser. The web app exists for public access; the Electron app is the primary product.

**Rejected:** Single PWA — can't do file downloads, external player launch, or native `webview`.

**Trade-off:** Two trees to keep in sync. Visual/UI changes to Electron must be manually ported to web. Mitigated by keeping components structurally identical so diffs are minimal.

---

### ADR-002 — IPC polyfill pattern for web (not separate component trees)
**Decision:** Web app stubs the entire `window.electron` API in `apps/web/src/ipc/polyfill.js`, injected before React mounts. Components are identical; only the IPC layer differs.

**Why:** Minimizes the divergence surface. A component that works in Electron works in the web app without modification — it just gets no-op or localStorage-backed responses for native calls.

**Rejected:** Separate web-specific component variants — doubles the file count and makes parity tracking a nightmare.

**Trade-off:** Polyfill must be kept in sync as new `window.electron` methods are added. Easy to miss. Add new methods to polyfill whenever adding new IPC handlers.

---

## Build & Tooling

### ADR-003 — Vite for both Electron renderer and web (not webpack/CRA)
**Decision:** Vite for both `vite.config.js` (Electron) and `apps/web/vite.config.js` (web).

**Why:** Fast HMR, ESM-native, minimal config. Electron renderer runs in Chromium so full ESM support is safe.

**Trade-off:** None significant. Electron build uses `base: "./"` so asset paths resolve correctly from the local filesystem.

---

### ADR-004 — Manual Vite chunks for Electron build
**Decision:** Electron `vite.config.js` uses `manualChunks` to split `react`, `settings`, `movie`, `tv`, `downloads` into separate bundles.

**Why:** Reduces initial load time — heavy pages (Movie, TV, Settings) are lazy-loaded. React core is cached separately.

**No equivalent in web build** — web app currently uses Vite defaults (single bundle). Can add manual chunks later if bundle size becomes a concern.

---

## UI & Styling

### ADR-005 — No framer-motion; pure CSS animations
**Decision:** All transitions and animations use CSS keyframes / transitions. `framer-motion` is not installed.

**Why:** `framer-motion` wasn't installed when animation work began (Phase 4.3). Pure CSS achieves the same visual outcome (180ms fade+slide page transitions, card hover scale) with zero bundle cost.

**Rejected:** Adding `framer-motion` mid-project — not worth the dependency for effects already working in CSS.

**Trade-off:** Complex choreographed animations (staggered lists, shared-element transitions) would be harder without a library. Acceptable for current scope.

---

### ADR-006 — Self-hosted fonts (DM Sans + Bebas Neue)
**Decision:** Fonts are bundled as woff2 files in `src/styles/fonts/` (and mirrored in `apps/web/src/styles/fonts/`).

**Why:** No external font requests — faster load, works offline (Electron), no Google Fonts privacy concerns.

---

### ADR-007 — YouTube iframe for trailer autoplay (not direct HLS/mp4)
**Decision:** `HeroBanner.jsx` uses a muted YouTube `<iframe>` for trailer playback.

**Why:** TMDB returns YouTube video IDs for trailers. Fetching and re-serving the actual video stream is legally and technically complex. YouTube iframe is the simplest path to working trailer previews.

**Trade-off:** YouTube `enablejsapi=1` postMessage mute/unmute only works in Electron with `webSecurity: false`. On web, the iframe loads but mute/unmute via postMessage may be silently blocked by cross-origin restrictions. Functional but not fully controllable from web context.

---

## Data & Storage

### ADR-008 — TMDB as the sole metadata source
**Decision:** All movie/TV metadata comes from TMDB. No other metadata providers.

**Why:** TMDB is free, comprehensive, and has a well-documented API. The API key setup flow is already built (`SetupScreen.jsx`).

**Trade-off:** TMDB data quality varies by region and title. No fallback if TMDB is down.

---

### ADR-009 — localStorage for web storage; electron-store for Electron
**Decision:** Electron uses `electron-store` (via IPC) for all persistent data. Web uses `localStorage` via the polyfill's `secureGet`/`secureSet`.

**Why:** `electron-store` is encrypted and stored in the OS user data directory — appropriate for API keys and watch history. `localStorage` is the only persistent storage available in a plain browser context.

**Trade-off:** Web localStorage is not encrypted and is origin-scoped. Acceptable for personal use. Users should not store sensitive credentials in a shared browser profile.

---

### ADR-010 — In-memory request cache with TTL (`cache.js`)
**Decision:** TMDB API responses are cached in memory for the session with a TTL.

**Why:** Navigating between pages re-triggers the same TMDB calls. In-memory cache eliminates redundant requests without requiring IndexedDB or service workers.

**Trade-off:** Cache is lost on reload. Acceptable — TMDB data doesn't change minute-to-minute.

---

## Features

### ADR-011 — One Pace uses webview (Electron only, not ported to web)
**Decision:** One Pace player uses an Electron `<webview>` tag. Not available in the web app.

**Why:** One Pace episodes are served from an external site. A `webview` isolates the external page in its own renderer process with its own session, enabling cookie isolation and script injection.

**Not ported to web:** `<webview>` has no browser equivalent. The web polyfill stubs One Pace IPC calls as no-ops.

---

### ADR-012 — Watch Party uses a relay server (not WebRTC peer-to-peer)
**Decision:** Watch Party sync goes through a relay server (`partyConfig.js`), not direct WebRTC.

**Why:** Peer-to-peer WebRTC requires STUN/TURN infrastructure and has NAT traversal issues. A relay server is simpler to reason about and debug.

**Status:** Code-complete but relay server is undeployed as of 2026-06-17. See `refdocs/execution/V2_EXECUTION_PLAN.md` Phase 6.

# Pre-Ship Checklist — MovieVault

> Run through the relevant section before pushing or deploying. Check off items as you go.
> Not every item applies to every change — use judgement based on what changed.

---

## Every Change (Electron or Web)

- [ ] **Changelog updated** — entry added to `refdocs/changelog/CHANGELOG.md`
- [ ] **No secrets committed** — `.env` is NOT staged (`git status` shows it as untracked/ignored)
- [ ] **No console.error / unhandled promise rejections** visible in dev tools during normal use
- [ ] **Component builds without errors** — `npm run build` (root) or `cd apps/web && npm run build` passes

---

## Electron App Changes (`src/`)

- [ ] `npm run start` launches without errors in the terminal
- [ ] Changed page loads correctly (no blank screen, no JS errors in DevTools)
- [ ] If new IPC handler added → also added stub to `apps/web/src/ipc/polyfill.js`
- [ ] If new `window.electron` method added → `preload.js` exposes it
- [ ] Skeleton loading shown during data fetch (not a blank content area)
- [ ] Error state shown if TMDB returns an error (not a crash)
- [ ] `prefers-reduced-motion` tested — animations disabled when OS setting is on
- [ ] Library save/unsave works correctly on changed page
- [ ] Settings page opens and saves without errors

### Downloads / Player
- [ ] Download flow initiates correctly (if downloads touched)
- [ ] External player launches (if player IPC touched)
- [ ] Subtitle search returns results (if subtitles touched)

### One Pace (if touched)
- [ ] Arc list loads on `OnePacePage`
- [ ] Episode list loads on `OnePaceArcPage`
- [ ] Player webview launches without crash

### Watch Party (if touched)
- [ ] Host modal opens
- [ ] Relay server URL is correct in `partyConfig.js`

---

## Web App Changes (`apps/web/`)

- [ ] `cd apps/web && npm run dev` starts without errors
- [ ] `http://localhost:5173` loads in browser (Chrome recommended)
- [ ] Changed page renders correctly — no blank areas, no JS errors in console
- [ ] **Polyfill check** — any feature that depends on `window.electron` degrades gracefully (shows disabled state, not a crash)
- [ ] TMDB API key entry works on SetupScreen (first-run flow)
- [ ] Search modal opens and returns results
- [ ] Library page shows saved items (localStorage persists across refresh)
- [ ] Movie and TV detail pages load metadata, cast, and similar titles

### Web-specific
- [ ] `cd apps/web && npm run build` completes without errors
- [ ] No hardcoded `localhost` URLs or Electron-only API calls that would crash in production
- [ ] Vercel API routes (`apps/web/api/`) proxy correctly (test with network tab)

---

## Before a Vercel Deploy (Web App)

- [ ] `npm run build` in `apps/web/` passes locally
- [ ] Vercel env vars set in dashboard: `TMDB_API_KEY`, `TMDB_READ_ACCESS_TOKEN`
- [ ] `apps/web/vercel.json` has correct SPA rewrite rule
- [ ] Test the deploy preview URL before promoting to production
- [ ] Home page loads trending content (confirms TMDB proxy is working)
- [ ] Search returns results (confirms API key is valid in Vercel env)

---

## Before an Electron Distribution Build

- [ ] `npm run dist:win` (or platform equivalent) completes without errors
- [ ] `ELECTRON_DIST=1` build has `drop_console: true` (logs stripped)
- [ ] App version bumped in `package.json`
- [ ] CHANGELOG entry written for the version
- [ ] Installer launches on a clean machine (or VM) without errors
- [ ] Auto-update check works (if update server is configured)

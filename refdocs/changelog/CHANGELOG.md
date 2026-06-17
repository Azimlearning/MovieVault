# CHANGELOG — MovieVault

> **MANDATORY FOR ALL AI AGENTS**
> After every session where code was changed, a decision was made, or a plan was modified — add an entry below under `## [Unreleased]`. Do not skip this even for small changes. Preserve all past entries.
>
> **Entry format:**
> ```
> ### YYYY-MM-DD — [short summary of session goal]
> - **Changed:** what files/components were touched and why
> - **Decided:** any architectural or design decisions made and the reasoning
> - **Deviations:** anything that differed from the plan, and why
> - **Known issues / next steps:** what was left open
> ```

---

## [Unreleased]

### 2026-06-17 — Repo documentation reorganization
- **Changed:** Created `refdocs/` folder structure with subfolders `changelog/`, `plans/`, `execution/`, `guides/`. Moved all loose `.md` files from root into the appropriate subfolder.
- **Changed:** Created `CLAUDE.md` at project root to brief AI agents on the two-codebase structure (Electron `src/` vs Web `apps/web/src/`) and mandatory doc rules.
- **Decided:** All future improvement plans go in `refdocs/plans/`, all execution plans in `refdocs/execution/`, all AI session logs here in `refdocs/changelog/CHANGELOG.md`.
- **Deviations:** None — pure housekeeping, no code changed.
- **Known issues / next steps:** Web app (`apps/web/src/`) still being updated to match V2 Electron UI (HeroBanner, CastRow, RatingBadge, SimilarRow in progress).

---

### 2026-05-24 — Phase 4.3: Page Transitions & Card Hover
- **Changed:** Premium 180ms fade+slide page transitions on forward navigation (instant on back). Card hover scales to 1.08× with lift shadow; tactile 0.96× active-state click feedback; custom focus ring with red outline+glow. 600ms hover delay triggers an `InfoPopout` overlay via React Portal with title, rating, year, runtime, genres, and synopsis. Arrow-key grid navigation with geometric coordinate-based DOM search.
- **Decided:** All effects bypass when `prefers-reduced-motion: reduce`.
- **Deviations:** Used pure CSS keyframes instead of `framer-motion` (not installed); kept same UX outcome.
- **Known issues / next steps:** None.

### 2026-05-24 — Phase 4.2: Hero Banner with Trailer Autoplay
- **Changed:** Full-width `<HeroBanner>` component replaces the static `.hero` block on HomePage. Shows 5 rotating featured titles (3 trending movies + 2 trending TV, interleaved). Auto-advances every 12s when not hovered. After 2s of hover/visibility, fetches the TMDB `/videos` trailer endpoint and fades in a muted YouTube iframe. Unmute/mute toggle sends `postMessage` to YouTube iframe. "Play" CTA passes `playDirectly:true`. "Add to Library" syncs with global save state.
- **New files:** `src/components/HeroBanner.jsx`
- **Modified files:** `src/pages/HomePage.jsx`, `src/pages/MoviePage.jsx`, `src/pages/TVPage.jsx`, `src/utils/storage.js`, `src/pages/SettingsPage.jsx`, `src/styles/global.css`
- **Decided:** Settings → Playback "Autoplay trailers on banner" toggle hard-bypasses the trailer path.
- **Deviations:** Used pure CSS opacity transitions instead of `framer-motion` cross-fade; IntersectionObserver covers the "visibility" trigger from the spec.
- **Known issues / next steps:** YouTube `enablejsapi=1` postMessage mute/unmute requires Electron `webSecurity: false`.

### 2026-05-24 — Phase 4.2: Error State System
- **Changed:** Centralized error codes utility in `src/utils/errors.js`. Reusable `<AsyncBoundary>` component with loading, error, and empty states. Exponential backoff cooldown (1s, 2s, 5s) for retry button. Safe-wrapping IPC registration helper `safeHandle` in `index.js`. Offline warning banner at top of main layout.
- **Deviations:** None.
- **Known issues / next steps:** None.

### 2026-05-24 — Phase 4.1: Skeleton Loading System
- **Changed:** Shape-matched skeleton loading system across Home, Library, Movie Details, TV Details, and Search. Low-contrast shimmering skeletons aligned to final layout to eliminate layout shifts. Respects `prefers-reduced-motion`.
- **New dependencies:** None (native HTML/CSS only).
- **Deviations:** None.
- **Known issues / next steps:** None.

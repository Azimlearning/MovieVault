# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Phase 4.1: Skeleton Loading System** (2026-05-24)
  - **What shipped**: A premium, shape-matched skeleton loading system to replace raw loaders and spinners across MovieVault content surfaces (Home, Library, Movie Details, TV Details, and Search). It renders low-contrast shimmering layout skeletons that align exactly with final data presentation to eliminate layout shifts on data fetch completion. Skeletons also respect prefers-reduced-motion, halting the shimmer effect for static backgrounds.
  - **New dependencies**: None (built entirely using native HTML/CSS).
  - **Known issues / followups**: None.
  - **Deviations from PRD**: None.

- **Phase 4.2: Error State System**
  - Centralized error codes utility in `src/utils/errors.js`.
  - Reusable `<AsyncBoundary>` component with loading, error, and empty states.
  - Exponential backoff cooldown (1s, 2s, 5s) for retry button actions.
  - Safe-wrapping IPC registration helper `safeHandle` in `index.js`.
  - Offline warning banner at the top of the main layout, rendering when internet connection is lost.

- **Phase 4.3: Page Transitions & Card Hover** (2026-05-24)
  - **What shipped**: Premium 180ms fade+slide page transitions on forward navigation (instant on back). Card hover scales to 1.08× with lift shadow; tactile 0.96× active-state click feedback; custom focus ring with red outline+glow. 600ms hover delay triggers an `InfoPopout` overlay via React Portal with title, rating, year, runtime, genres, and synopsis. Arrow-key grid navigation with geometric coordinate-based DOM search. All effects bypass when `prefers-reduced-motion: reduce`.
  - **New dependencies**: None.
  - **Known issues / followups**: None.
  - **Deviations from PRD**: Used pure CSS keyframes instead of `framer-motion` (not installed); kept same UX outcome.

- **Phase 4.2: Hero Banner with Trailer Autoplay** (2026-05-24)
  - **What shipped**: Full-width `<HeroBanner>` component replaces the static `.hero` block on HomePage. Shows 5 rotating featured titles (3 trending movies + 2 trending TV, interleaved). Auto-advances every 12s when not hovered. After 2s of hover/visibility, fetches the TMDB `/videos` trailer endpoint and fades in a muted YouTube iframe (lazy-mounted; not created until threshold met). 4s after mouse-off, trailer fades back to poster. Unmute/mute toggle sends `postMessage` to YouTube iframe. Dot indicators collapse into a combined control bar during trailer playback. "Play" CTA passes `playDirectly:true` to MoviePage/TVPage triggering immediate playback. "Add to Library" syncs with the global save state. `prefers-reduced-motion` and the Settings → Playback "Autoplay trailers on banner" toggle both hard-bypass the trailer path.
  - **New files**: `src/components/HeroBanner.jsx`.
  - **Modified files**: `src/pages/HomePage.jsx`, `src/pages/MoviePage.jsx`, `src/pages/TVPage.jsx`, `src/utils/storage.js`, `src/pages/SettingsPage.jsx`, `src/styles/global.css`.
  - **New dependencies**: None.
  - **Known issues / followups**: YouTube's `enablejsapi=1` postMessage mute/unmute requires the iframe to be served from a context where the YouTube API initialises (works in Electron with `webSecurity: false`).
  - **Deviations from PRD**: Used pure CSS opacity transitions instead of `framer-motion` cross-fade (not installed); IntersectionObserver covers the "visibility" trigger from the spec.


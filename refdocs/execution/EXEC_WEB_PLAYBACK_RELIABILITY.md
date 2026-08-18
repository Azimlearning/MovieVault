# EXEC — Web Playback Reliability & Streaming UX

> Companion plan: [PLAN_WEB_PLAYBACK_RELIABILITY.md](../plans/PLAN_WEB_PLAYBACK_RELIABILITY.md)
> Status: Phase 1 complete; Phase 2 baseline complete 2026-08-18.

## Phase 1 — Safer defaults

- Updated `apps/web/src/utils/api.js`: non-anime sessions default to Videasy, the provider verified to play without an iframe sandbox.
- Updated `apps/web/src/utils/sourceQueue.js`: Pop-up Shield is opt-in; when enabled it prioritises sandboxed alternatives with the known compatibility trade-off.
- Checkpoint: `npm run build` in `apps/web` passes.

## Phase 2 — Branding

- Added `apps/web/public/movievault-mark.svg`.
- Updated the sidebar wordmark and browser favicon to use the new mark.
- Checkpoint: visual inspection in Playwright at desktop and mobile sizes.

## Phase 3 — Browser verification

- Started the production preview with `vite preview`.
- Captured Playwright Chromium screenshots at 1440×900 and 390×844.
- Confirmed the first-run UI renders without a blank page or layout overflow.
- Deferred: end-to-end title playback requires a valid TMDB session and a provider/network test. Cross-origin iframe loading alone is not sufficient verification.

## Rollback

- Revert the source default and queue changes independently to restore the previous provider order.
- Revert the favicon/sidebar asset references independently to restore the previous mark.

## Phase 4 — High-impact UX controls

- `OnePacePlayer.jsx` and `onepacePlayer.css`: add two-step screen lock, double-tap and button seeking, speed selection, and an always-available next-episode action.
- `SearchModal.jsx` plus storage helpers: audit the existing persisted recent searches and pre-query suggestions.
- `HomePage.jsx` plus a reusable skeleton component: reserve the hero and rail/card layout during initial loading.
- Checkpoint: build, then Playwright desktop and mobile visual smoke tests. Test native video interaction with a valid media URL separately.

### Delivered

- One Pace now provides visible ±10-second controls, left/right double-tap seeking, one-tap control reveal, a two-step screen lock, 0.5×–1.5× playback speed, and a next-episode action.
- Home loading now uses a layout-preserving hero and card skeleton through `AsyncBoundary`.
- Audit confirmed that Search already persists removable recent searches and offers trending suggestions before a query; no duplicate implementation was added.
- Verification: `npm run build` passes. Native-media interaction still needs a valid One Pace stream during a browser/device test.

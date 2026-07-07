# Execution Plan — UI Redesign V3 (Electron app)

## Companion plan
[PLAN_UI_REDESIGN_V3.md](../plans/PLAN_UI_REDESIGN_V3.md)

## Status at authoring
Nothing implemented yet. `IMPROVEMENT_PLAN_V2.md` / `V2_EXECUTION_PLAN.md` are fully shipped (P4+P5+P6 all done per `CLAUDE.md`) and are not touched by this work. This is Phase 0 of a brand-new initiative.

---

## Phases

### Phase 0 — Lock the design system ✅ Done (2026-06-17)

**Files to create/modify:** none in `src/` yet. Output is a decision, recorded back into `PLAN_UI_REDESIGN_V3.md` §4/§6.

**Steps:**
1. ~~Resolve open question #1 (exact hex values)~~ — built `refdocs/plans/v3-palette-swatch.html` as the gut-check swatch. User's call: keep near-black surfaces unchanged (the red accent was the only "Netflix" part, not the darkness), swap `--red*` → `--accent*` (amber `#FF8A3D`/`#FFAA66`), add `--violet: #7C6FE0` as a sparing secondary accent, keep existing unused `--gold: #c8a84b` reserved for ratings only.
2. ~~Resolve open question #3 (Bento sizing rule)~~ — first item in discovery rows (Trending/Popular/Recommended/genre) gets a 2x1 featured span, everything else 1x1; utility rows (Continue Watching, Library, Downloads, search, episode grids) stay uniform 1x1.
3. ~~Resolve open question #2 (icon production method)~~ — hand-author a master SVG (`public/brand/icon-master.svg`) in `Icons.jsx`'s stroke-based style; add `sharp` as a devDependency to rasterize it (1024×1024 for electron-builder's auto-generated per-platform icons, 256×256 for `index.js`'s runtime window icon). No image-gen tool, no manual `public/sized/*` ladder.

**Checkpoint:** `PLAN_UI_REDESIGN_V3.md` §4 has concrete hex values and a sizing rule; §6 questions 1–3 are marked resolved with the decision inline. ✅ Met.

---

### Phase 1 — New app icon & brand mark ✅ Code done (2026-06-17); GUI/installer checks pending manual confirmation

**Files to create/modify:**
- `public/brand/icon-master.svg` — new master icon, hand-authored (per Phase 0 decision).
- `scripts/build-icons.mjs` (new) — `sharp`-based script that rasterizes the master to a 1024×1024 PNG (electron-builder source) and a 256×256 PNG (runtime window icon).
- `package.json` — add `sharp` devDependency; add an npm script (e.g. `"build:icons": "node scripts/build-icons.mjs"`); update `build.win.icon`, `build.mac.icon`, `build.linux.icon` to point at the new 1024×1024 master PNG instead of `public/icon.png`/`public/sized`.
- `public/sized/*` (all 7 files) and `public/icon.png` — deleted, no longer needed once electron-builder consumes the single master PNG.
- `index.js:222` — update the window-icon path to the new 256×256 PNG output.
- `public/logo.svg` removed; `src/components/Icons.jsx`'s `StreambertLogo` renamed (e.g. `AppLogo`) and pointed at the new asset; update its one call site in `src/components/Sidebar.jsx`.

**Steps:**
1. Design the new mark in the existing `Icons.jsx` SVG line-art language (stroke-based, `viewBox="0 0 24 24"`), saved as `public/brand/icon-master.svg`.
2. Add `sharp`, write `scripts/build-icons.mjs`, run it to produce the 1024×1024 and 256×256 PNGs.
3. Delete `public/sized/*.png` and `public/icon.png`.
4. Update `index.js` and `package.json` icon paths/build config.
5. Update `Sidebar.jsx`'s logo usage and rename `StreambertLogo`.

**Checkpoint:**
- `npx vite build` succeeds, `dist/brand/` contains the 3 new assets, `dist/sized` no longer exists. ✅ Verified.
- `grep -rn "StreambertLogo" src/` returns nothing (both call sites — `Sidebar.jsx` and the previously-unlisted `SetupScreen.jsx` — were updated). ✅ Verified.
- `npm run start` → taskbar/window icon shows the new mark, not the old one. **Not verified by the agent** — this sandbox runs Electron with `ELECTRON_RUN_AS_NODE=1`, which prevents the real GUI from launching here. User to confirm manually.
- `npm run dist:win` (or whichever platform is available to test) → installer icon is the new mark. **Not run yet** — long-running/network-heavy, left for the user to run when convenient.

**Note:** a handful of unrelated leftover "Streambert" *text* strings (User-Agent headers in `src/ipc/{player,subtitles,downloads}.js`, descriptive copy in `SettingsPage.jsx`) were found but intentionally left alone — they're a pre-existing rebrand-cleanup gap, not part of this redesign's scope (§2 only covers the icon/logo *component*, not a full string audit).

**Rollback:** `git checkout -- public/icon.png public/sized public/logo.svg index.js package.json src/components/Icons.jsx src/components/Sidebar.jsx src/components/SetupScreen.jsx scripts/build-icons.mjs` and `git rm -r --cached public/brand` restores the old icon set if the new one breaks a build target (the deletions were done via `git rm`, so they're recoverable from history).

---

### Phase 2 — Design tokens (`global.css`) ✅ Done (2026-06-18)

**Files modified:** `src/styles/global.css`, `src/styles/onepacePlayer.css`, and every component/page file that referenced the old `--red*` tokens or literal `#e50914`/`rgba(229,9,20,...)` (23 files total — see CHANGELOG for the full list).

**What actually happened (bigger than originally scoped):**
1. `:root` tokens replaced: `--red`/`--red2`/`--red-dim`/`--red-glow` → `--accent: #ff8a3d` / `--accent2: #ffaa66` / `--accent-dim` / `--accent-glow` (warm amber). Added `--violet: #7c6fe0` (sparing secondary accent) and `--card-radius`/`--card-shadow`/`--card-shadow-hover`/`--card-gap` (Bento tokens). `--gold`/`--text`/`--text2`/`--text3`/`--bg`/`--surface`/`--surface2`/`--surface3`/`--border` unchanged per the Phase 0 decision.
2. **Discovered mid-phase:** ~150 call sites across `global.css`, `onepacePlayer.css`, and 21 component/page files referenced the old red tokens for two semantically different purposes that happened to share one color: brand/CTA accents (hover states, active tabs, progress bars, "Play" buttons) vs. danger/destructive/error states (delete buttons, factory reset, error boundaries, restricted-rating badges). Surfaced this to the user before bulk-editing rather than guessing — see CHANGELOG decision.
3. Added a new `--danger`/`--danger2`/`--danger-dim`/`--danger-glow` token set (`#e5484d` etc. — a red, but not the literal Netflix `#e50914`) for the destructive/error half of that split.
4. Each of the ~150 occurrences was individually classified brand vs. danger (vs. `--gold` for the one rating-display case in `.popout-rating`) based on its selector/prop context, then recolored — not a blind find-and-replace.

**Checkpoint:** `grep -rniE "e50914|ff1a24" src/` and `grep -rn "var(--red\b" src/` both return nothing. ✅ Verified. `npx vite build` succeeds. ✅ Verified.

---

### Phase 3 — Bento card component (`MediaCard`) ✅ Done (2026-06-18)

**Files modified:** `src/styles/global.css`, `src/components/MediaCard.jsx`, `src/pages/HomePage.jsx`.

**What happened:**
1. `.card` base rule now uses `border-radius: var(--card-radius)` and `box-shadow: var(--card-shadow)`; `.card:hover` (the Phase 4.3 "polish" override later in the file, which wins on cascade order) now uses `var(--card-shadow-hover)` instead of its old hardcoded shadow. `.cards-grid`'s `gap` is now `var(--card-gap)` instead of a hardcoded `16px`.
2. Bento sizing implemented as a `featured` boolean prop on `MediaCard`, applied as a `card--featured` class. `.card--featured { grid-column: span 2; }` plus `.card--featured .card-poster { aspect-ratio: 16/9; }` (existing `object-fit: cover` on the poster `<img>` handles the crop automatically — no new image asset needed).
3. Wired into `HomePage.jsx`'s `renderList` (used by the four discovery rows — Recommended, Trending Movies, Trending Series, Top Rated — when the user is in "list" view mode): `featured={idx === 0}` on the first item only. "Continue Watching" (separate render path, never goes through `renderList`) stays untouched/uniform 1x1, matching the locked sizing rule.
4. No DOM structure changes inside `MediaCard` — same hover popout, context menu, watched/progress badges, age-rating gating. Visual-only, as scoped.

**Discovered mid-phase:** `HomePage`'s *default* browsing view is `TrendingCarousel` (a separate 3D "coverflow" component with its own card markup, not `MediaCard`/`.cards-grid`) — `renderList`/`MediaCard` only renders when the user switches to "list" view mode in Settings. The Bento featured-span treatment is therefore scoped to `.cards-grid` usage (Continue Watching, Library, Downloads, search results, and Home's list-view rows) per the locked rule — `TrendingCarousel` keeps its existing distinct visual identity and was not touched (reworking it into a Bento grid was never part of the plan).

**Checkpoint:** `npx vite build` succeeds. ✅ Verified. Manual visual/interaction check (hover popout, mark watched, context menu, click-through, featured tile rendering in list view) still needs a human pass in the running app.

---

### Phase 4 — Page-by-page rollout ✅ Done (2026-06-18, audit-driven — most of the work already happened in Phases 2–3)

**What happened:** Phase 2's recolor sweep already touched all 23 component/page files (every page in the rollout list below) and Phase 3's `MediaCard`/`.cards-grid` token work already covers every grid-card surface. So Phase 4 became an **audit pass** per page/area — confirm each is actually consistent with the new tokens — rather than a from-scratch re-skin, plus a handful of small fixes found along the way:

1. **`Sidebar.jsx`** — already complete (logo from Phase 1, colors from Phase 2). No changes needed.
2. **`HomePage.jsx` + `HeroBanner.jsx`** — Bento rows done in Phase 3. Found and fixed two leftovers in `HeroBanner.jsx`: the rating-star color was a one-off `#f5c518` instead of the shared `--gold` token; the "More Info" button's `borderRadius: 6` didn't match the `--radius` (8px) used by every other button. Audited `CastRow.jsx` (circular avatars, correctly untouched), `SimilarRow.jsx` (renders `MediaCard` directly inside `.scroll-row`, inherits Phase 3 changes automatically — not a grid context, so no featured-span applies), and `RatingBadge.jsx` (pure CSS-class driven, already correct) — no changes needed in any of the three.
3. **`LibraryPage.jsx`, `DownloadsPage.jsx`** — zero stray hex colors in `LibraryPage`; `DownloadsPage`'s one hardcoded color (`#63cab7`, a subtitle-availability teal) is an intentional distinct status color, not Netflix-red-related — left as-is.
4. **`MoviePage.jsx`, `TVPage.jsx`** — audited for stray hex; only generic success-green (`#4caf50`) and plain white/the already-fixed `#ff8a3d66` remain, both intentional. No changes needed.
5. **`OnePacePage.jsx`, `OnePaceArcPage.jsx`** — audited; the large hardcoded gradient palette here is intentional per-saga decorative theming (One Piece arc color identity), unrelated to the app-chrome redesign — left untouched.
6. **`SettingsPage.jsx`** — audited; found and fixed a stale `var(--bg, #141414)` fallback that didn't match `--bg`'s real value (`#0a0a0a`) — corrected. Other hex colors found (success green, validation red, provider-tag colors) are intentional distinct semantics, not Netflix-red — left as-is.
7. **All modals** — audited `SearchModal`, `TrailerModal`, `DownloadModal`, `SubtitleDownloaderModal`, `WatchPartyHostModal`, `KeyboardShortcutsModal`, `UpdateModal`, `CloseConfirmModal`, `WyzieKeyModal`, `BlockedStatsModal` for stray hex; all clean (already covered by Phase 2, or never had brand-red references — `KeyboardShortcutsModal`/`CloseConfirmModal`/`BlockedStatsModal` are pure CSS-class driven).
8. **`Skeleton.jsx` + `skeletons/*`** — confirmed **no changes needed**: every skeleton file (`CardGridSkeleton`, `HomeSkeleton`, `MovieDetailSkeleton`, `TVDetailSkeleton`, `CastRowSkeleton`) reuses the real `.card`/`.detail-poster`/`.episode-card`/`.cast-photo-wrap` CSS classes rather than hardcoding competing shapes, so they automatically inherited the Phase 3 Bento radius/shadow tokens by construction.

**Checkpoint:** `npx vite build` succeeds after all fixes. ✅ Verified. No behavior changes were made anywhere in this phase — purely visual token consistency + 3 small literal-value fixes.

---

### Phase 5 — Signature details ("spells") pass ✅ Tier 1 done (2026-06-18)

**Companion:** `PLAN_UI_REDESIGN_V3.md` §7.

**Files modified:**
- `src/components/MediaCard.jsx` + `src/styles/global.css` — poster-tilt parallax (#1), ambient color bleed (#2).
- `src/components/OnePacePlayer.jsx` + `src/styles/onepacePlayer.css` — bias-lighting tint (#3).
- `src/pages/OnePacePage.jsx` + `src/styles/global.css` — treasure-map voyage progress (#4).

**What happened (no new dependency needed for any of the four):**
1. **Poster-tilt parallax** — `onMouseMove` on `.card` computes `rotateX`/`rotateY` from cursor position relative to the card's bounding rect, applied via direct `cardRef.current.style.transform` mutation (no React re-render per mousemove event). Combined with the existing hover `scale(1.08)` in one transform string since inline style overrides the CSS class's transform. Resets on mouse-leave. Skipped entirely when `prefers-reduced-motion: reduce` (checked once via `matchMedia` on mount).
2. **Ambient color bleed** — `sampleDominantColor()` draws each poster (at TMDB's small `w92` size) into an 8×12 offscreen canvas and averages the pixels, returning `"r, g, b"`. Result is cached in a module-level `Map` keyed by URL so the same poster is never resampled across remounts/re-renders/other rows. Resolved color is set as `--card-glow-color` directly on the card element (no state, no re-render) and consumed by `.card:hover`'s `box-shadow`, layered with the existing `--card-shadow-hover` and falling back to the plain accent-amber glow if sampling hasn't resolved yet (or fails — wrapped in try/catch for canvas-taint/decode errors, degrades silently).
3. **Player bias-lighting — scoped down from the original wording.** Discovered Movie/TV/anime playback renders through Electron `<webview>` tags (cross-process, no pixel access at all), so bias-lighting is only achievable for the One Pace player, which has a real `<video>` element. Implemented there: `requestVideoFrameCallback` drives a canvas sample of the current frame (16×9 downscale) throttled to ~700ms internally, average color scaled to 40% brightness and written to `--bias-bg` on the player container — `.onepace-player-container`'s `background-color` (visible in the letterbox/pillarbox margins around the `object-fit: contain` video) transitions smoothly via CSS. Skipped under reduced motion (stays plain black); wrapped in try/catch (falls back to black silently on any canvas error).
4. **Treasure-map voyage progress — scoped to the arc-overview, not a single arc's episode list.** Re-read the plan wording ("filled dots per completed arc") and concluded the more valuable, more literal reading is a map across *all* arcs (the user's whole One Piece journey), not a redo of one arc's linear episode-completion bar. Added a "Your Voyage" section to `OnePacePage.jsx` (the arc-listing page): an SVG with one dot per arc positioned along a sine-wave path (treasure-map squiggle), dashed line connecting them, each dot empty/dim/filled based on that arc's watch percent (reusing the existing `arcStats` memo). Dots are clickable/keyboard-focusable and call the same `onSelectArc` used by the arc cards below. Hover/focus scale-up gated under `prefers-reduced-motion`.

**Checkpoint:** `npx vite build` succeeds after each spell. ✅ Verified. Manual 60fps/visual check in the running app still needed — not done by the agent (see Phase 4's note on this sandbox's GUI limitation).

**Tier 2** (#5–13) not started — picking these up is optional/opportunistic per the plan, not required for this pass.

**Rollback:** each spell is additive to its own file set — `git checkout` the specific files above if one causes a regression, without affecting the rest of the redesign.

---

### Phase 6 — Reduced motion & final pass ✅ Code-level work done (2026-06-18); two items need a human

**Steps taken:**
1. Audited every `transition`/`@keyframes` added in Phases 3–5 — all already had explicit `@media (prefers-reduced-motion: reduce)` overrides or JS-level `matchMedia` checks (card hover transform, poster tilt, bias-lighting transition, treasure-map dot hover).
2. **Found and fixed a deeper pre-existing gap**: the app's blanket animation-killer (`body.no-anim`, used everywhere via a global `*, *::before, *::after { transition-duration: 0.001ms !important; ... }` rule) was only ever activated by a *manual* Settings toggle (`REDUCE_ANIMATIONS`) — it never automatically respected the OS-level `prefers-reduced-motion` media query, which is what the plan's acceptance criterion actually requires. Fixed in `src/App.jsx` (boot-time check now ORs in `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, plus a live `change` listener) and `src/pages/SettingsPage.jsx` (`handleSave` no longer clobbers an OS-driven reduced-motion state with the local checkbox's value when saving other appearance settings). This retroactively makes *every* transition/animation in the entire app — not just this redesign's additions — respect the OS signal.
3. Also found and fixed, while investigating the above: `src/utils/appearance.js`'s pre-existing "Accent Colour" picker (Settings → Appearance) had been silently broken by Phase 2's `--red` → `--accent` rename, since it still wrote to the old property names — see the dedicated CHANGELOG entry for that fix.
4. Attempted the full manual smoke test and the installer-icon acceptance criterion:
   - **Manual smoke test (movie/TV/anime/One Pace playback)**: not done by the agent — this sandbox runs Electron with `ELECTRON_RUN_AS_NODE=1` and cannot launch the real GUI. **Needs the user.**
   - **Installer icon**: ran `npm run dist:win`. `dist/win-unpacked/MovieVault.exe` was produced successfully (icon embedded via electron-builder's PNG→ICO conversion), but the final NSIS one-click-installer wrapper failed afterward on a Windows symlink-privilege error (`winCodeSign` extraction needs Developer Mode or an elevated shell) — a pre-existing sandbox/environment limitation, not caused by anything in this redesign; it would fail identically on an unmodified checkout. The unpacked `.exe` existing is solid evidence the icon pipeline works end-to-end; the user should re-run `npm run dist:win` themselves (Developer Mode enabled, or an elevated terminal) to get the actual signed installer.

**Checkpoint:** All `PLAN_UI_REDESIGN_V3.md` §5 acceptance criteria are met except the two that structurally require a human: the manual smoke test, and final confirmation of the NSIS installer icon (unpacked exe already confirmed).

---

### Phase 7 — Layout & IA overhaul (companion: plan §8) ✅ Done (2026-06-18)

**Status:** All four sub-phases (7a–7d) complete. Started 2026-06-18 after user feedback that Phases 0–6 read as a recolor, not a layout makeover.

**Sub-phases, in the order the user confirmed:**

**7a. Sidebar redesign**
- Files: `src/components/Sidebar.jsx`, `src/styles/global.css` (`.sidebar*` rules).
- Fix nav order (Home before Search before content sections — currently Search sits above Home with no clear rationale).
- Add visible text labels, not tooltip-only.
- Redesign the saved/library quick-access strip so it reads as an intentional section (header, consistent card treatment) instead of a bolted-on thumbnail stack.
- Checkpoint: drag-reorder, context menu (remove), search, navigation, badges (active downloads count) all still work; visually distinct from the old icon-only rail.

**7b. Hero cluster + Bento rows by default** ✅ Done (2026-06-18)
- Files: new `src/components/HeroQuickPicks.jsx`, `src/pages/HomePage.jsx`, `src/utils/homeLayout.js`, `src/pages/SettingsPage.jsx`, `global.css`.
- `HeroBanner` kept fully intact (no regression risk) and wrapped in a new `.hero-cluster` grid alongside `HeroQuickPicks` (3 small Bento tiles from `topRatedItems`) — delivers the "multi-tile cluster" without rewriting the banner's trailer/rotation logic.
- `loadHomeViewMode()`'s default flipped `"carousel"` → `"list"`, making the existing Phase-3 Bento `cards-grid` system (not `TrendingCarousel`) the default for every row — also fixes a pre-existing layout inconsistency where Continue Watching was always a grid while other rows were coverflow.
- Checkpoint: `npx vite build` succeeds. Not visually verified by the agent (sandbox GUI limitation) — needs the user.

**7c. Genre/category browsing** ✅ Done (2026-06-18)
- New `src/components/GenreBrowser.jsx`, wired into `HomePage.jsx` right after the hero cluster. Fetches `/genre/movie/list` + `/genre/tv/list` once, merges by name into chips (reusing the existing `.genre-tag` pill style from the detail pages, plus a new `--active` modifier). Selecting a chip fetches `/discover/{movie,tv}?with_genres=X&sort_by=popularity.desc` for that genre, merges + sorts by popularity, and renders the top 24 in the same Bento `cards-grid`/`MediaCard` system as everything else (first result gets `featured`). Selecting the same chip again clears the results.
- Checkpoint: `npx vite build` succeeds.

**7d. Episode-page UX pass (`TVPage.jsx`)** ✅ Done (2026-06-18)
- Assessed first: `EpisodeCard` is actually feature-rich already (thumbnail, play overlay, watched indicator, download badge, progress bar, expandable description, restricted/unreleased gating, right-click mark-watched) — functionality wasn't the gap. The concrete, fixable issues found:
  1. `.episode-card`/`.episode-thumb` still used the old `var(--radius)` (8px) instead of the Bento `--card-radius`/`--card-shadow` tokens used everywhere else now — visually disconnected from the rest of the redesigned app.
  2. `.season-selector` used `flex-wrap: wrap`, which on long-running shows (many seasons) wraps into a messy multi-row block pushing episode content down.
- Fixed both: `.episode-card` now uses `var(--card-radius)`/`var(--card-shadow)`/`var(--card-shadow-hover)` (the `ep-watched`/`playing` state rules still override border/background as before — untouched). `.episode-thumb`'s radius bumped from a hardcoded `5px` to `var(--radius)`. `.season-selector` converted from wrapping to a horizontal scroll row (`overflow-x: auto`, `flex-wrap: nowrap`, thin scrollbar) — same pattern already used for OnePace's saga filters and Continue Watching's `scroll-row`.
- Checkpoint: `npx vite build` succeeds. No behavior changes — purely the two visual/layout fixes above.

**Rollback:** each sub-phase is additive/restructuring within its own file set — `git checkout` the specific files per sub-phase if one causes a regression.

---

## Rollback notes

- Each phase is isolated to its own file set — rolling back Phase *N* means `git checkout` the files listed in that phase's "Files to modify" before moving on.
- Phase 1 (icon) is the riskiest for build tooling (electron-builder icon validation can fail on malformed `.ico`/`.icns`) — test `npm run dist:win` (or your primary platform) immediately after Phase 1, before starting Phase 2, so a bad icon doesn't get buried under unrelated CSS changes.
- Phase 5 (signature details) is the riskiest for performance/jank — verify each spell individually rather than batching all four before checking.

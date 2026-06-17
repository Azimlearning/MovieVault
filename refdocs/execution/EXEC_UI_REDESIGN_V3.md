# Execution Plan — UI Redesign V3 (Electron app)

## Companion plan
[PLAN_UI_REDESIGN_V3.md](../plans/PLAN_UI_REDESIGN_V3.md)

## Status at authoring
Nothing implemented yet. `IMPROVEMENT_PLAN_V2.md` / `V2_EXECUTION_PLAN.md` are fully shipped (P4+P5+P6 all done per `CLAUDE.md`) and are not touched by this work. This is Phase 0 of a brand-new initiative.

---

## Phases

### Phase 0 — Lock the design system

**Files to create/modify:** none in `src/` yet. Output is a decision, recorded back into `PLAN_UI_REDESIGN_V3.md` §4/§6.

**Steps:**
1. Resolve open question #1 (exact hex values) — build a tiny static HTML swatch (colors + Bebas Neue/DM Sans headings on the new background) to gut-check contrast and mood before writing any component code.
2. Resolve open question #3 (Bento sizing rule) — write the concrete rule (e.g. "first item in Trending row spans 2x1, everything else 1x1, Continue Watching row stays uniform 1x1") into the plan doc.
3. Resolve open question #2 (icon production method) — pick one: (a) script using `sharp` (new devDependency) to rasterize an SVG master at all required sizes, (b) an image-generation skill/tool to produce raster art directly, (c) manual export. Record the choice.

**Checkpoint:** `PLAN_UI_REDESIGN_V3.md` §4 has concrete hex values and a sizing rule; §6 question 1–3 are marked resolved with the decision inline.

---

### Phase 1 — New app icon & brand mark

**Files to create/modify:**
- New master icon asset (location TBD by Phase 0 decision — likely `public/brand/icon-master.svg` or similar).
- New sized PNG set replacing `public/sized/*` (same filenames/sizes: 16/32/48/64/128/256/512).
- `public/icon.png` replaced with a new master PNG (or `.icns`/`.ico` per electron-builder needs).
- `index.js:222` — update the `path.join(__dirname, "public/sized/256x256.png")` reference if the new asset lives at a different path.
- `package.json` — `build.win.icon`, `build.mac.icon`, `build.linux.icon` (currently `public/icon.png`, `public/icon.png`, `public/sized`).
- `public/logo.svg` removed; `src/components/Icons.jsx`'s `StreambertLogo` renamed (e.g. `AppLogo`) and pointed at the new asset; update its one call site in `src/components/Sidebar.jsx`.

**Steps:**
1. Design the new mark in the existing `Icons.jsx` SVG line-art language (stroke-based, `viewBox="0 0 24 24"`).
2. Generate the raster set per the Phase 0 method.
3. Delete `public/sized/*.png` and `public/icon.png`; add the new files.
4. Update `index.js` and `package.json` icon paths.
5. Update `Sidebar.jsx`'s logo usage and rename `StreambertLogo`.

**Checkpoint:**
- `npm run start` → taskbar/window icon shows the new mark, not the old one.
- `npm run dist:win` (or whichever platform is available to test) → installer icon is the new mark.
- `grep -r "public/sized\|StreambertLogo\|Streambert" src/ index.js package.json` returns nothing.

**Rollback:** `git checkout -- public/icon.png public/sized public/logo.svg index.js package.json src/components/Icons.jsx src/components/Sidebar.jsx` restores the old icon set if the new one breaks a build target.

---

### Phase 2 — Design tokens (`global.css`)

**Files to modify:** `src/styles/global.css`.

**Steps:**
1. Replace the `:root` color tokens (`--bg`, `--surface`, `--surface2`, `--surface3`, `--border`, `--red`, `--red2`, `--red-dim`, `--red-glow`, `--gold`, `--text`, `--text2`, `--text3`) with the new palette locked in Phase 0. Keep the same variable *names* where the role matches (e.g. `--bg`, `--surface`) so downstream component CSS doesn't need a second pass just for renames — only the values change, plus any new tokens Bento cards need (e.g. `--card-radius`, `--card-shadow`).
2. Add Bento-specific tokens: `--card-radius` (16–24px per plan), `--card-shadow`, `--card-shadow-hover`, `--card-gap`.
3. Leave `--font-display`/`--font-body` untouched per the plan's typography decision.

**Checkpoint:** `grep -rn "#e50914\|#ff1a24\|--red" src/` returns nothing outside of this file's own removed lines (i.e. the literal Netflix red is gone repo-wide).

---

### Phase 3 — Bento card component (`MediaCard`)

**Files to modify:** `src/components/MediaCard.jsx` and its CSS (in `global.css` or a co-located stylesheet — match existing convention).

**Steps:**
1. Apply the new card visual treatment: rounded corners via `--card-radius`, layered shadow via `--card-shadow`/`--card-shadow-hover` on hover, updated hover scale/transition using existing plain-CSS transition patterns (no new dependency).
2. Implement the Bento sizing rule from Phase 0 as a prop or data attribute (e.g. `size="featured" | "default"`) consumed by whichever row renders the grid.
3. Keep all existing behavior intact: hover popout, context menu, watched/progress badges, age-rating gating — this phase is visual only.

**Checkpoint:** Existing card interactions (hover popout, mark watched, context menu, click-through) still work; visually the card now matches the new design tokens.

---

### Phase 4 — Page-by-page rollout

Apply the new tokens/components to each page, in this order (cheapest/most-shared first so later pages inherit finished pieces):

1. `Sidebar.jsx` — new logo, new token colors.
2. `HomePage.jsx` + `HeroBanner.jsx` — hero re-skin, Bento rows.
3. `LibraryPage.jsx`, `DownloadsPage.jsx` — straightforward grid re-skins, low risk, good early validation.
4. `MoviePage.jsx`, `TVPage.jsx` + `CastRow.jsx`, `SimilarRow.jsx`, `RatingBadge.jsx` — detail page re-skin.
5. `OnePacePage.jsx`, `OnePaceArcPage.jsx` — arc/episode grids.
6. `SettingsPage.jsx` — lowest visual priority, last.
7. All modals (`SearchModal`, `TrailerModal`, `DownloadModal`, `SubtitleDownloaderModal`, `WatchPartyHostModal`, `KeyboardShortcutsModal`, `UpdateModal`, `CloseConfirmModal`, `WyzieKeyModal`, `BlockedStatsModal`) — re-skin chrome (background, borders, buttons) to new tokens; no behavior changes.
8. `Skeleton.jsx` + `skeletons/*` — match new card shapes/radii so loading states don't regress to the old look.

**Checkpoint per page:** visually re-skinned, no console errors, no behavior regression (click-through, keyboard shortcuts, watch progress still work).

---

### Phase 5 — Signature details ("spells") pass

**Companion:** `PLAN_UI_REDESIGN_V3.md` §7.

**Files to create/modify (Tier 1):**
- `src/components/MediaCard.jsx` (+ its CSS) — poster-tilt parallax (#1), ambient color bleed (#2).
- The movie/TV/anime player chrome component(s) — bias-lighting tint (#3).
- `src/pages/OnePaceArcPage.jsx` — treasure-map arc progress (#4).

**Steps:**
1. Implement the four Tier 1 spells one at a time. After each: check 60fps in DevTools' performance panel, confirm no layout shift, and confirm it collapses to a static state under `prefers-reduced-motion: reduce`.
2. If a spell needs a new dependency (e.g. a small color-quantization lib instead of hand-rolled canvas sampling), add it here and log it in the CHANGELOG with the reasoning — pre-approved per plan §3/§7.
3. Once Tier 1 feels right in practice, pick up Tier 2 items (#5–13) opportunistically — they're independent of each other and of Tier 1, so order doesn't matter. Not required for v1 ship.

**Checkpoint:** All four Tier 1 spells are visible and functioning on their target pages; no console errors; each one is verified against `prefers-reduced-motion` individually (full repo-wide audit still happens in Phase 6).

**Rollback:** each spell is additive to an existing component — `git checkout` the specific file(s) listed above if a spell causes a regression, without affecting the rest of the redesign.

---

### Phase 6 — Reduced motion & final pass

**Steps:**
1. Audit every new `transition`/`@keyframes` added in Phases 3–5 and ensure a `@media (prefers-reduced-motion: reduce)` override exists (likely one consolidated block at the bottom of `global.css`, matching the acceptance criterion in the plan).
2. Full manual smoke test: launch app, play one movie + one TV episode + one anime episode + one One Pace episode (per plan §5 acceptance criteria).
3. Write the `refdocs/changelog/CHANGELOG.md` entry for the whole initiative (or per-session entries if it spans multiple sessions — per `CLAUDE.md` mandatory rule).

**Checkpoint:** All acceptance criteria in `PLAN_UI_REDESIGN_V3.md` §5 are checked.

---

## Rollback notes

- Each phase is isolated to its own file set — rolling back Phase *N* means `git checkout` the files listed in that phase's "Files to modify" before moving on.
- Phase 1 (icon) is the riskiest for build tooling (electron-builder icon validation can fail on malformed `.ico`/`.icns`) — test `npm run dist:win` (or your primary platform) immediately after Phase 1, before starting Phase 2, so a bad icon doesn't get buried under unrelated CSS changes.
- Phase 5 (signature details) is the riskiest for performance/jank — verify each spell individually rather than batching all four before checking.

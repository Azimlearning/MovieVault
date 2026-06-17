# Plan — UI Redesign V3 (Electron app)

> **Status:** Draft v1.
> **Scope:** Full visual redesign of the Electron desktop app (`src/`). Standalone initiative — `IMPROVEMENT_PLAN_V2.md` (P4 UX Polish, P5 One Pace, P6 Watch Party) is fully shipped and untouched by this plan.
> **Audience:** You (solo dev) and any AI coding assistant executing this plan.

---

## 1. Goal

MovieVault's Electron app currently uses a literal Netflix palette (`--red: #e50914` on near-black) with a conventional dense-row layout. This plan replaces that with an original visual identity: a new color palette (not red/black), a Bento-style modular card grid (varied card sizes, rounded corners, soft depth) for content browsing, and a new app icon designed in the same line-art SVG language already used by `src/components/Icons.jsx` (`FilmIcon`, `PlayIcon`, etc.).

It also retires three stale assets:
- `public/icon.png` (win/mac build icon)
- `public/sized/{16,32,48,64,128,256,512}x512.png` (window icon + linux build icon)
- `public/logo.svg` — a raster image embedded in an SVG wrapper, depicting a leftover "Streambert" brand name from before the app was renamed MovieVault

Why now: the app's content (One Pace, Watch Party, rich detail pages) is feature-complete per V2. The visual layer is the one piece still wearing someone else's (Netflix's) clothes, including a vestigial logo from an even earlier rename.

---

## 2. Scope

**In scope (Electron app, `src/` only):**
- `src/styles/global.css` — full token rewrite (colors, radii, shadows). Typography (Bebas Neue + DM Sans) stays unless §6 open question resolves otherwise.
- All page components: `HomePage`, `MoviePage`, `TVPage`, `LibraryPage`, `DownloadsPage`, `OnePacePage`, `OnePaceArcPage`, `SettingsPage`.
- Shared UI: `Sidebar`, `MediaCard` (→ Bento card treatment), `HeroBanner`, `CastRow`, `SimilarRow`, `RatingBadge`, `Skeleton`/`skeletons/*`, all modals (`SearchModal`, `TrailerModal`, `DownloadModal`, `SubtitleDownloaderModal`, `WatchPartyHostModal`, `KeyboardShortcutsModal`, `UpdateModal`, `CloseConfirmModal`, `WyzieKeyModal`, `BlockedStatsModal`).
- New app icon: a master vector design + generated raster set, replacing `public/icon.png` and every file in `public/sized/`. Wired into `index.js:222` (window icon) and `package.json` (`build.win.icon`, `build.mac.icon`, `build.linux.icon`).
- Retiring `public/logo.svg` and `StreambertLogo` (rename the component / replace with the new mark, used in `Sidebar`'s `sidebar-logo`).

**Explicitly out of scope:**
- `apps/web/src/` and `apps/party-guest/` — the web port is a separate codebase per `CLAUDE.md`; redesigning it is a follow-up plan once the Electron design system is locked and validated.
- IPC/backend logic, OnePace player internals (subtitle rendering, resolution fallback), Watch Party sync protocol — these get re-themed (chrome/colors/spacing) but not re-architected.
- New dependencies are only acceptable when a specific item in §7 (Signature details) genuinely needs one — there is no blanket ban, but no open-ended dependency shopping either. See §3 Constraints.

---

## 3. Constraints

- **Solo dev, evenings/weekends.** Effort scale carried over from V2: **S** (≤1 evening), **M** (1–3 evenings), **L** (a weekend), **XL** (multiple weekends).
- **No Tailwind, no framer-motion by default.** Despite `IMPROVEMENT_PLAN_V2.md` §4.3 assuming framer-motion was already a dependency, it is **not** in `package.json` and is not used anywhere in `src/`. The current codebase uses hand-written CSS with custom properties (`:root` tokens in `global.css`) and no CSS framework. Default to that pattern — vanilla CSS/Canvas/JS first. **Exception:** the user has explicitly approved adding a small, targeted dependency if a specific feature in §7 (Signature details) genuinely needs one — don't hand-roll something nontrivial (e.g. robust dominant-color extraction) just to avoid an install. Any dependency added for this reason gets logged in the CHANGELOG with the why.
- **No router.** Navigation in `App.jsx` is custom state-based (no `react-router`). Page-transition work must use plain CSS transitions keyed off that existing state, not router-based patterns.
- **Icon generation tooling.** Producing the new `.ico`/`.icns`/PNG set from a master design requires either an image-generation tool/skill or a manual export step — flagged in the execution plan as its own phase with a checkpoint, since it's the one piece of this redesign that isn't pure code.
- **Two codebases don't share UI code.** Nothing in this plan touches `apps/web/src/`.

---

## 4. Design direction (locked decisions)

| Decision | Choice |
|---|---|
| Color palette | **New palette**, moving away from the literal red/black Netflix look. Candidate: deep indigo/violet primary surfaces with a warm amber/gold CTA accent (premium, cinematic, distinct from any existing streamer's brand color) — see `refdocs/plans/README.md`-adjacent design-system notes from `ui-ux-pro-max` skill search. Final hex values to be locked in Phase 0 of execution. |
| Layout pattern | **Bento-style modular cards** — varied card sizes/spans, rounded corners (16–24px), soft layered shadows, generous gaps — replacing today's uniform dense grid. |
| Content density inspiration | **Netflix-style density and hero banner concept** are kept as structural inspiration (full-width hero, horizontal rows for "Continue Watching" / "Trending" / "More like this") even though the color identity changes. |
| Typography | Keep Bebas Neue (display) + DM Sans (body) — already self-hosted as `.woff2`, no churn. Revisit only if the new palette doesn't read well with all-caps condensed display type. |
| App icon | New mark drawn in the same flat line-art SVG style as `Icons.jsx` (not a monogram, not user-supplied) — likely a stylized play-button/film-frame combination consistent with `FilmIcon`/`PlayIcon`. |
| Animation | Plain CSS transitions/keyframes by default, respecting `prefers-reduced-motion`. A small dependency is allowed if a specific §7 signature detail needs one. |

---

## 5. Acceptance criteria

- [ ] `global.css` tokens fully replaced — zero remaining references to `#e50914`/`--red` literal Netflix red anywhere in `src/`.
- [ ] Every page in scope (§2) renders using the new Bento card components with no layout-shift regressions vs. today's data-loading behavior (skeletons still shape-match).
- [ ] `public/icon.png` and `public/sized/*` are deleted from the repo; `index.js` and `package.json` reference the new icon source exclusively. `npm run start` shows the new icon in the taskbar; at least one `npm run dist:*` target builds with the new installer icon.
- [ ] `public/logo.svg` and the `StreambertLogo` component are removed or renamed; the sidebar logo renders the new mark.
- [ ] `prefers-reduced-motion: reduce` removes all new hover/transition motion, leaving static states.
- [ ] App still launches and plays one movie + one TV episode + one anime episode + one One Pace episode without manual intervention (carried over from V2 §8 definition of done).
- [ ] Tier 1 signature details from §7 (poster-tilt parallax, ambient color bleed, player bias-lighting, One Pace treasure-map arc progress) are implemented, run at 60fps, cause no layout shift, and collapse to a static state under `prefers-reduced-motion: reduce`.
- [ ] A changelog entry exists per `CLAUDE.md` for each session that touches this plan.

---

## 6. Open questions

1. **Exact palette hex values.** A candidate (indigo/violet + amber) is proposed in §4 but not locked — needs a quick visual gut-check (e.g. a static HTML swatch/mockup) before touching `global.css` everywhere.
2. **Icon production method.** Hand-drawn SVG → exported to PNG set via what tool? (sharp/electron-icon-builder script vs. an image-gen skill vs. manual export in a vector editor.) Decide in execution Phase 0.
3. **Bento card sizing rules.** Bento implies *varied* card sizes — need a concrete rule for which rows/cards get the larger spans (e.g. featured/highly-rated titles get 2x size, everything else 1x) so it doesn't look random.
4. **Web app follow-up.** Confirm (not now, but on record) that `apps/web/src/` redesign is a separate future plan once this one ships, per `CLAUDE.md`'s two-codebase split.

---

## 7. Signature details ("spells")

> Sourced from a `design-spells` pass on 2026-06-17. These are the details that make MovieVault feel hand-crafted rather than a generic streamer clone — layered on top of the palette/Bento/icon work in §4, not a replacement for it. User has approved all of these for the plan ("i like these").

**Dependency policy:** default to vanilla CSS/Canvas/JS, matching §3. A small, targeted dependency is approved if a specific spell below genuinely needs one — don't hand-roll something nontrivial (e.g. robust dominant-color extraction) just to dodge an install. Any dependency added this way gets logged in the CHANGELOG with the reasoning.

### Tier 1 — build first (highest leverage, touches the most-used surfaces)
1. **Poster-tilt parallax** (`MediaCard`) — card tilts toward the cursor on hover (`perspective`/`rotateX`/`rotateY` driven by mouse position), poster pans slightly opposite. Transform/opacity only — GPU-accelerated, no layout impact.
2. **Ambient color bleed** (`MediaCard`) — sample each poster's dominant color once (canvas `getImageData`, cached alongside the existing image cache) and use it for a soft hover glow instead of a generic shadow.
3. **Player bias-lighting** (player chrome) — sample the `<video>` element's current frame color in real time (`requestVideoFrameCallback` + canvas) and tint the app background around the player. A poor man's Ambilight.
4. **One Pace treasure-map arc progress** (`OnePaceArcPage`) — replace the linear arc-completion bar with a dotted/curved path motif (SVG path + filled dots per completed arc). Leans into the one piece of content that's genuinely unique to this app.

### Tier 2 — stretch (pick up opportunistically once Tier 1 ships and feels right)
5. Spine-stack progress bar for Continue Watching cards — progress rendered as a bottom-edge "disc spine" fill instead of an overlay bar.
6. Hero idle parallax drift — 2–3px slow drift loop on the backdrop image, paused under reduced-motion.
7. Hero title "projector flicker" reveal — single-frame brightness flicker on title fade-in.
8. Scrubber thumbnail trail on the player seek bar — canvas frame-grab straight from the `<video>` element, no extra network fetch.
9. Straw-hat watching indicator in the sidebar when a One Pace episode is active (reuses the existing `StrawHatIcon`).
10. Watch Party synchronized "3...2...1" countdown overlay before a session's title starts, shown to host + all guests at once.
11. Watch Party reaction physics — emoji float with randomized rotation/drift instead of identical stacked sprites.
12. `BlockedStatsModal` copy pass — deadpan/funny stats copy instead of generic parental-control tone (content-only change, no new pattern).
13. Film-reel-style loader (built from the existing `FilmIcon` SVG language) replacing the generic spinner on initial load.

---

*End of plan v1.*

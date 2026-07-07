# Plan — UI Redesign V3 (Electron app)

> **Status:** Phases 0–6 shipped (2026-06-18). Tier 1 signature details (§7) done; Tier 2 (#5–13) optional/unstarted. Two acceptance criteria need human verification: full manual smoke test, and final NSIS installer confirmation (unpacked exe already confirmed) — see `EXEC_UI_REDESIGN_V3.md` Phase 6.
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
| Color palette | **Locked (Phase 0, 2026-06-17).** Surfaces stay near-black, unchanged from today's app — the user confirmed the near-black mood itself was never the "Netflix" problem, only the red accent was. Only the accent and one new secondary token change: `--bg: #0a0a0a`, `--surface: #111111`, `--surface2: #1a1a1a`, `--surface3: #222222`, `--border: #2a2a2a` (all unchanged from current `global.css`). `--red`/`--red2`/`--red-dim`/`--red-glow` are renamed and recolored to `--accent: #FF8A3D` / `--accent2: #FFAA66` / `--accent-dim: rgba(255,138,61,0.15)` / `--accent-glow: 0 0 30px rgba(255,138,61,0.35)` (warm amber, used for CTAs/play buttons/active states). New secondary accent `--violet: #7C6FE0` for sparing use (Watch Party badge, focus rings, links) — not a primary surface color. `--gold: #c8a84b` (existing, currently unused) is kept reserved for star-rating display only, so it doesn't visually collide with the new amber CTA. `--text`/`--text2`/`--text3` unchanged. See `refdocs/plans/v3-palette-swatch.html` for the visual gut-check (throwaway file, safe to delete once Phase 2 ships these into `global.css`). |
| Layout pattern | **Bento-style modular cards** — varied card sizes/spans, rounded corners (16–24px), soft layered shadows, generous gaps — replacing today's uniform dense grid. **Sizing rule (locked, Phase 0):** in discovery rows (Trending, Popular, Recommended, genre rows), the first item only renders as a 2x1 featured span; every other item in that row is standard 1x1. Utility/functional rows — Continue Watching, Library, Downloads, search results, season/episode grids — always stay uniform 1x1, since those are scanned for completeness, not discovery, and varied sizing would hurt scannability there. |
| Content density inspiration | **Netflix-style density and hero banner concept** are kept as structural inspiration (full-width hero, horizontal rows for "Continue Watching" / "Trending" / "More like this") even though the color identity changes. |
| Typography | Keep Bebas Neue (display) + DM Sans (body) — already self-hosted as `.woff2`, no churn. Revisit only if the new palette doesn't read well with all-caps condensed display type. |
| App icon | New mark drawn in the same flat line-art SVG style as `Icons.jsx` (not a monogram, not user-supplied) — likely a stylized play-button/film-frame combination consistent with `FilmIcon`/`PlayIcon`. **Production method (locked, Phase 0):** hand-author a single master SVG (`public/brand/icon-master.svg`) in that same stroke-based path language — not raster image-gen, since the goal is a vector that matches the existing icon set's path style exactly, which image generation can't guarantee. Add `sharp` as a devDependency (approved per §3/§7's relaxed dependency policy — there's no dependency-free reliable way to rasterize SVG→PNG at fixed sizes) and a small one-off script (e.g. `scripts/build-icons.mjs`) that exports: (a) a 1024×1024 PNG as electron-builder's single icon source — it auto-generates the Windows `.ico` / macOS `.icns` / Linux icon set from that one master at build time, so the full `public/sized/*` ladder of 7 hand-maintained sizes is **not** recreated; (b) a 256×256 PNG specifically for `index.js`'s runtime `BrowserWindow` icon. Manual export is the fallback only if `sharp`'s native binary fails to install on this machine. |
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

1. ~~**Exact palette hex values.**~~ **Resolved 2026-06-17** — see §4 Color palette row. Gut-checked via `refdocs/plans/v3-palette-swatch.html`; user's call was to keep the near-black surfaces unchanged and only swap the accent off red onto amber, rather than re-tinting the surfaces indigo/violet as first proposed.
2. ~~**Icon production method.**~~ **Resolved 2026-06-17** — see §4 App icon row. Hand-authored master SVG + `sharp` devDependency + a small rasterization script; electron-builder auto-generates per-platform formats from one 1024×1024 master.
3. ~~**Bento card sizing rules.**~~ **Resolved 2026-06-17** — see §4 Layout pattern row. First item in discovery rows gets a 2x1 featured span; utility/functional rows (Continue Watching, Library, Downloads, search, episode grids) stay uniform 1x1.
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

## 8. Layout & IA overhaul (added 2026-06-18, post-Phase-6 feedback)

**Why this section exists:** after Phases 0–6 shipped, user feedback on the running app was that it "feels like you just changed the color and tweaked some stuff but overall it looks the same" — correct. Phases 0–6 were a palette/token/icon swap plus Bento card *tokens* that mostly only surface in a view mode ("list") that isn't the default. The actual layout — sidebar, hero, content rows — was never touched. This section scopes the real structural makeover that was the original ask.

**Goal:** make the Electron app's navigation and content layout feel deliberately designed, not a recolored stock template — without abandoning the palette/icon/token work already shipped.

**Scope (in):**
1. **Sidebar redesign.** Concrete complaints: icon-only rail with no visible labels (tooltip-only); nav order feels arbitrary (Search sits above Home); the "saved/library" thumbnail strip looks bolted onto the bottom of the icon rail rather than designed; the pattern itself ("generic icon rail") needs reconsidering, not just restyling.
2. **Hero → Bento cluster.** Replace the single full-bleed Netflix-pattern hero with a multi-tile cluster: one large featured tile + several smaller quick-pick tiles, varied sizes, in keeping with the Bento concept this redesign was supposed to deliver from the start.
3. **Rows → real Bento grid by default.** `TrendingCarousel` (the 3D coverflow, currently the *default* row renderer) is replaced as the default with the `cards-grid`/`MediaCard`/`featured` Bento system already built in Phase 3 — that system currently only renders in "list" view mode, which is why it was invisible to the user.
4. **Genre/category browsing.** User specifically wants Netflix-style sort/filter by genre — currently absent entirely. New feature, not just a re-skin.
5. **Episode-page UX pass.** User flagged the season/episode browsing UX on `TVPage.jsx` as also lacking — scope to be assessed once reached (read the current implementation, identify concrete gaps, propose fixes before building).

**Scope (out, for now):** Watch Party UI, Settings page structure, OnePace page structure (already got a voyage-map addition in Phase 5) — unless feedback after this pass says otherwise.

**Constraints:** Same as §3 (vanilla CSS/JS by default, dependency only if a specific piece truly needs one). This is layout/IA work, not a new visual-token pass — §4's locked palette/typography/icon decisions are unchanged.

**Execution order (per user's direction when asked):** Sidebar first (most concretely scoped, fastest to validate), then hero cluster + Bento-by-default rows together (user explicitly chose "both" over the lighter single-hero option), then genre browsing, then the episode-page UX pass.

**Acceptance criteria:**
- [x] Sidebar nav items have visible text labels (not tooltip-only), grouped in a sensible order (Home before Search before content sections), and the saved/library strip reads as an intentional section, not a bolted-on afterthought. — Done 2026-06-18 (7a).
- [x] The default home view (no view-mode toggling required) shows a multi-tile Bento hero cluster and Bento-grid rows with varied card sizes — not the old single hero + coverflow. — Done 2026-06-18 (7b).
- [x] Users can filter/browse by genre somewhere in the app (Home and/or Library), matching the Netflix-style capability called out as missing. — Done 2026-06-18 (7c), `GenreBrowser` on `HomePage.jsx`.
- [x] `TVPage.jsx`'s episode browsing has at least one concrete, identified UX gap fixed. — Done 2026-06-18 (7d): episode cards now use Bento radius/shadow tokens; season selector scrolls instead of wrapping.
- [x] No regression to existing behavior (search, watch progress, context menus, drag-reorder, watch party, downloads) — this is additive/restructuring work, not a rewrite of app logic. — No app logic touched in any of 7a–7d, only markup/CSS/one default-value flip.
- [x] `npx vite build` succeeds after each step; a changelog entry exists per `CLAUDE.md` for each session. — Verified after every sub-phase.

**Still outstanding:** none of the above were visually verified in the running app by the agent (sandboxed Electron can't launch a real GUI here) — the user should do a full visual/interaction pass (Home, a TV show's episode list, the sidebar, genre browsing) before treating this section as fully closed.

---

*End of plan v1.*

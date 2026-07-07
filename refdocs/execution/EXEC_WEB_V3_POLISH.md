# EXEC — Web V3 Polish: Mobile Fixes, One Pace & Watch Party Redesign

> **Companion plan:** `refdocs/plans/PLAN_WEB_V3_POLISH.md`
> **Status at authoring (2026-07-07):** Not started. V3 port to web shipped in `92c5b95` and is live on Vercel. Mobile bug evidence: player iframe "refused to connect" on cellular; source toolbar / Back button / mark-progress row overlap on ~412 px width.

---

## Phase 0 — Diagnose the mobile player failure (do first, blocks Phase 1 decisions)

**Files:** none modified — diagnosis only.

**Steps:**
1. On the failing device, load the same title on **Wi-Fi vs cellular vs VPN**. If it loads on Wi-Fi but not cellular → carrier DNS block (hypothesis 2).
2. Build a local test page with the same Videasy URL twice: once with the current `sandbox` attribute, once without. Load on the failing device via dev server. If sandboxed fails and unsandboxed works → sandbox regression (hypothesis 1).
3. `curl -sI https://player.videasy.net/movie/<id>` — check `X-Frame-Options` / `Content-Security-Policy: frame-ancestors` (hypothesis 3).
4. Repeat step 2 for VidSrc and 2Embed to build the per-source compatibility table.
5. Record the verdict + evidence in `refdocs/changelog/DECISIONS.md`.

**Checkpoint:** root cause identified and written down; per-source sandbox compatibility table exists.

**Rollback:** n/a (no code changes). If a fast user-facing fix is needed before diagnosis completes, temporarily revert the `sandbox` attribute only (keep `allow`/`allowFullScreen` — the fullscreen fix is independent).

---

## Phase 1 — Mobile player fixes (P0)

**Files:**
- `apps/web/src/pages/MoviePage.jsx`, `apps/web/src/pages/TVPage.jsx`
- `apps/web/src/utils/api.js` (`PLAYER_SOURCES` — add `sandboxSafe` flag if Phase 0 says so)
- `apps/web/src/styles/global.css`

**Steps:**
1. Apply the Phase 0 outcome:
   - Sandbox regression → add `sandboxSafe: false` to affected sources; render `sandbox` conditionally. Keep sandbox on every source that tolerates it.
   - Carrier block → no iframe change; failover UX (step 2) is the fix. Optionally note a proxy decision (plan §5.3) for a later phase.
2. **Source failover banner:** start a ~8 s timer when the iframe `src` is set; clear it on iframe `load`. On timeout, show a dismissible banner over the player: "Source not loading? Try another" with the remaining `PLAYER_SOURCES` as one-tap chips. No auto-switching (an iframe `load` can fire even for a broken page, and auto-switch would fight the user mid-load).
3. **Mobile layout pass** for the player detail pages at ≤768 px:
   - Player container full-width, `aspect-ratio: 16/9`, no fixed heights.
   - Source toolbar becomes a static row **below** the player (no floating/absolute position).
   - Back button in a fixed header strip or inline above the hero — never overlapping the mark-progress row.
   - Mark-progress buttons wrap (`flex-wrap`), ≥44 px tap targets.
   - Hero: poster smaller (~120 px) beside metadata, synopsis full-width below.
4. Verify at 360/390/412 px in devtools **and** on the real failing device.

**Checkpoint:** plan acceptance criteria 1–3 pass; a movie plays (or fails over gracefully) on the real device.

**Rollback:** each fix is an isolated commit; revert individually. The failover banner is purely additive.

---

## Phase 2 — Site-wide polish (P1)

**Files:**
- `apps/web/index.html` (meta, preconnect, manifest link)
- `apps/web/public/manifest.webmanifest` + icon set (reuse `public/brand/` assets from the redesign branch)
- `apps/web/src/components/MediaCard.jsx`, `HeroBanner.jsx` (lazy images, dimensions)
- `apps/web/src/components/Sidebar.jsx` (aria-labels for bottom-nav mode)
- New `apps/web/src/components/Skeleton.jsx` + skeleton CSS in `global.css`
- `apps/web/src/App.jsx` (per-page `document.title`)

**Steps:**
1. Manifest + icons + `theme-color`; test "Add to Home Screen" on Android (standalone display).
2. `document.title` effect keyed on current page/item.
3. Skeleton rows for home sections and detail-page hero while loading; fixed heights to avoid content jumps.
4. `loading="lazy"` + `width`/`height` attrs on all poster `<img>`; `<link rel="preconnect" href="https://image.tmdb.org">`.
5. aria-labels on nav buttons; check focus rings survive the V3 CSS.
6. Enable Web Analytics + Speed Insights in the Vercel dashboard (user action — flag when reached).

**Checkpoint:** Lighthouse mobile pass ≥90 accessibility, no CLS from row loading; installable PWA prompt appears on Android.

**Rollback:** all additive; revert per commit. Manifest removal restores current behavior.

---

## Phase 3 — One Pace V3 redesign (P1)

**Files:**
- `apps/web/src/pages/OnePacePage.jsx`, `apps/web/src/pages/OnePaceArcPage.jsx`
- `apps/web/src/components/OnePacePlayer.jsx` (style-only; keep proxy streaming logic untouched)
- `apps/web/src/styles/global.css` (new `.onepace-*` classes), `apps/web/src/styles/onepacePlayer.css`

**Steps:**
1. Extract inline styles into `global.css` classes (`.onepace-arc-card`, `.onepace-saga-chips`, `.onepace-arc-grid`, …).
2. Token swap: `--red` → `--accent`; card look → `--card-radius`/`--card-shadow` + corner-bracket hover (reuse `.card::before` pattern); section headers get the film-strip divider.
3. Saga chips → `.genre-tag`/`.genre-tag--active` classes (already in global.css).
4. Mobile: arc grid `minmax(160px, 1fr)` at ≤768 px; chips row horizontally scrollable with edge fade; arc page episode list single-column; player controls ≥44 px.
5. Keep the saga gradient headers (they're distinctive) but layer the V3 vault texture/film motif over them.

**Checkpoint:** zero `--red` references in One Pace files; renders at 360 px without horizontal scroll; episode streams + records progress on a real device (test checklist C from the plan, results logged).

**Rollback:** styling-only phase — revert the commit; data/logic untouched.

---

## Phase 4 — MovieVault Party guest redesign (P1)

**Files:**
- `apps/party-guest/src/App.jsx`, `apps/party-guest/src/index.css`
- `apps/party-guest/src/App.css` (delete dead Vite template rules)
- `apps/party-guest/index.html` (title, theme-color, viewport-fit=cover)

**Steps:**
1. **Join flow:** if session ID parsed from `/join/{id}` URL → hide the Session ID field (show it only in fallback manual mode). Auto-uppercase the 6-char code input, `autocomplete="off"`, numeric-friendly layout.
2. **V3 restyle:** port the amber token block from `apps/web/src/styles/global.css` `:root` into `index.css`; join card gets the vault card look; replace all emoji glyphs with inline SVG icons (copy needed icons from `apps/web/src/components/Icons.jsx` — party-guest has no shared import path).
3. Delete `App.css` template scaffolding (`.hero`, `#next-steps`, `.ticks`, …) — verify nothing references it, then remove the import.
4. **Iframe hardening:** add the same `sandbox` (per Phase 0 verdict) + full `allow` list + `allowFullScreen` to the party iframe.
5. **Sync throttle:** in `syncPlayback`, only rebuild the iframe URL when `|hostTime − lastSyncedTime| > 10 s` (explicit seek), never on heartbeat; document the constant.
6. **Mobile layout:** stacked player/chat with `env(safe-area-inset-bottom)`; reaction buttons ≥44 px; test the autoplay overlay flow on iOS Safari.

**Checkpoint:** join via link on a phone without typing the UUID; run test matrix D from the plan with two guests (one desktop, one phone) against the live Railway relay; results logged in changelog.

**Rollback:** party-guest deploys independently — revert and redeploy `apps/party-guest` alone; web app unaffected.

---

## Phase 5 — Docs & close-out

**Steps:**
1. Update `refdocs/guides/feature_parity.md` — One Pace pages/player ARE ported to web (doc currently says otherwise); note Party guest redesign state.
2. DECISIONS.md entry for the sandbox/per-source policy and the sync-throttle constant.
3. CHANGELOG entries per phase (mandatory).
4. Resolve plan open questions §5.1–5.4 with the user before/during the relevant phase — 5.1 (web hosting) gates any Party work in `apps/web/src`; 5.2 gates Phase 1 step 1; 5.3 only if carrier block confirmed; 5.4 gates Phase 2 step 1 scope.

**Checkpoint:** all plan acceptance criteria (§4) checked off.

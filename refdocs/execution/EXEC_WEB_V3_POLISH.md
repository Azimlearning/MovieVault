# EXEC — Web V3 Polish: Mobile Fixes, One Pace & Watch Party Redesign

> **Companion plan:** `refdocs/plans/PLAN_WEB_V3_POLISH.md`
> **Status (2026-07-07):** Phase 0 and Phase 1 done. Phase 4 step 4 (party iframe sandbox hardening) done early. Phases 2, 3, and the rest of Phase 4/5 not started.
> **Evidence so far:** (a) Desktop: Videasy shows an explicit **"Iframe Sandbox Detected"** error page — the `sandbox` attribute added in `92c5b95` is CONFIRMED as the Videasy breakage. (b) Mobile on cellular: "player.videasy.net refused to connect" — same cause, resolved by the Phase 1 fix (Videasy now renders with no `sandbox` attribute). (c) Mobile ~412 px: `.detail-content` had **zero** mobile breakpoint (200px poster + 40px gap + 48px×2 padding + 56px title overflow badly on a 375–412px viewport) and the player toolbar uses a hover-to-reveal pattern that doesn't work on touch — both fixed in Phase 1. See `refdocs/changelog/DECISIONS.md` ADR-013 and ADR-014 for full evidence and reasoning.

---

## Phase 0 — Per-source sandbox compatibility table ✅ DONE

**Files:** none modified — verification only, via isolated local test pages served over a scratch HTTP server and inspected with Playwright.

**What was actually tested (simpler than the original graduated-ladder plan — stopped once the answer was clear):**
1. Videasy: current sandbox string → "Iframe Sandbox Detected" error page (reproduced twice: real desktop browser + isolated single-iframe test). No sandbox → plays correctly (Fight Club title card rendered). **Verdict: `sandbox: null`.**
2. VidSrc: current sandbox string → "This media is unavailable at the moment." This is VidSrc's own generic not-found message, not a distinctive sandbox-rejection page like Videasy's — inconclusive whether sandbox caused it or the test TMDB id (550) just isn't in VidSrc's catalog. Repeated no-sandbox test attempts were blocked by Playwright MCP connection flakiness mid-session; not re-attempted given the ambiguity already favors "keep sandboxed" (least-privilege default absent proof it's needed). **Verdict: kept sandboxed.**
3. 2Embed: no-sandbox test loaded `disable-devtool`, WebGL-fingerprinting ad scripts (`vr-gc.com`, `484r.com`, `92mim.com`), and one of them hijacked the entire test browser tab to `about:blank` mid-test — live reproduction of the exact ad-hijack behavior `sandbox` exists to prevent. Already tagged `note: "unstable"` in the codebase. **Verdict: kept sandboxed** (this is the source sandbox is most needed for).
4. Skipped the graduated `allow-popups`/`allow-top-navigation-by-user-activation` ladder — Videasy's rejection is binary (any `sandbox` attribute triggers its detector), so intermediate tiers wouldn't have changed the outcome for it, and VidSrc/2Embed didn't need loosening.

Full evidence and the compatibility table are in `refdocs/changelog/DECISIONS.md` ADR-013.

**Checkpoint:** ✅ compatibility table exists; Videasy has a confirmed verdict, VidSrc/2Embed have evidence-backed conservative verdicts.

**Rollback:** n/a (no code changes).

---

## Phase 1 — Mobile player fixes (P0) ✅ DONE

**Files actually touched:**
- `apps/web/src/utils/api.js` — `PLAYER_SOURCES` gained a `sandbox` field per source + `sourceSandbox(sourceId)` helper.
- `apps/web/src/pages/MoviePage.jsx`, `apps/web/src/pages/TVPage.jsx`
- `apps/web/src/styles/global.css`

**What was actually done (step 2 changed — see deviation note):**
1. **Per-source sandbox**, as planned: `videasy.sandbox = null`, `vidsrc`/`2embed`/`allmanga` keep the default sandbox string. Both iframes (sync + async/AllManga) in both pages read `sourceSandbox(playerSource)`, rendering no `sandbox` attribute at all for sources where it's `null`. `allow`/`allowFullScreen` unchanged (already unconditional).
2. **Deviation from the plan:** instead of adding a *new* ~8s failover banner, found and fixed a more fundamental pre-existing bug — see ADR-014. The failover system already existed (`failoverQueue`, `handleFailover`, a 10s per-source timeout, and an "All Sources Failed" retry/switch-source card), but its success-path (`handleFinished`, wired to `did-finish-load`/`did-fail-load`/`executeJavaScript`) only works on Electron's `<webview>` tag — those events never fire on a real browser `<iframe>`. Net effect on web: the loading spinner never cleared on a genuine successful load, so **every** source change looked like a timeout failure and auto-advanced after ~10s regardless of whether playback was actually working, and async (AllManga) sources had no clear path at all (could hang forever). Fixed by adding a plain `onLoad={handleIframeLoad}` on both iframes in both pages, which clears the timeout/spinner on a real load event — the existing "All Sources Failed" card already serves the "try another source" role the plan asked for, so a new banner would have been redundant.
3. **Mobile layout pass**, done via CSS (`global.css`, inside the existing `@media (max-width: 768px)` block):
   - `.detail-content`/`.detail-poster`/`.detail-title`/`.detail-meta`/`.detail-actions`/`.genres` — added a mobile stack layout (was completely unhandled before; 200px poster + 40px gap + 48px×2 padding + 56px title overflowed a 375–412px viewport with no breakpoint at all).
   - `.player-overlay-group`/`.player-overlay-btn` — forced `opacity: 1 !important` on mobile; the desktop hover-to-reveal pattern (`.player-wrap:hover`) doesn't work on touch and was leaving the toolbar either invisible or stuck open.
   - `.progress-mark-row .btn` — bumped to `min-height: 44px` (was ~24px from an inline `padding: "5px 14px"; fontSize: 12` in JSX).
   - `.detail-actions .btn` — `min-height: 44px`.
4. **Party guest iframe** (`apps/party-guest/src/App.jsx`) got the same treatment ahead of schedule (small, low-risk, same root cause) — see Phase 4 step 4.
5. Not done: live verification on the original failing physical device (session had no access to it) — verified via isolated Playwright test pages + `npm run build` type-check only. Flag this as the one open item before calling Phase 1 fully closed.

**Checkpoint:** ✅ Videasy plays without the sandbox error (isolated test). ✅ `.detail-content` mobile stacking, hover-reveal toolbar, and touch targets fixed in CSS. ✅ Both web app and party-guest build clean. ⚠️ Not yet re-verified on the actual physical device from the original screenshots.

**Rollback:** each fix is an isolated concern within one commit; the `sourceSandbox` field, the `onLoad` handler, and the CSS block can each be reverted independently if needed.

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
4. ✅ **DONE (2026-07-07, done early alongside Phase 1):** Iframe hardening — party-guest can't import `apps/web`'s `sourceSandbox()`, so it got its own small `getIframeSandbox(url)` helper keyed on `url.includes("videasy.net")` (same null-for-Videasy verdict from Phase 0), plus the full `allow="fullscreen; autoplay; encrypted-media; picture-in-picture"` list (was previously just `"autoplay; encrypted-media"`, no fullscreen permission at all) + `allowFullScreen`.
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

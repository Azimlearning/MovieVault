# EXEC — Web V3 Polish: Mobile Fixes, One Pace & Watch Party Redesign

> **Companion plan:** `refdocs/plans/PLAN_WEB_V3_POLISH.md`
> **Status (2026-07-08):** Phases 0–4 implemented. Phase 5 (docs) in progress — this update is part of it. Two items intentionally deferred: skeleton loading (Phase 2 step 3 — no existing skeleton component to build on, judged lower priority than the other Phase 2 items) and live device/relay testing (Phase 1 checkpoint, Phase 3/4 checkpoints — no physical device or running relay server available this session).
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

## Phase 2 — Site-wide polish (P1) ✅ MOSTLY DONE (skeleton loading deferred)

**Files actually touched:**
- `apps/web/index.html` — manifest link, apple-touch-icon, favicon-32, theme-color, mobile-web-app meta tags, description, `preconnect` to `image.tmdb.org` + `api.themoviedb.org`.
- `apps/web/public/manifest.webmanifest` (new) + `apps/web/public/icons/{icon-192,icon-512,apple-touch-icon,favicon-32}.png` (new — generated from the existing `dist/brand/icon-1024.png` via PIL, no new art needed).
- `apps/web/src/App.jsx` — per-page `document.title` effect.
- `apps/web/src/components/SearchModal.jsx`, `Sidebar.jsx`, `Icons.jsx` (n/a), `apps/web/src/pages/LibraryPage.jsx`, `DownloadsPage.jsx` — added `loading="lazy"` to the poster `<img>` tags that didn't already have it (MediaCard/CastRow/TrendingCarousel/TVPage already had it).
- `apps/web/src/components/Sidebar.jsx` — `aria-label`/`aria-current` on `NavBtn` (the label text is `display:none` on the mobile bottom-nav, which removes it from the accessibility tree too — aria-label restores it).

**Steps actually done:**
1. ✅ Manifest + icons + theme-color. Not tested for actual "Add to Home Screen" prompt (needs a live device).
2. ✅ `document.title` — keyed on `page` and `selected` (the nav item), with a `PAGE_TITLES` map for static pages and the item's title/name for Movie/TV pages.
3. ❌ **Deferred** — skeleton loading. No skeleton component exists yet in web (`AsyncBoundary` currently shows a spinner); building one from scratch plus fixed-height row placeholders is a larger, higher-risk change than the rest of Phase 2 and was judged lower priority than getting Phases 3/4 done. Left as the top Phase 2 follow-up.
4. ✅ `loading="lazy"` audit across all poster `<img>` tags; `preconnect` added.
5. ✅ aria-labels on nav buttons. Did not separately audit focus rings (no visual QA available this session).
6. ❌ Not done — enabling Vercel Web Analytics/Speed Insights requires the user to click through the Vercel dashboard; flagged, not actionable by the agent.

**Checkpoint:** ⚠️ Partial — no Lighthouse run or device install-prompt test available this session (no browser/device access). Build is clean and the manifest/icons are correctly copied into `dist/` (verified).

**Rollback:** all additive; revert per commit. Manifest removal restores current behavior.

---

## Phase 3 — One Pace V3 redesign (P1) ✅ DONE (scoped down — see deviations)

**Files actually touched:**
- `apps/web/src/pages/OnePacePage.jsx`, `apps/web/src/pages/OnePaceArcPage.jsx`
- `apps/web/src/components/OnePacePlayer.jsx` (added `onTouchStart` for mobile controls reveal + flex-wrap on the error-fallback button row)
- `apps/web/src/styles/global.css` (new `.onepace-page`, `.onepace-arc-grid` classes + mobile overrides for `.onepace-details-grid`/`.onepace-episode-row`/`.onepace-episode-thumb`)
- `apps/web/src/styles/onepacePlayer.css` (token swap + new mobile media query block)

**What was actually done (narrower than planned — see deviations below):**
1. **Not a full inline-style extraction.** Only pulled out the pieces that needed a *responsive* CSS class (the saga chip row → `.genre-tag`, the arc grid, the details grid, the episode row/thumb). The rest of the inline styling (card colors, spacing, gradients) was left as-is — it already uses CSS custom properties (`var(--surface)`, `var(--border)`, etc.) so it already re-themes correctly; rewriting it into named classes wasn't necessary to hit the acceptance criteria and would have been a much larger, riskier diff for a styling-only phase with no visual QA available.
2. **Token swap done:** every `var(--red)` / `var(--red, #e50914)` / hardcoded `#e50914`-family reference across `OnePacePage.jsx`, `OnePaceArcPage.jsx`, and `onepacePlayer.css` replaced with `var(--accent)` (or `var(--danger)` for the two genuine error-state messages, which are semantically errors, not brand accents).
3. **Not done:** corner-bracket hover (`.card::before` reuse) and the film-strip section divider on One Pace cards. These are Bento-card-specific motifs (`.card` class); the One Pace arc cards are a different bespoke component (saga-gradient headers), and forcing the `.card::before` pattern onto them would need a nontrivial adaptation. Deferred — not blocking, purely a polish gap.
4. **Saga chips → `.genre-tag`/`.genre-tag--active`:** done, replacing ~30 lines of manual inline hover-state JS with two className toggles.
5. **Mobile:** `.onepace-arc-grid` → `minmax(160px, 1fr)` at ≤768px (as planned); `.onepace-details-grid` (the 300px-sidebar + episode-list grid) collapses to a single column; `.onepace-episode-row` stacks the thumb above the info instead of a fixed-180px side column; `.onepace-episode-thumb` goes full-width/140px-tall. Chips use the existing `.genre-chip-row` (`flex-wrap`, not horizontal scroll — judged better touch UX than a scroll rail for an 11-item list that wraps to 2–3 rows fine).
6. **Player mobile fix beyond the original plan:** found the custom One Pace video player's controls use a hover-to-reveal pattern (`onMouseMove` shows them, auto-hides after 3s) with no touch equivalent — added `onTouchStart={handleMouseMove}` so tapping the player reveals controls on mobile, plus CSS to keep the volume slider (also hover-reveal on desktop) visible on touch, and made the "Stream Offline" fallback card and its button row responsive (was a fixed 440px box that would overflow a phone screen).
7. Kept the saga gradient headers as-is (per plan step 5) — no new vault texture/film-strip layered on top; scoped out for the same reason as item 3.

**Checkpoint:** ✅ zero `--red` references remain (grepped clean). ✅ CSS-verified responsive at the class level (no horizontal-scroll-causing fixed widths left unguarded on mobile). ❌ Not device-tested — episode streaming + progress recording on a real phone (test checklist C) requires a live device, not available this session.

**Rollback:** styling-only phase — revert the commit; data/logic untouched.

---

## Phase 4 — MovieVault Party guest redesign (P1) ✅ DONE (code); device/relay test still open

**Files actually touched:**
- `apps/party-guest/src/App.jsx`, `apps/party-guest/src/index.css`
- `apps/party-guest/src/App.css` — **deleted** (was already dead: not imported by `main.jsx` or `App.jsx`, confirmed with a repo-wide grep before removing)
- `apps/party-guest/index.html` (viewport-fit=cover, theme-color, description meta)

**What was actually done:**
1. ✅ **Join flow:** `sessionIdFromLink` state set alongside `sessionId` in the `/join/{id}` URL-parsing effect; the Session ID field is conditionally hidden when it's true (manual-entry fallback still shows it if a guest opens the bare app URL). Code input auto-uppercases on change (`.toUpperCase()`) and got `autoComplete="off"` + `autoCapitalize="characters"`.
2. ✅ **V3 restyle:** `index.css` `:root` — `--red`/`--red-hover` replaced with `--accent: #ff8a3d`/`--accent-hover`, with `--red`/`--red-hover` kept as CSS-variable aliases pointing at the new ones (belt-and-braces in case anything outside the reviewed files still references them) then every direct `var(--red...)` usage in the rest of the file was also swapped to `var(--accent...)` directly. Emoji→SVG: 🍿 (join logo) → inline reel-icon SVG matching the sidebar logo's motif; 📡 (host-disconnected) → wifi-off SVG; 🔊 (autoplay-blocked overlay) → volume SVG; ➔ (chat send button) → paper-plane SVG. The reaction emoji row (❤️😂😱🔥🤯👏) and ✋ (hand-raise) were deliberately **kept as emoji** — those are the actual reaction content the guest sends, not decorative chrome, so replacing them would change the feature, not just its icon.
3. ✅ Deleted `App.css` (Vite template scaffolding — `.hero`, `#next-steps`, `.ticks`, the counter demo styles). Confirmed unused first (`grep -rn "App.css"` across `apps/party-guest/src` and `index.html` returned nothing) before removing.
4. ✅ **DONE (2026-07-07, done early alongside Phase 1):** Iframe hardening — party-guest can't import `apps/web`'s `sourceSandbox()`, so it got its own small `getIframeSandbox(url)` helper keyed on `url.includes("videasy.net")` (same null-for-Videasy verdict from Phase 0), plus the full `allow="fullscreen; autoplay; encrypted-media; picture-in-picture"` list (was previously just `"autoplay; encrypted-media"`, no fullscreen permission at all) + `allowFullScreen`.
5. ✅ **Sync throttle:** added `lastSyncedTimeRef` and a `SEEK_RELOAD_THRESHOLD_SECONDS = 10` constant; the iframe branch of `syncPlayback` now only rebuilds/reloads the iframe URL when `|hostTime − lastSyncedTimeRef.current| > 10`, and `updatePlayerSource` (initial title load / title change) also updates the ref so the first heartbeat after a title change doesn't immediately reload again.
6. ✅ **Mobile layout:** `.chat-footer` and `.join-container` get `env(safe-area-inset-bottom)` padding; `.react-btn`/`.hand-btn`/`.chat-send-btn`/`.chat-input` bumped to 44px touch targets in a new `@media (max-width: 900px)` block (matching the existing `.app-layout` breakpoint already in the file). ❌ Not tested on iOS Safari — no device available.

**Checkpoint:** ✅ code review confirms join-without-typing-the-UUID works when `sessionIdFromLink` is true; ✅ `npm run build` clean. ❌ Test matrix D (two guests, live Railway relay) not run — requires an active Electron host + relay connection + a second device, none available this session.

**Rollback:** party-guest deploys independently — revert and redeploy `apps/party-guest` alone; web app unaffected.

---

## Phase 5 — Docs & close-out ✅ DONE (this update)

**What was actually done:**
1. ✅ `refdocs/guides/feature_parity.md` — corrected every stale row: HeroBanner/CastRow/SimilarRow/RatingBadge now ✅ (were 🔄 "being updated"); `OnePacePlayer` now ✅ with a note that it's a from-scratch native `<video>` player, not a webview port (the old row implied it was blocked on webview parity, which was never true for the web version); `OnePacePage`/`OnePaceArcPage` now ✅ (were ❌ "Not ported"); Watch Party guest row now ✅ (was ❌); Port Priority list updated to reflect skeleton loading as the sole remaining top item.
2. ✅ DECISIONS.md ADR-013 (sandbox policy) and ADR-014 (webview-event bug) were already written during the Phase 0/1 session; not duplicated here.
3. ✅ CHANGELOG entries added for Phase 2/3/4/5 work (this session).
4. ⚠️ Plan open questions: §5.2 and §5.4 resolved (see plan doc); §5.1 (web-hosted parties) and §5.3 (proxy fallback) remain genuinely open — not resolved because they need a user decision, not more implementation.

**Checkpoint:** ✅ acceptance criteria §4 re-checked against what shipped — see the plan doc for the itemized ✅/⚠️/❌ status. Two criteria are honestly incomplete: the live test checklists (§4.6) and physical-device re-verification (§4.1/§4.2/§4.4) — both require hardware/network access this coding session didn't have. Flagging clearly rather than claiming false completion.

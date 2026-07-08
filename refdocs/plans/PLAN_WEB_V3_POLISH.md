# PLAN — Web V3 Polish: Mobile Fixes, One Pace & Watch Party Redesign

> Status: **Phases 0–4 implemented (2026-07-08)**; Phase 5 doc close-out in progress. Skeleton loading (Phase 2) and live device re-verification (Phase 1) are the two open items — see execution doc for detail.
> Target codebase: **Web app** (`apps/web/src/`) + **Party guest app** (`apps/party-guest/`) on `main`
> Companion execution doc: `refdocs/execution/EXEC_WEB_V3_POLISH.md`

---

## 1. Goal

The V3 redesign port (commit `92c5b95`) shipped the new look to the web app, but real-device testing on mobile revealed regressions and gaps: the player iframe fails to load on some mobile connections ("player.videasy.net refused to connect"), player-page controls overlap each other on narrow screens, and two whole feature areas — **One Pace** and **MovieVault Party** — never received the V3 treatment and have never been systematically tested on mobile. This plan covers fixing the mobile bugs, restyling both feature areas to V3, and defining the test pass that verifies all of it on real devices.

## 2. Scope

### In scope

**A. Player load failures — desktop AND mobile (P0)**
- **A1 — `sandbox` attribute regression: CONFIRMED for Videasy.** Added in `92c5b95` to block ad popups. Desktop evidence (2026-07-07): Videasy renders an explicit **"Iframe Sandbox Detected — This iframe has sandbox restrictions that prevent proper functionality"** error page instead of the player. Videasy detects the sandbox and hard-refuses regardless of which `allow-*` permissions are granted alongside it (to be verified — see the graduated ladder in the execution doc). The mobile "player.videasy.net refused to connect" is likely the same root cause; residual hypotheses to check only if the sandbox fix doesn't resolve mobile:
  1. **Carrier/ISP DNS blocking** — streaming embed domains are commonly blocked on mobile carriers (the failing mobile screenshot was on cellular). Compare Wi-Fi vs cellular vs VPN on the same device.
  2. **Provider-side `X-Frame-Options`/`frame-ancestors` change** — check response headers for the embed URL.
  - Fix shape: per-source `sandboxSafe` flag in `PLAYER_SOURCES`. First try a **graduated sandbox ladder** per source (add `allow-popups`, then `allow-top-navigation-by-user-activation`) to find the least-permissive set the provider accepts; if a provider rejects any sandbox at all (Videasy appears to), drop `sandbox` for that source only and accept its popups. Keep `allow="fullscreen…"` + `allowFullScreen` everywhere — the fullscreen fix is independent and harmless.
- **A2 — Mitigation regardless of cause:** source failover UX. If the active source's iframe doesn't become interactive within a timeout, surface a visible "This source isn't loading — try another" banner with one-tap switching to the next source in `PLAYER_SOURCES`. (Today a dead iframe just sits there.)
- **A3 — Overlapping controls on mobile (MoviePage/TVPage).** Observed: the player source toolbar (source pill, blocked-stats shield, open-external, download) floats detached over the poster/content; the Back button collides with the "Mark progress" 25/50/75/100% row; hero synopsis column is squeezed. The player detail pages need a proper ≤768 px layout pass: single column, full-width player, toolbar stacked below the player, no absolute-positioned elements crossing content.

**B. Site-wide improvements (P1)**
- **PWA-ification:** web manifest + icons + theme color so the app can be installed to home screen and run standalone (also improves the fullscreen story on Android).
- **Loading skeletons** for home rows and detail pages instead of bare spinners; reserve space to prevent layout jumps.
- **Image hygiene:** `loading="lazy"` + explicit dimensions on posters/backdrops; `preconnect` to `image.tmdb.org`.
- **Meta/SEO:** per-page `document.title`, OG tags, description (currently a bare Vite title).
- **Accessibility:** aria-labels on the icon-only bottom-nav buttons, visible focus states, keyboard-reachable cards.
- **Vercel dashboards:** enable Web Analytics + Speed Insights (both currently off per production checklist).

**C. One Pace redesign + test (P1)**
Current state: `OnePacePage.jsx` / `OnePaceArcPage.jsx` are functional but styled entirely with inline styles referencing the old `--red` token and pre-V3 card look; no film motifs; saga filter chips are hand-rolled instead of the V3 `genre-tag` style; the arc grid has no mobile breakpoints.
- Restyle both pages to V3: amber accent, `refdocs` card tokens (`--card-radius`, `--card-shadow`), corner-bracket hover, saga chips using `.genre-tag` classes, film-strip section dividers. Move inline styles into `global.css` classes.
- Mobile layout: arc grid `minmax(160px, 1fr)` at ≤768 px, horizontally scrollable saga chips with edge fade, player page single-column.
- Optional (stretch, from V3 plan §7): treasure-map arc progress indicator.
- Test checklist: catalog fetch + failure state, per-episode progress tracking, Pixeldrain proxy streaming on cellular, fullscreen on Android/iOS, subtitle rendering, resume position.

**D. MovieVault Party redesign + test (P1)**
Current state: guest app (`apps/party-guest/`, deployed at `movievault-party.vercel.app`) works but is visually pre-V3 (Netflix-red `--red` tokens, emoji-as-icons), `App.css` is dead Vite-template scaffolding, the join form makes the guest hand-type a UUID session ID even when it's already in the `/join/{id}` link, and the party player iframe has **no `sandbox`** — so the ad tab-hijacking we just fixed in the main app still happens in parties.
- **Join flow redesign:** when the session ID comes from the URL, hide that field entirely — guest enters name + 6-char code only. V3 amber/vault styling on join card and room. Replace emoji glyphs (🍿 📡 🔊 ➔ ✋) with the shared SVG icon set. Delete dead `App.css` template rules.
- **Room layout mobile pass:** player on top, chat below with safe-area padding, reaction row thumb-reachable; landscape = player left / chat right (exists at 900 px, needs verification + safe-area).
- **Party player hardening:** same `sandbox`/`allow`/`allowFullScreen` treatment as the main app (subject to the A1 diagnosis outcome).
- **Sync robustness:** iframe sync currently reloads the embed URL with `?t=` on every host seek/heartbeat-drift — decide and document a throttle (e.g., only reload on explicit seek > 10 s delta, never on heartbeat).
- Test matrix: join via link vs manual, wrong code, host disconnect countdown + reconnect, kick, chat, reactions, hand raise, One Pace native-video drift correction (>3 s), movie/TV iframe reload behavior, mobile autoplay overlay, two simultaneous guests.

### Out of scope
- Electron app changes (`src/`) — V3 work there continues on `redesignuiux`.
- Watch Party **host** on the web app (host remains Electron-only; porting hosting is an open question below).
- Relay server (`movievault-party.up.railway.app`) protocol changes — unless A1/D testing proves a server change unavoidable.
- New content sources or download features on web.

## 3. Constraints

- Web app must keep working inside the IPC polyfill (no Electron APIs).
- No new runtime dependencies unless a specific item genuinely needs one (same policy as V3 plan §3).
- The `sandbox` ad-blocking win must not be sacrificed wholesale: if a provider breaks under sandbox, prefer per-source sandbox opt-out over removing it everywhere.
- All fixes verified on at least one real Android device (Chrome) and one iOS device (Safari) before marking done — emulators don't reproduce carrier DNS blocking or autoplay policy.
- Party guest app and web app deploy independently on Vercel; keep changes in separate commits so either can be rolled back alone.

## 4. Acceptance criteria

1. ✅ Videasy plays again on desktop (no "Iframe Sandbox Detected" page) via isolated test-page verification. ⚠️ **Not yet re-verified on the original failing physical device** — no device access this session.
2. ✅ No overlapping UI on MoviePage/TVPage at 360/390/412 px widths (via code inspection + CSS fix — `.detail-content` had zero mobile breakpoint before); touch targets bumped to ≥44 px. Not confirmed with an actual rendered screenshot at those widths.
3. ✅ Per-source sandbox compatibility table written in DECISIONS.md ADR-013 with evidence (Videasy confirmed broken/fixed; VidSrc/2Embed evidence-backed conservative calls).
4. ✅ One Pace pages: zero `--red` references remain (swapped to `--accent`/`--danger`); saga chips + arc grid + details grid + episode rows all have mobile CSS. ⚠️ Not device-tested for streaming/progress-recording on mobile.
5. ✅ Party guest join flow hides Session ID when parsed from `/join/{id}`; join screen + room restyled to `--accent` tokens; party iframe now sandboxed per the same per-source policy (Videasy exempted, others sandboxed).
6. ❌ **Not done** — the full One Pace and Party test checklists (plan §2.C/§2.D) require live devices and a running relay server / real party session; not executable in this session. Flagged as the top follow-up.
7. ✅ `refdocs/guides/feature_parity.md` updated — stale "Not ported" claims for One Pace and Party guest corrected.

## 5. Open questions

1. **Web-hosted parties?** Still open. Not resolved this session — Party work in `apps/web/src` was limited to the iframe sandbox fix (shared with the main player fix); no `WatchPartyHostModal` port was attempted. Hosting remains Electron-only.
2. **Per-source sandbox policy:** ~~if diagnosis shows sandbox breaks only some providers~~ **Resolved 2026-07-07** — Videasy confirmed to hard-block sandboxed iframes, so a per-source `sandbox` field in `PLAYER_SOURCES` is the approach (implemented). Remaining sub-question (still open): whether to label non-sandboxed sources in the source picker (e.g. "may show popups") so users can prefer protected sources — not done this session.
3. **Proxy fallback for blocked domains:** Still open — not needed once the sandbox fix resolved the reported failure; revisit only if a genuine carrier-block case turns up in device testing.
4. **PWA scope:** **Resolved 2026-07-08** — manifest + icons + meta tags only, no service worker (avoids offline cache-invalidation complexity for a streaming app where stale cached content would be actively harmful).

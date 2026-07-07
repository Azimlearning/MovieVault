# PLAN — Web V3 Polish: Mobile Fixes, One Pace & Watch Party Redesign

> Status: **Draft** (plan only — no implementation yet)
> Target codebase: **Web app** (`apps/web/src/`) + **Party guest app** (`apps/party-guest/`) on `main`
> Companion execution doc: `refdocs/execution/EXEC_WEB_V3_POLISH.md`

---

## 1. Goal

The V3 redesign port (commit `92c5b95`) shipped the new look to the web app, but real-device testing on mobile revealed regressions and gaps: the player iframe fails to load on some mobile connections ("player.videasy.net refused to connect"), player-page controls overlap each other on narrow screens, and two whole feature areas — **One Pace** and **MovieVault Party** — never received the V3 treatment and have never been systematically tested on mobile. This plan covers fixing the mobile bugs, restyling both feature areas to V3, and defining the test pass that verifies all of it on real devices.

## 2. Scope

### In scope

**A. Mobile player bugs (P0)**
- **A1 — Video fails to load on mobile.** Screenshot evidence: `player.videasy.net refused to connect` inside the player frame on a 5G connection. Three candidate causes, to be diagnosed in order:
  1. **`sandbox` attribute regression** — added in `92c5b95` to block ad popups. Some embed providers' scripts touch `window.top.location` or `window.open` at boot; in a sandbox without `allow-top-navigation`/`allow-popups` those throw, and a provider that treats the exception as fatal shows a broken page. Diagnose by A/B loading the same title with and without `sandbox` on the same device.
  2. **Carrier/ISP DNS blocking** — streaming embed domains are commonly blocked on mobile carriers (the failing screenshot is on cellular). Diagnose by comparing Wi-Fi vs cellular vs VPN on the same device.
  3. **Provider-side `X-Frame-Options`/`frame-ancestors` change** — check response headers for the embed URL.
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

1. A movie plays on a real mobile device on cellular, or — if the source is carrier-blocked — the failover banner appears within ~8 s and switching sources is one tap.
2. No overlapping UI on MoviePage/TVPage at 360 px, 390 px, and 412 px widths; all touch targets ≥ 44 px.
3. Root cause of "refused to connect" is written down in DECISIONS.md with the diagnosis evidence (sandbox vs DNS vs headers).
4. One Pace pages contain zero inline `--red` references and render correctly at 360 px; an episode streams and records progress on mobile.
5. Party guest joining via a `/join/{id}` link never sees the Session ID field; join screen and room match V3 styling; party iframe blocks popup ads.
6. Full One Pace and Party test checklists (C/D above) executed and results logged in the changelog.
7. `refdocs/guides/feature_parity.md` updated — it still claims One Pace pages are "Not ported" to web, which is stale.

## 5. Open questions

1. **Web-hosted parties?** Should the web app gain host capability (it has no `WatchPartyHostModal`), or does hosting stay Electron-only? Affects whether Party redesign includes any `apps/web/src` work at all.
2. **Per-source sandbox policy:** if diagnosis shows sandbox breaks only some providers, do we maintain a `sandboxSafe` flag per source in `PLAYER_SOURCES`, accepting that non-sandboxed sources can pop ads?
3. **Proxy fallback for blocked domains:** if carrier DNS blocking is confirmed, do we route embeds through a serverless proxy (like the existing One Pace Pixeldrain proxy)? Cost/abuse implications on Vercel Hobby.
4. **PWA scope:** manifest-only, or also a service worker for offline shell? (Service worker adds cache-invalidation complexity.)

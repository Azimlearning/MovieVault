# Improvement Plan V2 — MovieVault (Phase 2)

> **Status:** Draft v2 — extends `IMPROVEMENT_PLAN.md` (v1).
> **Scope:** Three feature tracks layered on top of v1 — UX polish to reach Netflix-tier feel, One Pace integration, and a host/guest Watch Party system.
> **Prereqs:** v1 sections **4.2 (Error State System)** and **4.3 (Request Caching Layer)** must be complete before starting any feature in this doc. Several v2 features depend on the typed error result types and the cache wrapper.
> **Audience:** You (solo dev, personal use) and any AI coding assistant executing this plan.

---

## 0. How to use this document

Each feature is written PRD-style: **Problem → Goal → UX → Functional Requirements → Technical Approach → Acceptance Criteria → Effort**.

Effort scale: **S** (≤ 1 evening), **M** (1–3 evenings), **L** (a weekend), **XL** (multiple weekends — only Watch Party qualifies here).

Phases are intentionally ordered (see section 8). Do not skip ahead — each phase locks in capabilities the next one assumes.

---

## 1. Updated guiding principles

The v1 principles still hold. Two additions specific to v2:

6. **Real-world latency exists.** Watch Party and any networked feature must handle the 200–800ms round-trip a casual home network introduces. Design with that in mind, not against it.
7. **Guests are not the user.** The Watch Party guest experience is a stripped-down web page, not a port of the app. Resist the urge to bring features over "just in case."

---

## 2. Phase overview

| Phase | Theme | Time budget | Why now |
|---|---|---|---|
| **P4** | UX polish — Netflix-tier feel | ~1.5 weeks | Cheap features with disproportionate perceived-quality payoff. Do these before Watch Party so guests' first impression is polished. |
| **P5** | One Pace integration | ~1 week | Self-contained, uses existing player stack. Good warm-up before tackling Watch Party. |
| **P6** | Watch Party | ~3 weeks | Biggest lift in the entire project. Save for last when everything underneath is stable. |

---

## 3. P4 — UX Polish

### 4.1 Skeleton Loading System

**Problem.** The app currently shows generic spinners (or worse, blank panels) while data loads. Premium streamers never show spinners on content surfaces — they show shimmering grey placeholder cards that match the shape of the incoming content.

**Goal.** Every content surface shows a shape-matched skeleton during load. Zero spinners on Home, Library, Movie detail, TV detail, Search, and One Pace pages.

**UX.**
- HomePage: skeleton hero banner (full-width grey rect with shimmer) + 3 rows of 6 skeleton cards each.
- MoviePage / TVPage: skeleton poster on the left, skeleton title bars + meta chips on the right, skeleton cast row, skeleton "More like this" row.
- Library / Search results: grid of skeleton cards matching the eventual card size exactly (no layout shift when real data arrives).
- Shimmer animation: ~1.6s linear infinite gradient sweep, low contrast (grey-50 → grey-100 → grey-50), respects `prefers-reduced-motion`.

**Functional requirements.**
1. A `<Skeleton>` primitive in `src/components/Skeleton.jsx` taking `{ width, height, variant: 'rect' | 'text' | 'circle', count? }`.
2. Composite skeletons per surface in `src/components/skeletons/`: `HomeSkeleton`, `MovieDetailSkeleton`, `TVDetailSkeleton`, `CardGridSkeleton`, `CastRowSkeleton`.
3. Skeletons use the same layout primitives as the real component so there is zero layout shift on data arrival.
4. Wired through the existing `<AsyncBoundary>` from v1 §4.2: pass `loadingComponent={<HomeSkeleton />}` instead of relying on the default spinner.
5. Reduced-motion: when `prefers-reduced-motion: reduce` is set, the shimmer animation is replaced with a static muted grey fill.

**Technical approach.**
- Pure CSS shimmer using a `linear-gradient` background and `background-position` keyframe animation. No JS animation lib needed for this.
- Audit every `useEffect` data fetch and replace any `<Spinner />` with the matching composite skeleton.

**Acceptance criteria.**
- [ ] Throttle network to "Slow 3G" in dev tools → every page shows a shape-matched skeleton, never a spinner.
- [ ] When data arrives, no layout shift occurs (verify with browser layout-shift highlighter or eyeball it).
- [ ] `prefers-reduced-motion: reduce` → no shimmer animation, just a static fill.

**Effort:** M (2 evenings).
**Files likely to touch:** new `src/components/Skeleton.jsx`, new `src/components/skeletons/*`, every page component to swap the loading prop.

---

### 4.2 Hero Banner with Trailer Autoplay

**Problem.** The HomePage opens with a search box and a trending row. There's no cinematic "anchor" that establishes the app as a premium streaming experience.

**Goal.** A full-width hero banner at the top of HomePage featuring one trending/featured title. Static poster art loads first; after 2 seconds of hover (or after 2 seconds of being on-screen, configurable), the trailer fades in and autoplays muted.

**UX.**
- Banner height: 60% of viewport on first load, max 540px.
- Layered content (z-index from back to front): trailer video (hidden initially), poster backdrop with vertical gradient overlay, title + tagline + CTA buttons ("Play", "Add to Library", "More info").
- Trailer plays muted; an unmute icon appears bottom-right on hover.
- When the user navigates away (carousel underneath comes into focus, mouse leaves the banner area for 4s+), trailer pauses and fades back to poster.
- A subtle dot indicator at the bottom shows which of 5 rotating featured titles is showing. Auto-advances every 12s if no trailer is playing.

**Functional requirements.**
1. A `<HeroBanner>` component fed by 5 trending titles from TMDB (cached per v1 §4.3, 6h TTL).
2. Trailer source: TMDB `/movie/{id}/videos` filtered to `type: "Trailer"`, `site: "YouTube"`, first result. Embedded via YouTube iframe with `?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1`.
3. If no trailer is available for a title, the banner stays in poster mode permanently (no broken iframe).
4. The featured-title rotation is paused while a trailer is playing.
5. Banner CTAs: "Play" → opens the title's player directly; "Add to Library" → adds to library and updates the button to "In Library"; "More info" → opens the MoviePage / TVPage.
6. Setting in Settings → Playback: "Autoplay trailers on banner" toggle (default on). When off, the banner stays in poster mode.

**Technical approach.**
- The YouTube iframe must be created lazily — don't mount it until the 2s hover/visibility threshold is hit. This avoids unnecessary network/CPU on app open.
- Use `IntersectionObserver` to detect when the banner is visible (in case the user scrolls past it without hovering).
- Use `framer-motion` for the cross-fade between poster and trailer (300ms ease-in-out).
- Featured-title rotation uses a `setInterval` ticking every 12s; pause it while a trailer is playing.

**Acceptance criteria.**
- [ ] Open HomePage → hero appears with poster within 200ms (cached) or shows skeleton until ready.
- [ ] Hover banner for 2s → trailer fades in and starts playing muted.
- [ ] Mouse off banner for 4s → trailer fades out, poster returns.
- [ ] Title without a trailer → banner stays in poster mode, no broken iframe attempts.
- [ ] Toggle "Autoplay trailers" off in Settings → banner never enters trailer mode.

**Effort:** M (2–3 evenings).
**Files likely to touch:** new `src/components/HeroBanner.jsx`, `src/pages/HomePage.jsx`, `src/ipc/tmdb.js` (add `/videos` endpoint wrapper), `src/pages/SettingsPage.jsx`.

---

### 4.3 Page Transitions & Card Hover

**Problem.** Navigation between pages is an instant cut. Content cards have no hover affordance. Both feel like a 2010 React app, not a 2026 streaming product.

**Goal.** Smooth motion that signals "this is a premium app" without being slow or distracting.

**UX.**
- Page transitions: 180ms cross-fade with a 6px slide-up on enter. No transition on back-navigation (so going back feels instant).
- Card hover: scale 1.08, lift with `0 8px 24px rgba(0,0,0,0.45)` shadow, 200ms ease-out. After 600ms of sustained hover, an info popout slides in from the right edge of the card showing rating, year, runtime, top 3 genres, and a one-line synopsis.
- Click feedback: cards briefly scale to 0.96 on `mousedown` for tactile feel.
- Keyboard navigation: arrow keys move between cards in a grid, Enter opens, with a visible focus ring (not the default browser one).

**Functional requirements.**
1. Wrap `<Routes>` in `<AnimatePresence mode="wait">` from `framer-motion`. Each page component wraps its root in `<motion.div>` with the standard `initial / animate / exit` props.
2. Back-navigation skips the transition. Detect via `useNavigationType()` from React Router — if `POP`, render without `motion.div`.
3. A `<ContentCard>` component centralizes the hover scale, shadow, info popout, and focus ring. All existing card grids switch to using it.
4. Info popout: appears on the right side of the card unless it would overflow the viewport, in which case it appears on the left.
5. Grid keyboard navigation: arrow keys move focus, Tab enters/exits the grid, Enter opens the title. Implement with a thin focus-trap-grid helper.

**Technical approach.**
- `framer-motion` already pulls in for v1 §5.1 Continue Watching; reuse here.
- The info popout is a single React component conditionally rendered after a 600ms `setTimeout` that's cleared on `mouseleave`.

**Acceptance criteria.**
- [ ] Navigate between Home → Movie detail → back → Home: forward transitions animate, back is instant.
- [ ] Hover a card for 600ms → info popout appears with title metadata.
- [ ] Keyboard: tab into a grid, arrow keys move focus across rows/cols, Enter opens detail.
- [ ] Reduced motion: transitions become instant cuts; card hover scale is removed (only the shadow remains).

**Effort:** M.
**Files likely to touch:** `App.jsx` (router wrap), every `src/pages/*.jsx` (root motion div), new `src/components/ContentCard.jsx`, all existing usages of raw cards swap to `<ContentCard>`.

---

### 4.4 Rich Detail Pages

**Problem.** MoviePage and TVPage show the bare minimum: poster, title, play button. Real streamers fill the rest of the screen with context — cast, similar titles, ratings, technical details.

**Goal.** Detail pages that feel like a destination, not just a stopgap to the player.

**UX.**
Layout, top to bottom:
1. **Backdrop hero** — same treatment as HomePage hero but for this single title. Trailer plays on hover if available.
2. **Title block** — title, tagline, content rating badge (TV-MA / PG-13 / etc.), runtime, year, language, IMDb-style rating with star icon.
3. **Genre chips** — clickable pills that link to a genre-filtered search.
4. **Synopsis** — 3-line clamp with a "Read more" expander.
5. **Action row** — Play, Add to Library, Mark as watched, Download (if available), Share.
6. **Cast row** — horizontal scroll of cast members with circular photos, names, character names. First 12 visible.
7. **Episode list** (TV only) — season dropdown + episode cards with thumbnails, titles, air dates, and runtime.
8. **More like this** — horizontal row of 12 similar titles from TMDB's `/similar` endpoint.
9. **Details panel** — collapsed by default: production company, country, budget/revenue (if available), spoken languages, certifications.

**Functional requirements.**
1. All metadata sourced from a single TMDB call: `/movie/{id}?append_to_response=credits,similar,videos,release_dates,external_ids` (one round trip).
2. Cast row uses the existing TMDB image CDN proxy. Circular photo + name + character role.
3. Content rating badge maps TMDB's certification codes (US, GB, etc.) — fall back to "NR" if missing. Region preference in Settings (default US).
4. "More like this" cards reuse `<ContentCard>` from §4.3.
5. Genre chips link to `/search?genre={id}` — Advanced Search (v1 §6.3) handles the filter.

**Technical approach.**
- Single `append_to_response` TMDB call cuts page load to one network request (cache via v1 §4.3).
- Cast photos lazy-load as the row scrolls horizontally.
- Episode list (TV) reuses the existing component but gets a thumbnail/runtime treatment.

**Acceptance criteria.**
- [ ] Open any popular movie → backdrop, cast, similar, and details all populate within 500ms (cached).
- [ ] Click a genre chip → navigates to a filtered search showing matching titles.
- [ ] TV show with multiple seasons → season selector swaps the episode list without a full page reload.
- [ ] Cast row scrolls horizontally; clicking a cast member opens a TMDB person page modal (out of scope: a full person detail page — modal is fine for v1).

**Effort:** L (a weekend).
**Files likely to touch:** `src/pages/MoviePage.jsx`, `src/pages/TVPage.jsx`, new `src/components/CastRow.jsx`, new `src/components/SimilarRow.jsx`, new `src/components/RatingBadge.jsx`, `src/ipc/tmdb.js`.

---

## 4. P5 — One Pace Integration

> **Background.** One Pace is a fan-made recut of the One Piece anime that removes filler and matches the manga's pacing. The project's official GraphQL API has been intermittently down since 2024; the community has settled on parsing the official One Pace Google Sheets as the canonical data source. Episodes are hosted on Pixeldrain with direct file URLs that work without scraping or DRM. Reference implementation: `au2001/onepace-stremio` (MIT-licensed Stremio addon — study its sheet-parsing code).

### 5.1 One Pace Data Layer

**Problem.** None of the existing scrapers know about One Pace. AniList's One Piece entry doesn't reflect the recut episode structure.

**Goal.** A local data layer that pulls One Pace's full arc/episode catalog from Google Sheets and exposes a clean API to the rest of the app.

**Functional requirements.**
1. New IPC module `src/ipc/onepace.js` exposing:
    - `listArcs()` → `Arc[]`
    - `getArc(arcId)` → `{ arc: Arc, episodes: Episode[] }`
    - `getEpisode(arcId, episodeNumber)` → `Episode`
    - `refresh()` → forces a Google Sheets re-fetch
2. `Arc` shape: `{ id, name, mangaChaptersStart, mangaChaptersEnd, originalEpisodeRangeStart, originalEpisodeRangeEnd, episodeCount, posterUrl, status: 'released' | 'in_progress' | 'planned' }`.
3. `Episode` shape: `{ arcId, episodeNumber, title, mangaChapters, originalEpisodeRange, durationMin, releaseDate, resolutions: { '1080p'?: { pixeldrainId, sizeMb, magnetUri }, '720p'?: {...}, '480p'?: {...} }, subtitles: SubtitleTrack[] }`.
4. Data sourced from the public One Pace tracking sheet (GID-addressable Google Sheets CSV exports). The exact sheet IDs and column mappings should be lifted from the `onepace-stremio` repo's `scripts/` directory to stay aligned with the upstream format.
5. Cached for 6 hours in `electron-store` under `cache.onepace.*`. Manual "Refresh One Pace catalog" button in Settings → Sources.
6. Stale-while-revalidate: if cache exists, return immediately and refresh in the background.

**Technical approach.**
- Use the Google Sheets CSV export URL format: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}`.
- Parse CSV with `papaparse` (well-tested, ~20kb).
- Pixeldrain stream URLs are deterministic: `https://pixeldrain.com/api/file/{fileId}?download`.
- Magnet URIs are sometimes included in the sheet as fallback; preserve them as-is.

**Acceptance criteria.**
- [ ] First open of "One Pace" section pulls fresh data in < 3s.
- [ ] Second open within 6h returns instantly from cache.
- [ ] Manual refresh button forces re-fetch and shows a toast on success/failure.
- [ ] If the Google Sheet is unreachable, error state shows a useful message linking to onepace.net.

**Effort:** M.
**Files likely to touch:** new `src/ipc/onepace.js`, new `src/utils/onepaceTypes.js`, `src/ipc/storage.js`, `src/pages/SettingsPage.jsx`.

---

### 5.2 One Pace Browse UI

**Problem.** Once the data is in, the user needs a discoverable, arc-based browsing experience that respects how One Pace is actually organized (not by season/episode like normal anime).

**Goal.** A dedicated One Pace section accessible from the main sidebar, with arc-first navigation and per-arc episode lists.

**UX.**
- New sidebar entry: "One Pace" (with a small One Piece-themed icon, e.g. straw hat).
- Landing page (`/onepace`): grid of arc cards. Each card shows arc poster, name, episode count, status badge ("Complete", "In progress", "Planned").
- Arc detail page (`/onepace/:arcId`): left sidebar with arc metadata (manga chapters covered, original episode range, total duration), main panel with episode grid. Episodes show thumbnail, title, manga chapters, duration, resolution badge.
- Episode card click → opens the One Pace player (next feature).
- Filter chips above the arc grid: "All", "Saga: East Blue", "Saga: Alabasta", "Saga: Skypiea", etc.

**Functional requirements.**
1. `src/pages/OnePacePage.jsx` (arc grid) and `src/pages/OnePaceArcPage.jsx` (episode list).
2. Routes: `/onepace` and `/onepace/:arcId`.
3. Sidebar entry conditionally rendered — hidden if Settings → "Show One Pace" toggle is off (default on).
4. Episodes display a "Continue" badge if any watch progress exists (uses v1 §5.1 watch history store).
5. Empty/error states use v1 §4.2 `<AsyncBoundary>`.

**Acceptance criteria.**
- [ ] Sidebar shows "One Pace" entry.
- [ ] Arc grid loads with poster art and status badges.
- [ ] Clicking an arc shows its episode list.
- [ ] Episodes with watch progress display the "Continue" badge.

**Effort:** M.

---

### 5.3 One Pace Player

**Problem.** The existing player is built around iframe sources (VidSrc, Videasy, 2Embed). Pixeldrain provides direct video file URLs, which opens up much richer player behavior — subtitle overlay, accurate progress tracking, and native browser controls if needed.

**Goal.** A dedicated One Pace player that uses the existing player chrome (UpNext banner, fullscreen overlay, etc.) but plays direct files via HTML5 `<video>` instead of iframe.

**Functional requirements.**
1. New `<OnePacePlayer>` component using `<video>` tag with Pixeldrain URL as src.
2. Resolution picker: 1080p / 720p / 480p — defaults to highest available, remembered per arc in `electron-store`.
3. Subtitle overlay: One Pace ships `.ass` subtitle files. Render via `libass-wasm` (or `JASSUB`, its actively maintained fork). Subtitles selectable from a track picker in the player chrome.
4. Reuse existing keyboard shortcuts (space pause, arrows seek, F fullscreen) from v1 §5.3.
5. UpNext banner: at 90% through, show "Next: {next episode}" with a 10s countdown; auto-plays next episode unless cancelled.
6. Watch progress tracked in v1 §5.1 watch history under namespace `onepace.{arcId}.{episodeNumber}`.
7. If Pixeldrain returns 5xx or a "rate limited" page, fallback to:
    1. Try a different resolution.
    2. If that also fails, show a card with the magnet link and a "Copy magnet" button + "Open onepace.net" link.

**Technical approach.**
- HTML5 `<video>` with `crossOrigin="anonymous"` and `preload="metadata"`.
- `libass-wasm` / `JASSUB` runs subtitles in a `<canvas>` layered above the video.
- Progress saved every 5 seconds via debounced `timeupdate`.

**Acceptance criteria.**
- [ ] Click an episode → player opens and starts playing within 3s on a fast connection.
- [ ] Subtitles render correctly (positioning, styling) — verify against an `.ass` file with karaoke effects.
- [ ] Resolution change reloads the file at the new quality, preserving the playhead position.
- [ ] Pixeldrain failure → fallback card appears with magnet copy.
- [ ] Hitting 90% triggers UpNext; cancelling and ending normally also marks the episode as watched.

**Effort:** L.
**Files likely to touch:** new `src/components/OnePacePlayer.jsx`, new `src/utils/subtitleRenderer.js`, `src/ipc/onepace.js` (resolution helpers).

---

### 5.4 AniList Progress Mapping

**Problem.** When a user finishes a One Pace arc, their AniList One Piece entry is stuck at 0. Conversely, if AniList sync (v1 §7.3) is on, marking One Piece progress on AniList should not break the One Pace section.

**Goal.** A bidirectional but conservative mapping between One Pace progress and AniList's One Piece entry, with the user clearly in control.

**Functional requirements.**
1. Setting in Settings → Integrations → AniList: "Sync One Pace progress to One Piece on AniList" (default off; on toggle, show a one-time explanatory modal).
2. When on, completing an arc updates the AniList One Piece progress to the *highest original-episode-equivalent* watched. Example: finishing the Arlong Park arc, which covers original episodes 31–44, sets AniList progress to 44 (only if currently below 44).
3. Progress never goes backward via this sync.
4. Manual conflict resolution: if AniList progress is ahead of what One Pace would set, show a one-time toast asking which to trust.

**Acceptance criteria.**
- [ ] Toggle on, finish Arlong Park arc → AniList One Piece progress updates to 44.
- [ ] Re-finishing an earlier arc does NOT lower AniList progress.
- [ ] Toggle off → no AniList writes from One Pace.

**Effort:** S (assuming v1 §7.3 AniList Sync is already shipped).

---

## 5. P6 — Watch Party

> **Architecture overview.** The Electron app acts as the **host** and connects to a small WebSocket **relay server** you'll deploy free-tier (Railway, Fly.io, or Render). The relay generates a session and rebroadcasts host events to all guests. Guests connect via a separate minimal **guest web app** deployed to Vercel — they need only a browser, never the desktop app.

### 6.1 Relay Server

**Problem.** Host and guests can't reach each other directly (NAT, no port forwarding). A tiny relay sits in the middle.

**Goal.** A minimal stateless WebSocket relay that creates sessions, validates joins, and rebroadcasts messages.

**Functional requirements.**
1. New repo / sub-package: `services/party-relay/`. Independent deployment.
2. Endpoints:
    - `POST /session` → creates a new session. Returns `{ sessionId, sessionCode, hostToken }`. `sessionCode` is a 6-char alphanumeric (excluding ambiguous chars: 0/O, 1/I/l).
    - `WS /session/:sessionId?token={hostToken|guestToken}` → opens a WebSocket. Host token has broadcast privileges; guest tokens are read-mostly (can send chat/reactions only).
    - `POST /session/:sessionId/join` body `{ sessionCode, displayName }` → returns `{ guestToken }`.
3. Sessions auto-expire 6 hours after creation. Server stores no playback content — only metadata (current title, current playback state) for late-join sync.
4. Rate limiting: per-IP, 60 messages/minute. Hard cap of 20 guests per session.
5. No persistence — in-memory only. If the relay restarts, all sessions die. That's fine for personal use.
6. CORS: locked to the Electron app's origin and the guest web app's origin.

**Technical approach.**
- Node.js + `ws` package (or `uWebSockets.js` if perf matters; `ws` is fine for 20 guests).
- ~200 lines of code total.
- Dockerfile + deploy to Railway free tier (or Fly.io). One-click GitHub auto-deploy.
- Env vars: `ALLOWED_ORIGINS`, `MAX_GUESTS_PER_SESSION`, `SESSION_TTL_HOURS`.

**Message schema** (JSON over WebSocket):

```
// Host → server → all guests
{ type: 'HOST_PLAY',  time: number, ts: number }
{ type: 'HOST_PAUSE', time: number, ts: number }
{ type: 'HOST_SEEK',  time: number, ts: number }
{ type: 'HOST_TITLE_CHANGE', title: { tmdbId, type, season?, episode?, source } }

// Guest → server → all (including host)
{ type: 'GUEST_CHAT',  displayName, message, ts }
{ type: 'GUEST_REACT', displayName, emoji, ts }
{ type: 'GUEST_HAND_RAISE', displayName, ts }

// Server → newly-joined guest only
{ type: 'STATE_SYNC', current: { title, time, playing }, guests: [{ displayName }] }
```

**Acceptance criteria.**
- [ ] `POST /session` returns a session in < 200ms.
- [ ] Host sends HOST_PLAY → all 5 connected guests receive it within 500ms.
- [ ] 21st guest is rejected with a clear error message.
- [ ] After 6h, session expires and new joins fail.

**Effort:** L (a weekend, including deploy setup).

---

### 6.2 Host UI — Session Creation & Sharing

**Problem.** The host needs a frictionless way to start a party and share access without typing URLs.

**Goal.** From any player screen, the host can start a party in one click and share via QR / link / code.

**UX.**
- New button in the player chrome: "Watch Party" (group icon).
- On click → modal opens with three tabs: **QR code**, **Link**, **Code**.
    - QR code tab: large QR encoding the join URL.
    - Link tab: shareable URL `https://party.movievault.app/join/{sessionId}` with "Copy" button.
    - Code tab: 6-char session code in large monospaced text, plus the join URL underneath.
- Modal also shows a live "Guests" list with displayName + small "Kick" button per guest.
- "End party" button in the modal corner. Confirmation prompt.
- Once a party is active, a persistent indicator pill ("Party · 3 guests") sits at the top of the app.

**Functional requirements.**
1. New component `<WatchPartyHostModal>` and `<WatchPartyIndicator>`.
2. Session creation calls relay's `POST /session`, stores `hostToken` in memory only (never persisted — restarting the app ends the party).
3. QR code generation: `qrcode` npm package, 256px.
4. Joining flow auto-published to guest web app — when a guest connects, the modal's "Guests" list updates live.
5. Kick: sends `{ type: 'HOST_KICK', guestId }` to the relay, which closes that guest's socket.
6. When the host changes title (clicks on a different movie/episode), broadcast `HOST_TITLE_CHANGE` so guests follow along.
7. Host playback events (play, pause, seek) are picked up from the existing player and rebroadcast via the WebSocket.

**Acceptance criteria.**
- [ ] Click "Watch Party" → modal opens with QR/link/code visible.
- [ ] Scan the QR with a phone → guest page opens in mobile browser.
- [ ] Guests list updates within 1s of a new join.
- [ ] Closing the app ends the party for all guests.

**Effort:** M.

---

### 6.3 Guest Web App

**Problem.** Guests need a way to watch in sync without installing anything. They have a browser; that's it.

**Goal.** A standalone web app at `party.movievault.app` that joins a session, plays the synced content, and provides chat/reactions.

**UX.**
- Landing page: large session-code input + "Join" button. URL with `/join/{sessionId}` skips this step.
- Display name prompt (stored in localStorage so future joins skip it).
- Watch view layout:
    - Center: video player (iframe to VidSrc / Videasy mirroring the host's source).
    - Right sidebar (collapsible on mobile): chat + reactions + guest list + "Raise hand" button.
- Reactions: floating emoji animation that drifts up from the bottom-right and fades.
- Chat: 50 most recent messages, scrollback locked unless the user scrolls up manually.
- Disconnect detection: if the host disappears, show a "Host disconnected — waiting…" overlay with a 60s timer before hard disconnect.

**Functional requirements.**
1. New repo / sub-package: `apps/party-guest/`. Vite + React, deploys to Vercel.
2. Shares zero code with the Electron app at first — copy what's needed (TMDB client, types) to keep deployment surface tiny. Later, refactor into a `packages/shared/` workspace if it's worth it.
3. Embeds the same iframe source the host is using. On `HOST_TITLE_CHANGE`, the iframe reloads with the new source.
4. Cross-origin caveat: the guest cannot directly observe the iframe's playback time. Sync is one-way — the guest's iframe receives a fresh `?t={time}` query parameter on each HOST_SEEK / HOST_PLAY, which most stream providers respect.
5. Tap-to-start overlay on first load (required by browser autoplay policies on mobile).
6. Mobile-first responsive design. Bottom-sheet chat panel on phones.
7. PWA manifest so it's installable, but no offline support needed.

**Acceptance criteria.**
- [ ] Open the join URL on phone, enter name → joins session within 3s.
- [ ] Host plays/pauses → guest's iframe play/pause matches within 2s.
- [ ] Host seeks → guest seeks to within ±3s of the host's position.
- [ ] Host changes title → guest's iframe reloads with the new content.
- [ ] Chat messages appear on all guests + host within 1s.

**Effort:** L.

---

### 6.4 Sync Protocol — Tolerances & Latency

**Problem.** Different guests have different latencies. Naïve "play at exactly time T" breaks because the message arrives at slightly different moments on each device.

**Goal.** A latency-compensated sync protocol that keeps guests within an acceptable drift window (±3s) without micromanaging.

**Functional requirements.**
1. Every host-originated playback message includes `ts: Date.now()` (host's clock) and the playback `time`.
2. Guests record the message arrival time and compute drift as `(arrivalLocal - ts) + (currentPlaybackTime - time)`.
3. If drift exceeds ±3s, the guest's iframe is reloaded with the corrected `?t={time}` parameter (this is the only sync mechanism cross-origin iframes allow).
4. Host can configure a "sync offset" in Settings (default +1.5s) — this delays the host's own playback by N seconds so guests have time to catch up. The host's player overlays a small "Party: +1.5s" indicator while the offset is active.
5. Periodic resync: every 30 seconds, host sends a `HOST_HEARTBEAT { time, ts }` so guests can correct drift even if no play/pause/seek happened.

**Acceptance criteria.**
- [ ] Five guests on different networks stay within ±3s of host over a 30-minute episode.
- [ ] Disabling the sync offset and trying again → drift becomes obvious; this confirms the offset is doing work.
- [ ] A guest that pauses locally is silently corrected on the next host event (no error, just resyncs).

**Effort:** M (the testing is the time-consuming part).

---

### 6.5 Chat, Reactions, Hand-Raise

**Problem.** A silent watch party isn't a party. Need lightweight social signals.

**Goal.** Three small social features that work across host and all guests.

**Functional requirements.**
1. **Chat:** displayName-only (no auth), max 200 chars per message, last 50 messages retained in session. Filter is a basic profanity allowlist toggle (off by default — it's your personal use).
2. **Reactions:** six preset emojis (❤️ 😂 😱 🔥 🤯 👏). Click sends a `GUEST_REACT`. All clients animate the emoji floating up from the player edge, fading after 2s. Throttled to 3 reactions per guest per 5s.
3. **Hand-raise:** one button. Sends `GUEST_HAND_RAISE`. The host (and all guests) sees a brief toast: "{displayName} raised their hand" — useful for "can we pause?" without typing.

**Acceptance criteria.**
- [ ] Send a chat from guest → appears on host within 1s.
- [ ] Reaction → emoji float animation on all clients.
- [ ] Hand-raise → toast appears on host.

**Effort:** S.

---

## 6. Updated out of scope

In addition to the v1 out-of-scope list:

- **Real-time video sync of host playback to guests** (i.e. streaming the host's actual screen). That's WebRTC mesh / SFU territory — separate project, far outside personal-use ROI. Iframe-with-time-param is the right tradeoff.
- **Voice chat during watch party.** Discord exists.
- **Persistent guest accounts.** Display name in localStorage is enough.
- **Native mobile guest app.** Web is fine and what guests will actually use.
- **Watch party scheduling / invites in advance.** A live link is the entire mechanism — no calendar needed.

---

## 7. Implementation order

Strict ordering. Do not reorder without a written reason in the CHANGELOG.

1. **4.1 Skeleton Loading System** — touches nearly every page, easier to do first before later features add more surfaces.
2. **4.3 Page Transitions & Card Hover** — depends on `<ContentCard>` being centralized; later features will use it.
3. **4.2 Hero Banner with Trailer Autoplay** — depends on `<ContentCard>` and TMDB videos endpoint.
4. **4.4 Rich Detail Pages** — depends on `<ContentCard>` and the TMDB `append_to_response` pattern.
5. **5.1 One Pace Data Layer** — self-contained; can start any time after v1 caching is in.
6. **5.2 One Pace Browse UI.**
7. **5.3 One Pace Player.**
8. **5.4 AniList Progress Mapping** — only if v1 §7.3 AniList Sync is already shipped.
9. **6.1 Relay Server** — deploy first; everything else in P6 needs a live relay to test against.
10. **6.2 Host UI.**
11. **6.3 Guest Web App.**
12. **6.4 Sync Protocol — Tolerances & Latency.**
13. **6.5 Chat, Reactions, Hand-Raise.**

---

## 8. Definition of done per phase

A phase is "done" when:

- All acceptance criteria for its features are checked.
- A smoke test exists for at least the happy path (Playwright for the Electron app; basic Cypress or Playwright for the guest web app).
- Settings have a corresponding toggle/config where applicable.
- README updated with new user-facing features.
- A CHANGELOG entry is written, including any known issues.
- App still launches and plays one movie + one TV episode + one anime episode + one One Pace episode without manual intervention.

---

## 9. Open questions (answer before starting each phase)

**P4:**
- Animation library: stick with framer-motion or use raw CSS for transitions? *Recommend: framer-motion since it's already a dep.*
- Reduced-motion strategy across the whole app — settle a single policy now, apply consistently.

**P5:**
- Where exactly does the One Pace data sheet live this month? Check the `onepace-stremio` repo's most recent commit for the current sheet ID/GIDs before starting; the One Pace team has changed this twice in the last two years.
- Subtitle renderer: `libass-wasm` vs `JASSUB`. *Recommend: JASSUB — actively maintained fork.*
- Resolution storage: per-arc or per-user-global? *Recommend: per-user-global, with a per-arc override.*

**P6:**
- Relay host: Railway vs Fly.io vs self-hosted on a Pi? *Recommend: Railway free tier; trivial to swap later.*
- Custom domain for guest app: do you own `movievault.app`? If not, `movievault-party.vercel.app` works fine.
- Should the watch party be **arc/episode-aware** for One Pace, or only support movies/TV? *Recommend: arc/episode-aware — One Pace will be the most fun party use case for you.*

---

*End of plan v2.*

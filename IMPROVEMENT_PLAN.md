# Improvement Plan — [YOUR_APP] (Streambert fork)

> **Status:** Draft v1 — personal-use roadmap
> **Scope:** Improvements to the existing Electron desktop app. PWA / mobile conversion is explicitly out of scope of this document (it's a separate project).
> **Audience:** You (single-developer, personal use) and any AI coding assistant executing this plan.

---

## 0. How to use this document

Each feature is written PRD-style: **Problem → Goal → UX → Functional Requirements → Technical Approach → Acceptance Criteria → Effort**.

Effort scale: **S** (≤ 1 evening), **M** (1–3 evenings), **L** (a weekend), **XL** (multiple weekends — avoid unless very high value).

Phases are intentionally ordered. **Do not skip ahead** — later phases assume groundwork from earlier ones (especially the failover queue and the storage migration).

---

## 1. Project context (one-paragraph recap)

The base project is an Electron + React/Vite client that aggregates TMDB (metadata) + VidSrc / videasy / 2Embed (streams) for movies/TV, and AniList + AllManga (scraped) for anime. Subtitles come from Wyzie. Downloads use a CLI sidecar + ffmpeg. The codebase is well-modularized along `pages/`, `components/`, `ipc/`, `utils/`. No tests. Documentation is sparse.

---

## 2. Guiding principles

These are deliberately stricter than a normal product to fight scope creep on a solo project.

1. **Personal use first.** Every feature must answer: "Will I use this every week?" If no, defer or drop.
2. **Don't break what works.** The app already streams reliably. Refactors must be incremental and behind feature flags where risky.
3. **Local-first.** No cloud sync, no accounts, no servers I have to maintain. Third-party integrations (Trakt, Discord, AniList) are opt-in extras, never required.
4. **Boring tech wins.** Prefer well-known libraries (Plyr, idb-keyval, electron-store) over rolling our own.
5. **One thing at a time.** Each PR/branch ships one feature from this doc end-to-end, including its acceptance criteria.

---

## 3. Priority overview

| Phase | Theme | Time budget | Why now |
|---|---|---|---|
| **P0** | Reliability foundations | ~1 week | Source breakage is the #1 thing that kills personal-use streaming apps. Hardening first prevents pain later. |
| **P1** | Player & playback UX | ~2 weeks | These are the features you'll feel every single watch session. |
| **P2** | Library & discovery | ~2 weeks | Makes the app feel like *yours*, not just a search box. |
| **P3** | Selective integrations | ~1 week (pick & choose) | Curated social/integration features that pay for themselves. Skip what you don't want. |
| **Cleanup** | Tech debt | Ongoing, ~10% time | Tests, docs, observability. |

---

## 4. P0 — Reliability Foundations

### 4.1 Source Failover Queue

**Problem.** When VidSrc returns 502 or the iframe shows a blank page, you currently have to manually click another source. This happens often enough to be annoying.

**Goal.** A watch attempt should automatically try every available source in order, with a bounded timeout, and surface a clear error only when all have failed.

**UX.**
- User clicks Play.
- A small inline status appears under the player: *"Loading from VidSrc…"* → fails → *"Trying videasy…"* → succeeds → status disappears.
- If all sources fail: a single error card with *Retry*, *Switch source manually*, and *Report broken* buttons.
- A small "source: VidSrc" pill near the player title (clickable to swap manually).

**Functional requirements.**
1. A `SourceQueue` module in `src/utils/sourceQueue.js` that takes `{ tmdbId, season?, episode? }` and yields source attempts in priority order.
2. Priority order configurable in Settings (drag-to-reorder list). Default: VidSrc → videasy → 2Embed.
3. Per-source timeout: 10 seconds default, configurable in Settings (5–30s).
4. "Failure" detection: iframe `onerror`, iframe load with empty body, or known error patterns in the loaded URL (e.g. redirect to error page).
5. Successful source is remembered per-title for 24 hours so re-opens skip dead sources.
6. A "Report broken" button writes a local log entry (no telemetry leaving the machine) that the user can review in Settings → Diagnostics.

**Technical approach.**
- Wrap the existing iframe mount logic in a controller class. Maintain a generator that yields the next source.
- Failure detection in the renderer: listen for the iframe `load` event with a content check, plus a hard timeout via `setTimeout`.
- Persist "last good source per title" in `electron-store` under `lastGoodSource.{tmdbId}.{seasonEpisode?}`.
- Status updates flow through a small Zustand or React Context store so the status pill and the error card can subscribe.

**Acceptance criteria.**
- [ ] Manually kill VidSrc in dev tools (block network) → app automatically falls over to videasy within 10s without user interaction.
- [ ] If all 3 sources are blocked → error card appears with the three buttons within 30s total.
- [ ] Re-opening the same title within 24h tries the last-good source first.
- [ ] Source order can be reordered in Settings and the change takes effect on next play.

**Effort:** M (2–3 evenings).
**Files likely to touch:** `src/components/Player*`, `src/utils/sourceQueue.js` (new), `src/pages/SettingsPage.jsx`, `src/ipc/storage.js`.

---

### 4.2 Error State System

**Problem.** When something breaks (API down, no internet, scraping failed, ffmpeg missing), the app's behavior is inconsistent — some places show a spinner forever, some silently fail.

**Goal.** Every async operation has a defined loading, empty, and error state, with a useful recovery action.

**Functional requirements.**
1. A reusable `<AsyncBoundary>` component wrapping `loading | error | empty | success` patterns with consistent UI.
2. All `ipc/` calls return a typed result `{ ok: true, data } | { ok: false, error: { code, message, retryable } }` — no thrown exceptions across the IPC boundary.
3. A central error code list in `src/utils/errors.js`: `NETWORK_OFFLINE`, `TMDB_RATE_LIMIT`, `SOURCE_UNAVAILABLE`, `SCRAPER_PARSE_FAIL`, `FFMPEG_MISSING`, `WYZIE_KEY_MISSING`, etc.
4. Network-offline detection via `navigator.onLine` + a banner across the top: *"You're offline — showing cached content"*.
5. Retry button on every error state. Exponential backoff on retries (1s, 2s, 5s, give up).

**Technical approach.**
- Refactor IPC handlers in `src/ipc/*.js` to never throw — wrap in try/catch and return the typed result.
- Build `<AsyncBoundary>` to take `state, onRetry, emptyComponent` props.
- Add the offline banner to the main layout.

**Acceptance criteria.**
- [ ] Turn off Wi-Fi → app shows offline banner; Library still loads from cache.
- [ ] Force TMDB to 429 (in dev, intercept fetch) → graceful error with retry; first retry backs off 1s.
- [ ] No more "infinite spinner" anywhere in the app (visually audit every page).

**Effort:** M.
**Files likely to touch:** All of `src/ipc/`, new `src/components/AsyncBoundary.jsx`, new `src/utils/errors.js`, layout component.

---

### 4.3 Request Caching Layer

**Problem.** TMDB metadata barely changes day-to-day. Re-fetching the same movie/TV detail every time wastes API quota and slows page loads.

**Goal.** Persistent cache for TMDB and AniList responses with sensible TTLs.

**Functional requirements.**
1. TMDB responses cached for 24 hours by default, 7 days for "stable" endpoints (genre lists, certifications).
2. AniList cached for 24 hours.
3. Cache backed by `electron-store` (or a small SQLite file via `better-sqlite3` if growth is a concern — start with electron-store, migrate only if needed).
4. Stale-while-revalidate: if cached entry exists, return it immediately, then refresh in background.
5. Cache-busting on user pull-to-refresh / manual refresh.
6. Cache size cap: 50 MB, LRU eviction.

**Technical approach.**
- A thin `cachedFetch(url, { ttl, key })` wrapper around the existing fetch calls.
- Persist to `electron-store` namespace `cache.*`.
- Background refresh uses a debounced queue so we don't hammer TMDB on app open.

**Acceptance criteria.**
- [ ] Open the same movie page twice within 24h → second open is instant (no spinner > 100ms).
- [ ] Force-refresh (Ctrl+R or pull) → fetches fresh data.
- [ ] Cache stays under 50 MB after a week of normal use.

**Effort:** M.

---

## 5. P1 — Player & Playback UX

### 5.1 Continue Watching Hub

**Problem.** Finding where you left off (especially mid-season of a TV show) requires navigating back into the title manually.

**Goal.** A "Continue Watching" carousel at the top of the home page that surfaces in-progress titles with one-click resume.

**UX.**
- Carousel above Trending on `HomePage`.
- Each card: poster, title, progress bar (% watched), and either *"Continue S2:E4 — 23m left"* or *"Resume from 1:14:22"*.
- Click → opens player at the saved timestamp.
- Long-press / right-click → "Remove from Continue Watching", "Mark as finished".
- Items disappear automatically when watched to ≥ 90% (TV → advances to next episode; movie → removed).

**Functional requirements.**
1. A `watchHistory` store in `electron-store` keyed by `{tmdbId, season?, episode?}` with `{ position, duration, lastWatchedAt, source }`.
2. Player writes position every 5 seconds while playing (debounced).
3. Continue Watching list = entries where `position / duration` is in `(0.05, 0.90)`, sorted by `lastWatchedAt` DESC.
4. Auto-progression for TV: when an episode hits 90%, the *next* episode replaces it in the list with position 0.
5. Max 20 entries in the list.

**Technical approach.**
- Add a `src/ipc/watchHistory.js` module.
- Hook the existing player's `timeupdate` event (whether iframe-based via postMessage or direct video element).
- For iframe sources where we can't reliably get position: fall back to "last opened" timestamp only, no progress bar.

**Acceptance criteria.**
- [ ] Watch 5 minutes of a movie, close app, reopen → movie appears in Continue Watching with correct progress.
- [ ] Watch an episode to credits → next episode appears in Continue Watching automatically.
- [ ] Long-press → Remove works.
- [ ] Iframe-only sources still appear in CW but without a progress bar.

**Effort:** M.

---

### 5.2 Subtitle Offset & Sync Controls

**Problem.** Subtitles from Wyzie are often a second or two off, especially on anime and re-cut Netflix content. You currently can't fix it in-app.

**Goal.** Live subtitle offset adjustment without re-downloading.

**UX.**
- During playback, hotkeys `G` / `H` shift subtitles -100ms / +100ms.
- `Shift+G` / `Shift+H` for ±1s.
- Small overlay in bottom-left appears for 2s when adjusting: *"Subtitle offset: -1.4s"*.
- Offset persists per-title.
- Settings → Playback → "Default subtitle offset" for global default (e.g. -200ms if your audio output has consistent lag).

**Functional requirements.**
1. Offset is applied client-side by transforming subtitle cue start/end times.
2. Persisted in `watchHistory` entry per title.
3. Reset button in the player's subtitle menu: *"Reset offset"*.

**Technical approach.**
- If we control a `<track>` element directly: easy — clone cues with adjusted times into a new track.
- If subtitles are inside the iframe (provider-rendered): we can't adjust them; in that case, prefer rendering subtitles ourselves over a transparent overlay. This may require switching anime playback to native `<video>` + extracted `.mp4` (already the case for AllManga).
- For iframe-only sources where overlay isn't possible: gracefully hide the feature.

**Acceptance criteria.**
- [ ] Press `G` 5× during anime playback → subtitles shift back 500ms visibly.
- [ ] Close and reopen episode → offset preserved.
- [ ] Reset works.

**Effort:** S–M (depends on player architecture).

---

### 5.3 Keyboard Shortcut Overhaul

**Problem.** Existing shortcuts are inconsistent. A power user (you) should be able to live in the app without touching the mouse.

**Goal.** A coherent, documented shortcut layer covering navigation, playback, and library actions.

**Proposed bindings (final list lives in the existing `KeyboardShortcutsModal`):**

| Context | Key | Action |
|---|---|---|
| Global | `Cmd/Ctrl+K` | Open search |
| Global | `Cmd/Ctrl+,` | Open settings |
| Global | `Cmd/Ctrl+L` | Jump to Library |
| Global | `Cmd/Ctrl+H` | Jump to Home |
| Global | `Esc` | Close modal / back |
| Player | `Space` / `K` | Play/pause |
| Player | `←` / `→` | Seek ±5s |
| Player | `J` / `L` | Seek ±10s |
| Player | `↑` / `↓` | Volume ±10% |
| Player | `M` | Mute |
| Player | `F` | Fullscreen |
| Player | `C` | Toggle subtitles |
| Player | `G` / `H` | Subtitle offset ±100ms |
| Player | `Shift+N` | Next episode |
| Player | `Shift+P` | Previous episode |
| Player | `S` | Skip intro (when available) |
| Library | `/` | Filter |
| Library | `1`–`5` | Switch category tab |

**Functional requirements.**
1. Centralized in `src/utils/shortcuts.js` as a context-aware map.
2. The existing `KeyboardShortcutsModal` is regenerated from this map (single source of truth).
3. Customizable in Settings (stretch).

**Effort:** S.

---

## 6. P2 — Library & Discovery

### 6.1 Smart Library

**Problem.** The library is a flat list. Once you've added 100+ titles, it's hard to navigate.

**Goal.** A library with categories, filtering, and saved views.

**UX.**
- Tabs/categories: *All, Movies, TV, Anime, Watching, Watchlist, Finished*.
- Filter bar: genre, year range, runtime, language, rating, source (with poster).
- Sort: recently added, recently watched, rating, year, title A–Z.
- Saved views: e.g. "Anime I haven't started" — save current filter set as a named view, pinned to the sidebar.

**Functional requirements.**
1. Status field added per library item: `watchlist | watching | finished` (auto-managed by Continue Watching logic but manually overridable).
2. Filter state lives in URL hash so views are bookmarkable.
3. Saved views stored in `electron-store`.

**Effort:** M.

---

### 6.2 Watch Stats Dashboard

**Problem.** No view into your own habits. Half-vanity, half-useful for "what was that anime I watched last summer?"

**Goal.** A Stats page summarizing what, when, and how much you've watched.

**UX (Stats page sketch).**
- Top: 4 stat cards — *Hours watched this month / Titles started / Titles finished / Longest streak*.
- Mid: bar chart of hours-per-week (last 12 weeks).
- Mid: top genres pie/donut.
- Bottom: "Recently finished" list, "Forgotten about" list (titles you started > 30 days ago and never returned to).

**Functional requirements.**
1. Derived entirely from `watchHistory` — no separate logging.
2. Recharts (already a common React choice) for charts.
3. Privacy: stats never leave the device. No "share" button (resist the urge).

**Effort:** M.

---

### 6.3 Advanced Search

**Problem.** The current search is fine for "I know the title". It's bad at discovery.

**Goal.** Search that handles typos, partial matches, and filter-driven discovery.

**Functional requirements.**
1. Fuzzy matching on local library (Fuse.js).
2. TMDB search with optional filters: year, genre, min rating, language.
3. Search history (last 20 queries) below the search box.
4. "Search inside this season" when viewing a TV show — filters episode titles.
5. Empty-state suggestions: "Trending this week", "Because you watched X".

**Effort:** M.

---

## 7. P3 — Selective Integrations (curated)

You said don't make it too complicated. So these are the **only three** integration features I'd green-light, ranked by personal-use ROI. Skip any you don't want — they're independent.

### 7.1 Trakt Sync ⭐ (highest ROI)

**Why.** Trakt is the de-facto open watch-history platform. Two-way sync gives you:
- A backup of your watch history that survives a reinstall.
- Cross-device awareness (if you ever watch on a TV via Plex/Infuse/etc).
- Recommendations and trending data.

**Functional requirements.**
1. OAuth flow opens in default browser → callback via custom protocol `streambert://trakt/callback` (Electron supports this natively).
2. On successful login, sync direction is configurable: *Push only*, *Pull only*, *Two-way*.
3. Sync triggers: on app launch, after each item finishes, and a manual *Sync now* button in Settings.
4. Mapping: TMDB ID → Trakt's TMDB lookup (one API call). Anime via AniList ID where Trakt supports it; otherwise fall back to title match (low confidence, flagged for user review).
5. Conflict resolution: most-recent-watched wins.

**Acceptance criteria.**
- [ ] Connect Trakt account, watch a movie to completion → it appears in Trakt within 60s.
- [ ] Disconnect/reconnect → existing local history is uploaded once (idempotent).

**Effort:** L. OAuth + sync logic + conflict handling.

---

### 7.2 Discord Rich Presence

**Why.** Fun, basically free, and gives the app a nice presence boost. People will ask what you're using.

**Functional requirements.**
1. Use `discord-rpc` npm package in the main process.
2. Show: *Watching [Title]* + season/episode + elapsed time. Poster as the large image (uses Discord's asset CDN, so we upload posters? Or use TMDB URL — needs check on Discord's image policy).
3. Off by default. Toggle in Settings → Privacy → "Show what I'm watching on Discord".
4. Auto-clears 1 minute after playback ends.

**Acceptance criteria.**
- [ ] Toggle on, start watching → Discord profile shows current title within 10s.
- [ ] Toggle off → presence clears immediately.

**Effort:** S.

---

### 7.3 AniList Sync (extends existing AniList usage)

**Why.** You're already pulling AniList for anime metadata. Pushing watch progress back closes the loop, and it gives anime watchers a real reason to use this app over a generic streamer.

**Functional requirements.**
1. OAuth via AniList's flow (similar to Trakt).
2. On episode completion (≥ 90%), increment progress in AniList for that anime.
3. On series completion, mark as "Completed" in AniList.
4. Status mapping: Watching → CURRENT, Watchlist → PLANNING, Finished → COMPLETED.
5. Off by default. Toggle in Settings → Integrations.

**Acceptance criteria.**
- [ ] Finish an episode → AniList progress increments by 1 within 60s.
- [ ] Mark a series as finished locally → AniList status updates to COMPLETED.

**Effort:** M.

---

## 8. Explicitly Out of Scope

Listing these so future-you doesn't get tempted.

- **Watch Together / WebRTC sync.** A real, separate app's worth of work. Skip unless you have a co-watcher lined up.
- **Mobile / PWA conversion.** Separate project. The iframe playback question (see prior research) needs answering first anyway.
- **Cloud sync (custom backend).** Trakt covers 90% of why you'd want this. No servers to maintain.
- **LLM "Vibe Search".** Cute, but TMDB's existing keyword + genre + "discover by mood" presets covers it for $0.
- **Built-in VPN / proxy.** Out of scope and a security maintenance burden.
- **Plugin/extension system.** Premature; revisit only if you have ≥ 3 concrete plugin ideas.
- **Recommendation engine beyond TMDB/Trakt's.** Don't reinvent.

---

## 9. Tech debt & cleanup

Run alongside everything else, ~10% of dev time.

1. **Smoke tests.** Playwright or Spectron-style: launch app, open a movie, assert player loads. Just enough to catch regressions.
2. **README expansion.** Real install instructions for each OS, screenshots, an architecture diagram (the `ipc/` ↔ renderer flow is non-obvious).
3. **Source-failure logging** (local file in userData). Aids in debugging when a source dies.
4. **TypeScript migration (incremental).** Start with `src/utils/` and the new error-result types. Don't migrate the whole app at once.
5. **Settings page audit.** It's grown organically. Reorganize into Playback / Sources / Library / Integrations / Privacy / About.
6. **Bundle size check.** Run `electron-builder` with `--analyze` once; trim anything obvious.

---

## 10. Suggested implementation order

This is the sequence I'd actually ship in. Don't reorder without good reason.

1. **4.2 Error State System** — sets the foundation. Touches the IPC layer. Best to refactor before adding more on top.
2. **4.3 Request Caching Layer** — small, isolated, immediate UX win.
3. **4.1 Source Failover Queue** — depends on 4.2's error result types.
4. **5.1 Continue Watching** — establishes the `watchHistory` store other features will use.
5. **5.3 Keyboard Shortcut Overhaul** — small, polish.
6. **5.2 Subtitle Offset** — uses watchHistory.
7. **6.1 Smart Library** — uses watchHistory for status field.
8. **6.3 Advanced Search.**
9. **6.2 Watch Stats** — purely derived from watchHistory.
10. **7.2 Discord RPC** — small, fun, ship anytime after Continue Watching is in.
11. **7.1 Trakt Sync** — biggest integration, ship after watch history is fully solid.
12. **7.3 AniList Sync.**

---

## 11. Definition of done per phase

A phase is "done" when:

- All acceptance criteria for its features are checked.
- A smoke test exists for at least the happy path.
- Settings have a corresponding toggle/config where applicable.
- README is updated with any new user-facing features.
- A short CHANGELOG entry is written.
- App still launches and plays one movie + one TV episode + one anime episode without manual intervention.

---

## 12. Open questions (answer before starting)

- **Direct stream extraction vs iframe?** Decision drives the player architecture. Iframe = simpler but can't do subtitle overlay / RPC time / accurate progress. Direct = more code but unlocks everything. Recommend: keep iframe as default, build direct extraction as a fallback toggle ("Experimental: native player") and migrate features over as it matures.
- **TypeScript or stay JS?** Recommend: stay JS for now, opt-in TS for new utility modules.
- **electron-store vs SQLite?** Start electron-store. Migrate to SQLite (via `better-sqlite3`) only when watchHistory exceeds ~5000 entries or queries get slow.
- **State management?** Currently looks like ad-hoc React state + IPC. As stores grow (watchHistory, library, settings, source state) consider Zustand. Don't reach for Redux.

---

*End of plan.*

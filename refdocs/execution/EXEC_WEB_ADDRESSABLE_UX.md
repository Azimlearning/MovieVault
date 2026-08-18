# EXEC — Addressable URLs, Player Chrome, and Playback Recovery (Web)

> Companion plan: [PLAN_WEB_ADDRESSABLE_UX.md](../plans/PLAN_WEB_ADDRESSABLE_UX.md)
> Status: Phases 1–4 complete 2026-08-18.

## Phase 1 — Addresses, chrome, recovery

### 1a. URL ↔ state mapping

- Added `apps/web/src/utils/router.js`: the single place that knows what a
  `{ page, selected }` pair looks like as a path, in both directions.
- Routes: `/`, `/library`, `/downloads`, `/settings`, `/one-pace`,
  `/movie/{id}/{slug}`, `/tv/{id}/{slug}?s=&e=`.
- A cold start produces a **stub** `selected` (`{ id, media_type }`).
  `MoviePage`/`TVPage` already fetch full details from `item.id` on mount, so a
  stub renders the real page.
- One Pace arcs resolve by slug only from the arc list, so a cold hit on
  `/one-pace/...` lands on the arc list rather than a broken player.

### 1b. History wiring (`App.jsx`)

- `navigate()` pushes a history entry; `navigateBack()` (and Ctrl+Z) now calls
  `history.back()`, so the browser Back button, the sidebar control and the
  mobile swipe-back gesture are all the same action.
- Full `selected` objects cannot round-trip through an address, so each entry's
  object is kept in a module-level `ROUTE_OBJECTS` map keyed by `history.state.mvIdx`.
  Back restores the exact object; a cold/unknown entry falls back to parsing the path.
- Replaced the `navStack` array with a `navDepth` counter (its only consumer was
  the sidebar's Back affordance).
- The initial entry is stamped with `mvIdx: 0` **without** rewriting the URL, so
  a shared link keeps its slug.
- `MoviePage`/`TVPage` name the tab once TMDB resolves, because a deep-linked
  stub has no title of its own.

### 1c. Player chrome

- Both pages now group MovieVault's own controls into left and right clusters
  (`.player-overlay-group` / `.player-overlay-group--right`). Previously every
  `.player-overlay-btn` was absolutely positioned at the same `top/right`, so
  ungrouped buttons stacked on top of each other.
- Fullscreen no longer hides the app's controls. The old rule
  (`.player-wrap--fullscreen .player-overlay-* { display: none }`) left the user
  inside a provider frame with no way to switch source or download.
- Added `@media (hover: none)` so the chrome is always visible on touch, where
  there is no hover state to reveal it with.

### 1d. Playback recovery

- Added `apps/web/src/utils/sourceHealth.js`: a no-cors probe that separates
  *unreachable* (promise rejects — DNS/ad blocker/ISP/VPN) from *reachable*
  (opaque response — so a blank player is an embed refusal). An abort is
  reported as unknown rather than blocked.
- Added `apps/web/src/components/PlayerTroubleBar.jsx`: after ~11s a quiet
  "Not playing?" pill expands into the diagnosis plus three actions — try
  another source, open in a new tab, dismiss. It never claims the video failed,
  because the parent page cannot see a cross-origin player's state.
- Mounted in both pages with `key` on source (and episode, for TV), so each load
  gets one fresh offer instead of resetting state inside an effect.

### Verification

- `cd apps/web && npm run build` — passes.
- `npx playwright test tests/web-smoke.spec.js` — 4 passed, including two new
  tests: URL/Back/Forward across screens, and a cold deep link landing on the
  movie page (proved by its own TMDB-auth error surface, since CI has no token).
- Manual Chromium check: `/library`, `/one-pace`, `/settings` addresses, Back
  and Forward restore, and `/movie/1061474/f1-the-movie` keeps its slug.
- ESLint rule-count comparison against HEAD: no new errors introduced.

## Rollback

- Routing: revert `utils/router.js` and the `App.jsx` navigate/popstate block;
  `{ page, selected }` state is otherwise untouched.
- Chrome: revert the two cluster wrappers in `MoviePage`/`TVPage` and the
  `.player-overlay-group--right` / fullscreen / `hover: none` CSS rules.
- Recovery: remove the `PlayerTroubleBar` mount in both pages.

## Phase 2 — Continuation and state-aware CTAs

### 2a. Post-play for films (`MoviePage`)

- An embedded provider never reports that a film ended, so the card is raised by
  the only completion signal the web build has: the user marking 100%.
- Renders over the player with three "More like this" titles from the already
  fetched `similar` results, plus a dismiss. Selecting one navigates straight
  into that title (teardown §6.5 — the end of a film becomes the start of a
  session rather than an exit point).
- Styles: `.post-play*` in `global.css`, including a narrow-viewport variant.

### 2b. State-aware primary CTAs

- `MoviePage`: the CTA now reads Play / **Resume · 1h 12m left** / Watch again /
  Restart, deriving remaining time from tracked seconds where available and from
  percentage against runtime otherwise.
- `TVPage`: the detail page had **no primary CTA at all** — every session began
  by hunting through the episode list. It now leads with
  **Resume S2:E4** / **Play S1:E1**, resolving the episode the user is midway
  through, else the first unwatched one in the selected season.
- `HeroBanner` (Home): receives `progress`/`watched` from `HomePage` and labels
  the hero button Play / Resume / Watch again. A series counts as started when
  any of its episodes has tracked progress.

### 2c. Deep-link slug canonicalisation

- `canonicaliseTitleSlug()` in `router.js` upgrades `/movie/1061474` to
  `/movie/1061474/f1-the-movie` once TMDB resolves the title, via
  `replaceState` — same history entry, so it never adds a Back step. A shared
  link that already carries a slug is left exactly as sent.

## Phase 3 — Pre-flight source reachability

- `pickReachableSource()` in `sourceHealth.js`: returns the first source whose
  origin actually answers, probing sequentially and capped at three, because a
  parallel burst hits providers we may never need on a connection already weak
  enough for one to be blocked.
- Both pages probe the chosen provider once playback starts. On a `BLOCKED`
  result they auto-switch to a reachable provider and say so through the
  existing feedback overlay ("Videasy is blocked here — switched to VidSrc").
- Guarded by `autoSwitchedRef`, reset per title, so the app never fights a
  user's manual source choice or loops between providers.
- This is the direct answer to the reported "refused to connect" reports: a
  network-level block is now routed around before the user sees a black frame,
  rather than after.

## Verification (all phases)

- `cd apps/web && npm run build` — passes.
- `npx playwright test tests/web-smoke.spec.js` — 4 passed.
- ESLint: the three new modules are clean; no new errors in the edited pages.

## Rollback

- Routing: revert `utils/router.js` and the `App.jsx` navigate/popstate block.
- Chrome: revert the cluster wrappers plus the `--right`, fullscreen and
  `hover: none` CSS rules.
- Recovery/probe: remove `PlayerTroubleBar`, `utils/sourceHealth.js`, and the
  probe effect in each page — each is self-contained.
- CTAs/post-play: revert `playLabel`, `resumeTarget`, the `postPlay` state, and
  the `HeroBanner` progress props.

## Phase 4 — Home rendering defects, search as a destination, nav diet

Driven by an external UX review of the deployed app. Every claim was checked
against the source before changing anything; one was under-diagnosed and one was
already built.

### 4a. Top Rated tiles (three defects, one cause)

`HeroQuickPicks` renders `.hero-quickpick-info/-title/-meta/-overlay`. **None of
those classes existed in the stylesheet** — only an older `.hero-quickpick-label`
did. So the text sat in normal flow at the top of the tile and the tile's
`::after` gradient painted straight over it. That single omission produced all
three reported symptoms: a card with "no title", titles running past the tile
edge, and `★9.22026` (no gap between the rating and the year). Added the missing
rules: absolute bottom-anchored info block, two-line clamp, a `·` separator via
`gap` plus a generated middot, and a single scrim instead of two stacked ones.

### 4b. The hero never goes black

The backdrop faded to `opacity: 0` the moment a trailer was *requested*, so a
slow or blocked YouTube embed left the largest element on the home screen empty.
The still frame now holds until the trailer iframe reports `load`. The backdrop
also dropped from `original` (multi-megabyte) to `w1280`.

### 4c. Home information architecture

- The genre wall moved **below** the content rows: browsing by genre is a
  low-frequency action and it was pushing Continue Watching and Recommended off
  the first screen.
- Genres are now a curated set of 17 (`CANONICAL_GENRES`). Merging TMDB's movie
  and TV lists by raw name had produced both "Action" and "Action & Adventure",
  both "Science Fiction" and "Sci-Fi & Fantasy", plus API artefacts nobody
  browses by — Soap, Talk, News, TV Movie.
- **Continue Watching already existed** and is already first in the default row
  order; the review's screenshot simply had no in-progress titles. Not rebuilt.
- Pinned is now a Home rail, ordered and hideable with every other row.
- Hero hierarchy cut from six levels to five: the quoted tagline and the synopsis
  were doing the same job. Synopsis contrast raised off `--text3` onto a
  shadowed near-white, which it needed over photographic backdrops.

### 4d. Search is a destination, not a modal

`SearchModal` is deleted. `pages/SearchPage.jsx` is a full-canvas route at
`/search?q=`, so a search can be reloaded, shared and returned to (the query is
synced with `replaceState`, keeping keystrokes out of the Back stack).

- Empty state is a browse surface: recent searches as **removable chips**, then
  a real poster grid of top searches — the same `MediaCard` as everywhere else.
- Results are a poster grid with section headers, a **People** row of circular
  avatars (previously people were filtered out entirely), and related-genre chips
  that turn a dead-end query into a browse path.
- Scope toggle **All / My Library** replaces the second search box that used to
  live on the Library page. One search, two scopes.
- Recent searches now drop any stored term the new one starts with, so the
  keystrokes on the way to a word ("wan", "darede", "daredevi") stop accumulating.

### 4e. Sidebar diet

Down from 211 lines to ~95: the pinned thumbnail list, its drag-to-reorder
handlers and its context menu are gone. Seven nav items, no content. `⌘F` is
retired; `⌘K` is the single global search key and is labelled in the sidebar and
the shortcuts modal.

### Verification (Phase 4)

- `npm run build` passes; 5/5 Playwright smoke tests, two rewritten and one new
  (sidebar carries no pinned list).
- Local Chromium: `/search?q=matrix` cold-loads with the query in the input,
  sidebar shows exactly Home/Search/Library/Downloads/One Pace + Help/Settings.
- ESLint: no new errors. Removing the pinned list also cleared two dead props.

### Not done, and why

- **Full-width hero / two-column split.** The review called the right column
  dead space. The quick-picks column is a deliberate part of the app's visual
  identity and stretches with the hero; rebuilding it is a redesign, not a fix,
  and belongs in a plan of its own.

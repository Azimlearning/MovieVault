# EXEC — Native Ad-Free Player (Direct Stream Extraction)

> **Companion plan:** `refdocs/plans/PLAN_NATIVE_PLAYER.md`
> **Status at authoring (2026-07-08):** Not started. Interim mitigation (Pop-up Shield source preference) shipped separately. Do Phase 0 before committing to the rest — if extraction success rates are bad, the plan gets rescoped, not pushed through.

---

## Phase 0 — Provider spike (gate for everything else)

**Files:** scratch only — nothing merged.

**Steps:**
1. In a scratch Vite app (or a dev-only route), install `@p-stream/providers` (fall back to the `movie-web-rip/pstream-providers` rip if the npm package is gutted) and `cinepro-org/core`.
2. Stand up a local copy of movie-web `simple-proxy` (`npx` it or run its Vercel dev target) for the fetches that need CORS bypass.
3. Run extraction against ~20 titles: 10 popular movies, 5 recent movies, 5 TV episodes. Record per-provider: success rate, time-to-stream, HLS vs MP4, captions availability.
4. Verify at least one extracted HLS stream actually plays in a bare hls.js `<video>` (not just that a URL comes back — dead links count as failures).
5. Write the results table into this doc; pick the provider lib (plan §6.1) and proxy runtime (§6.2).

**Checkpoint:** a documented success-rate table and a go/no-go decision. Go = ≥70% of the popular-movie set plays. No-go = stop here, plan gets revisited.

**Rollback:** n/a — nothing merged.

---

## Phase 1 — Scrape proxy

**Files:** `apps/web/api/scrape-proxy.js` (Vercel serverless, assuming §6.2 lands on Vercel), `apps/web/vercel.json` if headers/config needed.

**Steps:**
1. Adapt simple-proxy: forward method/headers/body to a `?destination=` URL, return response with permissive CORS toward our own origin only.
2. Hard allowlist of destination hosts (the provider domains from Phase 0); 403 anything else. Basic per-IP rate limit (in-memory is fine at Hobby scale).
3. Never follow/serve media content-types (`video/*`, `application/vnd.apple.mpegurl` bodies beyond a size cap) — proxy is for HTML/JSON scraping requests only.

**Checkpoint:** plan acceptance §5.4 — non-allowlisted target curls get 403; an allowlisted scrape returns upstream body with CORS headers.

**Rollback:** delete the function — nothing else depends on it yet.

---

## Phase 2 — Provider wrapper + native source entry

**Files:** new `apps/web/src/utils/nativeProviders.js`; `apps/web/src/utils/api.js` (add `native` pseudo-source); `apps/web/src/utils/sourceQueue.js`.

**Steps:**
1. `nativeProviders.js`: thin interface `extractStream({ type, tmdbId, season, episode }) → { streamUrl, kind: "hls"|"mp4", qualities, captions } | null`, wrapping the chosen lib (lazy `import()` so it code-splits). All lib-specific types stay inside this file.
2. `PLAYER_SOURCES`: add `{ id: "native", label: "MovieVault Player", tag: "AD-FREE", async: true, sandbox: n/a }` — reuses the existing async-source machinery (AllManga already resolves URLs asynchronously, so the pages know this pattern).
3. `sourceQueue.getQueue`: `native` first when enabled; existing embed order after it (automatic fallback = the failover queue we already have).
4. Settings: "Native player (beta)" toggle in Video Sources section, default ON once Phase 4 QA passes, OFF while beta.

**Checkpoint:** with the toggle on, playing a Phase-0-known-good title logs a successful extraction and hands a stream URL to the player layer (player itself lands in Phase 3; a temporary `<video src>` smoke test is fine here).

**Rollback:** feature-flagged by the toggle; `native` entry can be removed from `PLAYER_SOURCES` without touching embed paths.

---

## Phase 3 — Native player component + page integration

**Files:** new `apps/web/src/components/NativePlayer.jsx`; `apps/web/src/pages/MoviePage.jsx`, `TVPage.jsx`.

**Steps:**
1. Generalize `OnePacePlayer.jsx` (already a full custom `<video>` UI — controls, subtitle `<track>`s, up-next, progress saving, touch-to-reveal) into `NativePlayer.jsx` taking `{ streamUrl, kind, qualities, captions }`.
2. hls.js (lazy `import()`) for `kind: "hls"`; plain `<video src>` for `"mp4"`.
3. In MoviePage/TVPage: when `native` source is active, call `extractStream`; on a resolved stream render `NativePlayer`, on `null`/playback error auto-fall-through to the existing embed iframe path with a visible "using embed source" note.
4. Wire native `timeupdate` into the existing `saveProgress` / Continue Watching path — finally replaces the iframe-can't-be-inspected progress guesswork for native playback.
5. Mobile: inherit the One Pace player's touch-to-reveal controls + 44px targets already added this session.

**Checkpoint:** plan acceptance §5.1–5.3 pass on desktop + one real mobile device — a movie plays start to finish with zero popups, extraction failure falls back within ~10s, native progress feeds Continue Watching.

**Rollback:** remove the `native` entry from `PLAYER_SOURCES` — everything reverts to embeds, no data migration.

---

## Phase 4 — Polish & docs

**Steps:**
1. Code-split hls.js + provider lib so they load only on first native playback (acceptance §6).
2. DECISIONS.md ADR: native-extraction architecture + the proxy-never-carries-video-bytes rule.
3. Update `feature_parity.md` (native player is web-first — unusually ahead of Electron here).
4. CHANGELOG.
5. Decide open questions §6.3 (anime folded into provider layer?) and §6.4 (Watch Party native seekable clock) — likely their own follow-up plans.

**Checkpoint:** all plan acceptance criteria checked.
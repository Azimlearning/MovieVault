# EXEC — Native Ad-Free Player (Direct Stream Extraction)

> **Companion plan:** `refdocs/plans/PLAN_NATIVE_PLAYER.md`
> **Status (2026-07-08):** ⛔ **Phase 0 spike run — NO-GO on the public library path.** `@movie-web/providers@2.4.13` (the only publicly installable option) resolved **0 / 20** titles. Phases 1–4 are **not started and should not start** on this library. See the results and the branching decision below. Branch `native-player` holds this finding; not merging player/proxy code.

---

## Phase 0 — Provider spike (gate for everything else) ⛔ DONE — NO-GO

**What was actually tested**
- `@p-stream/providers` / `@plink/providers` / a pstream custom registry: **not published** — all 404 on npm. P-Stream close-sourced their scrapers (confirmed by the research and by the empty registry). The `movie-web-rip/pstream-providers` "rip" is a source repo, not a maintained npm package.
- `@movie-web/providers@2.4.13` **is** on npm but **`latest` is frozen at 2025-04-27** (~15 months stale as of this spike) — it's the last public release before the fork went private. This was the realistic candidate, so the spike ran against it.
- Harness: Node script, `targets.NATIVE` (direct HLS/MP4 only — what our own player needs), `runAll` across all 14 built-in sources + 43 embed resolvers, per-request 15 s + per-title 45 s timeouts. CORS is browser-only so Node measures the raw extraction ceiling, independent of the proxy question. (`scratchpad/provider-spike/spike.mjs`.)
- **Harness gotcha fixed before trusting results:** `makeStandardFetcher(fetch)` throws `Expected signal to be an instance of AbortSignal` under Node/undici — the lib ships a foreign AbortController. Wrapped fetch to substitute a fresh Node-native AbortController per request. After the fix, requests genuinely went out (several titles ran the full source list to completion in 36–42 s), so the 0/20 is a real result, not the earlier harness bug.

**Results — 20 titles (15 movies, 5 TV S1E1), 2026-07-08**

| Set | Resolved | Rate |
|---|---|---|
| Popular/recent movies | 0 / 15 | 0% |
| TV episodes | 0 / 5 | 0% |
| **Total** | **0 / 20** | **0%** |
| HLS streams | 0 | — |
| With captions | 0 | — |

Outcome per title was a mix of **"no stream"** (all 14 sources tried, none returned a playable link — e.g. Inception, Parasite, Moana 2, Breaking Bad, Game of Thrones) and **45 s title-timeout** (slow/dead hosts eating the budget). An events-level probe showed the underlying source failures: `8stream` → "No providers available", `whvxMirrors` → "Failed to search" (their API), most others → dead hosts / network timeouts. This is exactly the "public scrapers rot after abandonment" outcome the research warned about — the source/embed network this 2025 snapshot points at is largely gone in mid-2026.

**Checkpoint:** ⛔ Gate was "≥70% of popular movies play." Actual **0%**. **NO-GO on `@movie-web/providers`.**

**Rollback:** n/a — nothing merged; spike lives in `scratchpad/` only.

### Decision & where this leaves the plan
The *architecture* in `PLAN_NATIVE_PLAYER.md` (client-side extraction → own `<video>` player) is still the only real ad-free path and remains sound — **what failed is the specific open-source provider library**, not the idea. But no maintained, publicly-installable extractor exists right now: P-Stream (the leading successor) went closed-source precisely because public scrapers get patched, and the last open snapshot is dead.

Realistic options, in rough order of effort/payoff:
1. **Shelve the build; keep embeds + Pop-up Shield (current `main`).** Lowest effort, already shipped. The honest default given the spike.
2. **Re-run the spike against `cinepro-org/core`** (a separate, still-maintained multi-site scraper — not yet tested because option-1 evidence was already decisive for the movie-web path). Worth a short follow-up spike before fully shelving — it's the one untested candidate that claims active maintenance.
3. **Write & self-maintain 2–3 scrapers ourselves** against currently-live hosts. Highest ongoing cost (they break weekly); only sensible if this becomes a primary product goal.
4. **Revisit if/when P-Stream or a successor re-opens** a maintained provider package.

**Recommended next step:** a single follow-up spike on `cinepro-org/core` (option 2) reusing `spike.mjs`; if it also lands near 0%, shelve to option 1 and treat Pop-up Shield as the standing answer. Do **not** build Phases 1–4 until a spike clears the ≥70% gate.

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
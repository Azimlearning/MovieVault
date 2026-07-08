# PLAN — Native Ad-Free Player (Direct Stream Extraction)

> Status: **On hold — Phase 0 spike returned NO-GO (2026-07-08).** The architecture below is sound, but the only publicly-installable extractor (`@movie-web/providers@2.4.13`, a frozen April-2025 snapshot) resolved 0/20 titles — its scraper network is dead and P-Stream's successor is closed-source. See `EXEC_NATIVE_PLAYER.md` Phase 0 for the results and options. One untested candidate remains (`cinepro-org/core`) before this is fully shelved.
> Target codebase: **Web app** (`apps/web/src/`) on `main`; Electron can adopt later (it has fewer constraints, not more)
> Companion execution doc: `refdocs/execution/EXEC_NATIVE_PLAYER.md`

---

## 1. Goal

Kill embed ads at the root. Today every movie/TV title plays inside a third-party embed iframe (Videasy/VidSrc/2Embed). Those embeds monetize with popunder ads — on Videasy (our default and best source), **every click on play/pause opens a new ad tab**, and because Videasy actively refuses to run in a sandboxed iframe (ADR-013), the browser's popup blocking cannot be applied to it. A parent page has no API to stop `window.open()` inside an unsandboxed cross-origin iframe — this is a hard platform boundary, not a missing feature.

The only real fix is the one the leading open-source projects use: **don't embed the player — extract the raw video stream (HLS/MP4) client-side and play it in our own `<video>` player.** No third-party page = no third-party scripts = zero ads, plus we finally get full control: native progress tracking (no more iframe-can't-be-inspected hacks), our own V3-styled controls, subtitles, AniSkip, and working Watch Party time sync.

## 2. Prior art (what we can copy)

- **movie-web → P-Stream** ([p-stream org](https://github.com/p-stream), [providers docs](https://providers.pstream.mov/)) — the reference architecture. Static site, **all scraping runs in the client**, streams play in the site's own player via hls.js. Their `@movie-web/providers` → `@p-stream/providers` library is exactly the "extract a playable stream URL from provider X for TMDB id Y" machine we need. Caveat found in research: newer P-Stream scrapers are being **close-sourced** (scrapers get patched when public), but the library and older provider set remain open; a public rip exists at [movie-web-rip/pstream-providers](https://github.com/movie-web-rip/pstream-providers).
- **cinepro-org/core** ([github](https://github.com/cinepro-org/core)) — open-source multi-site scraper claiming 50+ playable sources per title; an alternative/supplementary provider pool.
- **movie-web `simple-proxy`** — tiny serverless CORS proxy (Cloudflare Workers/Vercel targets) that the providers library needs for fetches blocked by CORS. Key design rule worth copying verbatim: **only scraping requests go through the proxy, never video bytes** — streams that are CORS-open play direct, so proxy bandwidth stays negligible (fits Vercel Hobby).
- **hls.js** — the standard MSE-based HLS playback library; our One Pace player already proves we can run a fully custom `<video>` player UI (controls, subtitles, progress) in this codebase.

## 3. Scope

### In
- New `nativePlayer` capability in the web app: given `{type, tmdbId, season?, episode?}`, run provider extraction → get `{ stream (hls/mp4), qualities, captions }` → play in a custom player component.
- Provider layer: evaluate `@p-stream/providers` (or the rip) and cinepro-core; wrap behind our own thin interface so the library can be swapped when scrapers rot.
- `scrape-proxy` serverless function on our Vercel project (adapted from simple-proxy), with an allowlist + rate limit so it can't be abused as an open proxy.
- Player component: reuse/generalize the One Pace player (`OnePacePlayer.jsx`) — it already has controls, subtitle tracks, up-next, progress saving.
- Integration: "Native" appears as a **new first entry in the existing source system** (`PLAYER_SOURCES`-level), with the current embeds kept as fallback when extraction fails — extraction success rates are never 100%.
- Native progress tracking replaces the iframe guesswork when native source is active.

### Out
- Ripping ads out of the embeds themselves (impossible, see §1) — interim mitigation is the Pop-up Shield setting (shipped separately).
- Downloads/offline (Electron already has yt-dlp; web stays streaming-only).
- Debrid/torrent sources.
- Electron port (follow-up; trivially easier since it has no CORS).

## 4. Constraints

- **Vercel Hobby limits:** proxy must never carry video bytes; scraping requests only. Function invocations are cheap; bandwidth is not.
- **Scraper rot is the steady state:** provider libraries break weekly. The architecture must treat extraction as best-effort with clean fallback to embeds, and the provider lib must sit behind our own interface for swapability.
- **Legal posture unchanged:** same content, same third parties — we host nothing; extraction happens client-side like P-Stream.
- No new heavyweight UI deps; hls.js (~"70KB gzip) is the one new runtime dependency, ideally lazy-loaded only when native playback starts.

## 5. Acceptance criteria

1. A popular movie plays start-to-finish in the native player with **zero** new tabs/popups across play/pause/seek/fullscreen.
2. Extraction failure (dead scrapers, unlisted title) falls back to the embed queue automatically within ~10s, with a visible "using embed source" indicator.
3. Progress bar/resume works natively (no iframe polling) and feeds the existing Continue Watching row.
4. Proxy deployed with allowlist; a direct `curl` to it with a non-allowlisted target returns 403.
5. Mobile: native player controls usable at 360px, fullscreen works on Android Chrome + iOS Safari.
6. Bundle: hls.js and the provider lib are code-split and load only on first native playback.

## 6. Open questions

1. **Provider lib choice:** `@p-stream/providers` (battle-tested, partially close-sourcing) vs the public rip vs cinepro-core vs writing 2–3 scrapers ourselves. Needs a spike (EXEC Phase 0) measuring real success rates on ~20 popular titles.
2. **Proxy runtime:** Vercel serverless function (same project, zero extra accounts) vs Cloudflare Worker (simple-proxy's native target, better cold starts). Default assumption: Vercel function.
3. **Anime:** AllManga async flow stays as-is initially, or gets folded into the provider layer?
4. **Watch Party:** native playback finally gives guests/host a real seekable clock — worth wiring into the relay protocol in the same effort, or later?

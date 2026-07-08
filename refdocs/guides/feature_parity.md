# Feature Parity — Electron vs Web App

> Tracks which Electron V2 features are present and working in `apps/web/src/`.
> Update this whenever a feature is ported or confirmed working/broken.
>
> **Legend:** ✅ Done | 🔄 In Progress | ❌ Missing | ⚠️ Partial / Stubbed

---

## Components

| Component | Electron (`src/`) | Web (`apps/web/src/`) | Notes |
|-----------|-------------------|----------------------|-------|
| `HeroBanner` | ✅ | ✅ | Ported, V3-restyled (`92c5b95`) |
| `CastRow` | ✅ | ✅ | Ported, V3-restyled |
| `SimilarRow` | ✅ | ✅ | Ported, V3-restyled |
| `RatingBadge` | ✅ | ✅ | Ported, V3-restyled |
| `HeroQuickPicks` | ✅ | ✅ | New in V3 — ported directly, no Electron-specific code to strip |
| `GenreBrowser` | ✅ | ✅ | New in V3 — identical logic in both |
| `MediaCard` + InfoPopout | ✅ | ✅ | Ported |
| `TrendingCarousel` | ✅ | ✅ | Ported |
| `TrailerModal` | ✅ | ✅ | Ported |
| `SearchModal` | ✅ | ✅ | Ported |
| `Sidebar` | ✅ | ✅ | Ported |
| `WindowTitlebar` | ✅ | ⚠️ | Web version exists but minimize/maximize/close are no-ops |
| `SetupScreen` | ✅ | ✅ | Ported — uses localStorage via polyfill |
| `AsyncBoundary` | ✅ | ✅ | Ported |
| `ErrorBoundary` | ✅ | ✅ | Ported |
| `Icons` | ✅ | ✅ | Ported |
| `SubtitleDownloaderModal` | ✅ | ⚠️ | Exists but `getSubtitleUrl` / `downloadSubtitlesForFile` return errors on web |
| `DownloadModal` | ✅ | ⚠️ | Exists but `getDownloads` always returns `[]` on web |
| `UpdateModal` | ✅ | ⚠️ | Exists but `downloadAndInstallUpdate` returns error on web |
| `WyzieKeyModal` | ✅ | ✅ | Ported — key stored in localStorage |
| `BlockedStatsModal` | ✅ | ⚠️ | Exists but `getBlockStats` returns `{total:0}` on web |
| `CloseConfirmModal` | ✅ | ⚠️ | Exists but close confirmation IPC is no-op on web |
| `KeyboardShortcutsModal` | ✅ | ✅ | Ported |
| `OnePacePlayer` | ✅ (webview) | ✅ | Web version is a from-scratch native HTML5 `<video>` player (not a webview port) — same controls/UX, V3-restyled, touch-to-reveal-controls added for mobile |
| `WatchPartyHostModal` | ✅ | ❌ | Not ported — hosting is Electron-only; open question (see `refdocs/plans/PLAN_WEB_V3_POLISH.md` §5.1) whether web should ever host |
| `WatchPartyIndicator` | ✅ | ❌ | Not ported |
| **Skeleton components** | ✅ | ❌ | `skeletons/` subfolder missing from web; no shimmer loading. Still open — see `refdocs/execution/EXEC_WEB_V3_POLISH.md` Phase 2 |

---

## Pages

| Page | Electron | Web | Notes |
|------|----------|-----|-------|
| `HomePage` | ✅ | ✅ | Ported, V3-restyled — hero cluster + genre browser + Bento grid default |
| `MoviePage` | ✅ | ✅ | Ported |
| `TVPage` | ✅ | ✅ | Ported |
| `LibraryPage` | ✅ | ✅ | Ported — localStorage-backed |
| `SettingsPage` | ✅ | ✅ | Ported — some settings are no-ops on web |
| `DownloadsPage` | ✅ | ⚠️ | Exists but always shows empty (downloads stubbed) |
| `OnePacePage` | ✅ | ✅ | Ported, V3-restyled — saga chips now use `.genre-tag`, responsive arc grid |
| `OnePaceArcPage` | ✅ | ✅ | Ported, V3-restyled — responsive details grid, mobile episode-row stacking |

---

## Features / Capabilities

| Feature | Electron | Web | Notes |
|---------|----------|-----|-------|
| TMDB metadata (movies, TV) | ✅ | ✅ | Works via proxy route on web |
| Search | ✅ | ✅ | |
| Library (save/unsave) | ✅ | ✅ | electron-store vs localStorage |
| Watch progress tracking | ✅ | ✅ | localStorage on web |
| Trailer autoplay (HeroBanner) | ✅ | 🔄 | YouTube iframe — works but mute/unmute postMessage may be blocked cross-origin |
| Page transitions (fade+slide) | ✅ | ✅ | CSS-based, same in both |
| Card hover InfoPopout | ✅ | ✅ | |
| Skeleton loading | ✅ | ❌ | No skeleton components in web app |
| Error states (AsyncBoundary) | ✅ | ✅ | |
| Offline detection banner | ✅ | ✅ | |
| External player (mpv) | ✅ | ❌ | Native only |
| File downloads (yt-dlp) | ✅ | ❌ | Native only |
| Subtitle download (Wyzie) | ✅ | ❌ | Returns error stub on web |
| Subtitle display (in-player) | ✅ | ❌ | Depends on native player |
| One Pace player | ✅ (webview) | ✅ | Native `<video>` on web, ported and V3-restyled — not blocked on webview parity |
| Watch Party (host) | ✅ | ❌ | Not ported; relay server also undeployed |
| Watch Party (guest) | ✅ | ✅ | `apps/party-guest/` — V3-restyled, iframe sandbox hardened against ad tab-hijacking, sync throttled to explicit seeks only. Host is still Electron-only and the relay server is undeployed, so guest join only works while an Electron host is running the relay-connected session. |
| Auto-update | ✅ | ❌ | Electron only |
| Discord Rich Presence | ✅ | ❌ | Electron only |
| PiP (Picture-in-Picture) window | ✅ | ❌ | Electron only |
| Ad-block stats | ✅ | ⚠️ | Stats always return 0 on web |
| TMDB language setting | ✅ | ✅ | localStorage in both |
| Appearance / theme settings | ✅ | ✅ | CSS vars, same in both |
| Backup / restore library | ✅ | ⚠️ | Backup IPC is no-op on web |
| OAuth flow | ✅ | ⚠️ | Stubbed on web (`startOauthServer` no-op) |
| Zoom factor | ✅ | ❌ | Electron `setZoomFactor` only |
| AniSkip (intro skip) | ✅ | ⚠️ | API calls work; skip action depends on player |

---

## Port Priority (suggested order)

1. **Skeleton loading** — high visibility, pure UI, no Electron dependencies. Still the top open item.
2. ~~HeroBanner / CastRow / SimilarRow / RatingBadge~~ — done (V3 port, `92c5b95`)
3. ~~One Pace~~ — done (native `<video>` player, not a webview port; V3-restyled)
4. **Watch Party host** — blocked on relay server deployment; guest side is ported and V3-restyled, host still needs a decision (see plan §5.1) on whether web should host at all

---

*Last updated: 2026-07-08*

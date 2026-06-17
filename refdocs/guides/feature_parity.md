# Feature Parity — Electron vs Web App

> Tracks which Electron V2 features are present and working in `apps/web/src/`.
> Update this whenever a feature is ported or confirmed working/broken.
>
> **Legend:** ✅ Done | 🔄 In Progress | ❌ Missing | ⚠️ Partial / Stubbed

---

## Components

| Component | Electron (`src/`) | Web (`apps/web/src/`) | Notes |
|-----------|-------------------|----------------------|-------|
| `HeroBanner` | ✅ | 🔄 | Web version exists, being updated to match V2 |
| `CastRow` | ✅ | 🔄 | Web version exists, being updated |
| `SimilarRow` | ✅ | 🔄 | Web version exists, being updated |
| `RatingBadge` | ✅ | 🔄 | Web version exists, being updated |
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
| `OnePacePlayer` | ✅ | ❌ | Uses Electron `<webview>` — no browser equivalent |
| `WatchPartyHostModal` | ✅ | ❌ | Not ported |
| `WatchPartyIndicator` | ✅ | ❌ | Not ported |
| **Skeleton components** | ✅ | ❌ | `skeletons/` subfolder missing from web; no shimmer loading |

---

## Pages

| Page | Electron | Web | Notes |
|------|----------|-----|-------|
| `HomePage` | ✅ | 🔄 | Exists; HeroBanner + trending layout being updated |
| `MoviePage` | ✅ | ✅ | Ported |
| `TVPage` | ✅ | ✅ | Ported |
| `LibraryPage` | ✅ | ✅ | Ported — localStorage-backed |
| `SettingsPage` | ✅ | ✅ | Ported — some settings are no-ops on web |
| `DownloadsPage` | ✅ | ⚠️ | Exists but always shows empty (downloads stubbed) |
| `OnePacePage` | ✅ | ❌ | Not ported |
| `OnePaceArcPage` | ✅ | ❌ | Not ported |

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
| One Pace player | ✅ | ❌ | webview only |
| Watch Party (host) | ✅ | ❌ | Not ported; relay server also undeployed |
| Watch Party (guest) | ✅ | ❌ | Guest app exists (`apps/party-guest/`) but host is undeployed |
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

1. **Skeleton loading** — high visibility, pure UI, no Electron dependencies
2. **HeroBanner / CastRow / SimilarRow / RatingBadge** — already in progress
3. **One Pace** — requires replacing `<webview>` with `<iframe>` + CORS handling
4. **Watch Party** — blocked on relay server deployment; port after P6 is deployed

---

*Last updated: 2026-06-17*

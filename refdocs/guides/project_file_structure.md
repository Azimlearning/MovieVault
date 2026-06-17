# Project File Structure — MovieVault

> Keep this up to date when adding or removing significant files.
> For the two-codebase split, see [CLAUDE.md](../../CLAUDE.md).

---

## Root (Electron app host)

```
MovieVault/
├── index.js              # Electron main process — creates BrowserWindow, registers all IPC handlers
├── preload.js            # Electron preload — exposes window.electron bridge to renderer
├── popout-preload.js     # Preload for PiP/popout player window
├── index.html            # HTML shell for the Electron renderer
├── vite.config.js        # Vite config for Electron build (manual chunks, base:"./")
├── package.json          # Root: Electron + electron-builder scripts
├── .env                  # TMDB credentials (never committed — see env_setup.md)
├── download_config.ini   # yt-dlp / download tool config
├── vercel.json           # Vercel SPA rewrite rule (for party-guest deep links)
└── run-dev.bat           # Windows convenience script for dev mode
```

---

## Electron App — `src/`

> The full-featured desktop app. Has access to the full `window.electron` API.

```
src/
├── main.jsx              # React entry point — mounts <App />, imports global CSS
├── App.jsx               # Root component — routing, sidebar, page transitions, SetupScreen gate
│
├── components/
│   ├── HeroBanner.jsx        # Full-width rotating hero with trailer autoplay (YouTube iframe)
│   ├── CastRow.jsx           # Horizontal scrollable cast card row
│   ├── SimilarRow.jsx        # Horizontal scrollable similar titles row
│   ├── RatingBadge.jsx       # TMDB / age rating badge
│   ├── MediaCard.jsx         # Grid card with InfoPopout hover overlay
│   ├── TrendingCarousel.jsx  # Home page trending horizontal carousel
│   ├── TrailerModal.jsx      # Full-screen trailer player modal
│   ├── SearchModal.jsx       # Global search overlay
│   ├── Sidebar.jsx           # Left nav sidebar
│   ├── WindowTitlebar.jsx    # Custom Electron titlebar (minimize/maximize/close)
│   ├── OnePacePlayer.jsx     # One Pace episode player (webview-based)
│   ├── WatchPartyHostModal.jsx   # Watch party host setup modal
│   ├── WatchPartyIndicator.jsx   # Active watch party status indicator
│   ├── DownloadModal.jsx     # yt-dlp download queue UI
│   ├── SubtitleDownloaderModal.jsx # Subtitle search + download
│   ├── KeyboardShortcutsModal.jsx  # Keyboard shortcut reference
│   ├── UpdateModal.jsx       # Auto-update progress UI
│   ├── WyzieKeyModal.jsx     # Wyzie subtitle API key input
│   ├── BlockedStatsModal.jsx # Ad-block statistics modal
│   ├── CloseConfirmModal.jsx # Confirm-before-close dialog
│   ├── SetupScreen.jsx       # First-run TMDB API key setup
│   ├── AsyncBoundary.jsx     # Loading / error / empty state wrapper
│   ├── ErrorBoundary.jsx     # React error boundary
│   ├── Icons.jsx             # SVG icon library
│   ├── Skeleton.jsx          # Base skeleton shimmer component
│   └── skeletons/
│       ├── CardGridSkeleton.jsx
│       ├── CastRowSkeleton.jsx
│       ├── HomeSkeleton.jsx
│       ├── MovieDetailSkeleton.jsx
│       └── TVDetailSkeleton.jsx
│
├── pages/
│   ├── HomePage.jsx          # Home — HeroBanner + trending rows + layout sections
│   ├── MoviePage.jsx         # Movie detail — metadata, trailer, cast, similar, player
│   ├── TVPage.jsx            # TV detail — seasons/episodes, cast, similar, player
│   ├── LibraryPage.jsx       # Saved/watched library grid
│   ├── DownloadsPage.jsx     # Active + completed downloads list
│   ├── SettingsPage.jsx      # All app settings (appearance, playback, backup, etc.)
│   ├── OnePacePage.jsx       # One Pace arc selection page
│   └── OnePaceArcPage.jsx    # One Pace episode list for a specific arc
│
├── ipc/                      # IPC handler modules (called from index.js main process)
│   ├── storage.js            # Read/write app data via electron-store
│   ├── player.js             # Launch mpv / external player
│   ├── downloads.js          # yt-dlp download management
│   ├── subtitles.js          # Wyzie subtitle search + file management
│   ├── allmanga.js           # AllManga anime source resolution
│   ├── onepace.js            # One Pace RSS feed + episode data
│   ├── blockStats.js         # Ad-block statistics aggregation
│   └── safeHandle.js         # Safe IPC handler wrapper (prevents duplicate registrations)
│
├── utils/
│   ├── api.js                # TMDB API client (fetch wrapper + request cache)
│   ├── cache.js              # In-memory request cache with TTL
│   ├── storage.js            # localStorage helpers (library, watch progress, settings)
│   ├── errors.js             # Centralized error codes + typed error results
│   ├── appearance.js         # Theme / accent color helpers
│   ├── homeLayout.js         # Home page section layout config
│   ├── sourceQueue.js        # Source resolution priority queue
│   ├── episodeMappings.js    # TV episode ID mapping overrides
│   ├── onepaceMapping.js     # One Pace arc/episode → TMDB mapping
│   ├── partyConfig.js        # Watch party relay server config
│   ├── subtitles.js          # Subtitle format helpers
│   ├── ageRating.js          # Age rating label lookup
│   ├── aniSkip.js            # AniSkip intro/outro skip API client
│   ├── oauth.js              # OAuth flow helper
│   ├── backup.js             # Library backup/restore helpers
│   ├── updates.js            # Auto-update check helpers
│   └── useBlockedStats.js    # React hook for ad-block stats
│
└── styles/
    ├── global.css            # Global styles, CSS variables, animations, skeletons
    ├── onepacePlayer.css     # One Pace player-specific styles
    └── fonts/                # Self-hosted DM Sans + Bebas Neue woff2 files
```

---

## Web App — `apps/web/src/`

> Browser-only port. Uses `ipc/polyfill.js` to stub `window.electron`. Missing Electron-only features.

```
apps/web/src/
├── main.jsx              # React entry — imports polyfill first, then mounts <App />
├── App.jsx               # Root component (same routing structure as Electron)
│
├── components/           # Mirrors src/components/ EXCEPT:
│   │                     #   MISSING: OnePacePlayer, WatchPartyHostModal,
│   │                     #            WatchPartyIndicator, skeletons/
│   ├── HeroBanner.jsx    # ← In progress: being updated to match Electron V2
│   ├── CastRow.jsx       # ← In progress
│   ├── SimilarRow.jsx    # ← In progress
│   ├── RatingBadge.jsx   # ← In progress
│   └── ...               # Other components ported but may be behind Electron version
│
├── pages/                # Mirrors src/pages/ EXCEPT:
│   │                     #   MISSING: OnePacePage, OnePaceArcPage
│   └── ...
│
├── ipc/
│   ├── polyfill.js       # ★ Web-only: stubs entire window.electron API
│   │                     #   Secure storage → localStorage, downloads → no-op,
│   │                     #   webview events → iframe event aliases
│   └── ...               # Other ipc files mirror Electron versions
│
├── utils/                # Mirrors src/utils/ EXCEPT:
│   │                     #   MISSING: onepaceMapping.js, partyConfig.js
│   │                     #   EXTRA: useRatings.js
│   └── ...
│
└── styles/               # Same as Electron (global.css, fonts/)
```

### Web-only API routes (`apps/web/api/`)
```
api/
├── proxy.js              # Vercel serverless — proxies TMDB requests (adds auth header server-side)
└── resolve-allmanga.js   # Vercel serverless — resolves AllManga source URLs
```

---

## Party Guest App — `apps/party-guest/`

Separate Vite + React app. Deployed alongside the web app. Allows guests to join a watch party without the full MovieVault UI.

---

## Config & Tooling (root)

| File | Purpose |
|------|---------|
| `vite.config.js` | Electron renderer build — manual chunks (react, settings, movie, tv, downloads) |
| `apps/web/vite.config.js` | Web build — minimal config, no manual chunks |
| `apps/web/vercel.json` | Web app Vercel deployment config |
| `vercel.json` | Root Vercel config — SPA rewrites for party-guest deep links |
| `package.json` | Electron: dev/start/dist scripts + electron-builder config |
| `apps/web/package.json` | Web: vite dev/build/preview scripts |

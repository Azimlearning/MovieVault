# Environment Setup — MovieVault

> **Security:** Never commit `.env` to git. It is in `.gitignore`. Do not paste real tokens in plans or execution docs.

---

## Electron App (root `.env`)

The Electron app reads env vars at **build time** via Vite (`import.meta.env.VITE_*`). The `.env` file lives at the project root.

| Variable | Required | Where to get it | Used by |
|----------|----------|-----------------|---------|
| `TMDB_API_KEY` | Yes | [TMDB API Settings](https://www.themoviedb.org/settings/api) — free account, "API Key (v3 auth)" | `src/utils/api.js` — appended as `?api_key=` on v3 requests |
| `TMDB_READ_ACCESS_TOKEN` | Yes | Same TMDB settings page — "API Read Access Token (v4 auth)" (JWT) | `src/utils/api.js` — sent as `Authorization: Bearer` header |

### How to set up
1. Copy the template:
   ```
   TMDB_API_KEY=your_v3_key_here
   TMDB_READ_ACCESS_TOKEN=your_v4_jwt_here
   ```
2. Save as `.env` at the project root (next to `package.json`)
3. Run `npm run start` — Vite bakes these into the build

> The app also has a **runtime setup screen** (`SetupScreen.jsx`) that lets users enter their TMDB key via the UI on first launch. The UI key is stored in Electron's secure store, not `.env`. The `.env` key is for the build-time default.

---

## Web App (`apps/web/`)

The web app does **not** use `.env` directly in the browser. TMDB credentials are handled differently:

| Method | Description |
|--------|-------------|
| **Server-side proxy** (`apps/web/api/proxy.js`) | Vercel serverless function — adds the TMDB `Authorization` header on the server so the token is never exposed to the browser |
| **User-entered key** | Same as Electron — `SetupScreen.jsx` lets the user paste their TMDB key, stored in `localStorage` via the `secureGet`/`secureSet` polyfill |

### Vercel env vars (for deployment)
Set these in the Vercel project dashboard → Settings → Environment Variables:

| Variable | Value | Used by |
|----------|-------|---------|
| `TMDB_API_KEY` | Your v3 API key | `api/proxy.js` |
| `TMDB_READ_ACCESS_TOKEN` | Your v4 JWT | `api/proxy.js` |

For local web dev (`cd apps/web && npm run dev`), create `apps/web/.env.local`:
```
VITE_TMDB_API_KEY=your_v3_key_here
VITE_TMDB_READ_ACCESS_TOKEN=your_v4_jwt_here
```

---

## Getting TMDB Credentials

See [`refdocs/guides/tmdb-tutorial.md`](tmdb-tutorial.md) for a step-by-step walkthrough (~2 minutes, free account).

Summary:
1. Register at [themoviedb.org](https://www.themoviedb.org/signup)
2. Go to Settings → API → Request an API key (choose "Developer")
3. Copy **API Key** (v3) → `TMDB_API_KEY`
4. Copy **API Read Access Token** (v4 JWT) → `TMDB_READ_ACCESS_TOKEN`

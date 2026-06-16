# MovieVault V2 — Execution Plan (Finish & Ship)

> **Purpose:** Step-by-step, LLM-executable plan to finish Version 2.0. Each phase is self-contained and can run in a fresh chat context.
> **Companion docs:** `IMPROVEMENT_PLAN_V2.md` (the PRD — *what* and *why*). This doc is the *how* and *in what order*.
> **Status at authoring:** P4 (UX Polish) and P5 (One Pace) are code-complete; P6 (Watch Party) is code-complete but **undeployed** and has integration gaps. One confirmed crash in the One Pace player.

---

## Phase 0 — Reference Map (read before any phase)

This is the "allowed APIs / known-good patterns" list. **Do not invent props, message types, or storage keys outside this map.** Verify against source before adding new ones.

### Core files and roles
| File | Role |
|---|---|
| `src/App.jsx` | Root state, navigation, **Watch Party host WebSocket logic** (lines 684–831), title/playback broadcast |
| `src/components/WatchPartyHostModal.jsx` | Host share modal (QR/link/code, guest list, kick) |
| `src/components/WatchPartyIndicator.jsx` | Persistent "Party · N guests" pill |
| `src/components/OnePacePlayer.jsx` | HTML5 `<video>` player for Pixeldrain One Pace files |
| `src/pages/MoviePage.jsx` / `TVPage.jsx` | Emit `onPlayerTitleChange` + `onPlayerStateUpdate` (the host broadcast source) |
| `src/ipc/onepace.js` | One Pace data layer (merges two GitHub JSON sources, 6h cache) |
| `services/party-relay/index.js` | Stateless WebSocket relay (sessions, broadcast, kick, 6h expiry) |
| `apps/party-guest/src/App.jsx` | Guest web app (join, synced iframe/video, chat, reactions) |

### Canonical WebSocket message schema (from `services/party-relay/index.js`)
```
// Host → relay → guests
{ type: "HOST_PLAY"|"HOST_PAUSE"|"HOST_SEEK"|"HOST_HEARTBEAT", time, playing, ts }
{ type: "HOST_TITLE_CHANGE", title }
{ type: "HOST_KICK", displayName }

// Guest → relay → all
{ type: "GUEST_CHAT", message }      // relay injects displayName
{ type: "GUEST_REACT", emoji }
{ type: "GUEST_HAND_RAISE" }

// Relay → clients
{ type: "STATE_SYNC", current: { title, time, playing }, guests: [{displayName}] }
{ type: "GUEST_LIST_UPDATE", guests: [{displayName}] }
{ type: "HOST_DISCONNECTED" }
{ type: "KICKED" }
```

### Canonical `title` object shapes (from MoviePage/TVPage/OnePacePlayer)
```
// movie  — MoviePage.jsx:1092
{ type: "movie", tmdbId, title, embedUrl }
// tv     — TVPage.jsx:864
{ type: "tv", tmdbId, season, episode, title, embedUrl }
// onepace — OnePacePlayer.jsx:221
{ type: "onepace", arcName, fileUrl, title }
```

### Storage keys (from `src/utils/storage.js`)
- `SHOW_ONE_PACE: "showOnePace"`
- `SYNC_ONE_PACE_ANILIST: "syncOnePaceAnilist"`
- `PARTY_SYNC_OFFSET: "partySyncOffset"`

### Assumed production domains (must match real deployments)
- Relay: `movievault-party.up.railway.app` (referenced in `src/App.jsx:687` and `apps/party-guest/src/App.jsx:5`)
- Guest app: `movievault-party.vercel.app` (referenced in `WatchPartyHostModal.jsx:10`)

**Anti-patterns to avoid globally:** inventing new message types not in the schema above; adding player props that aren't already destructured; assuming `episode.resolutions`/`episode.subtitles` shapes without confirming against `src/ipc/onepace.js`.

---

## Phase 1 — Critical bug fixes (blockers, do first)

### 1.1 Fix One Pace UpNext autoplay crash
**Problem.** `OnePacePlayer.jsx:215` calls `onPlayEpisode(arc, nextEpisode)`, but `onPlayEpisode` is **not** a destructured prop (see props block, lines 16–26) and is **not** passed by `App.jsx` (lines 1442–1453). When the 90% UpNext countdown fires, `handleNextEpisode` throws `ReferenceError`.

**Fix (copy the existing navigate pattern App already uses for the arc page at `App.jsx:1439`):**
1. In `src/App.jsx`, add to the `<OnePacePlayer>` render block (~line 1442):
   ```jsx
   onPlayEpisode={(arc, ep) => navigate("onepace-player", { arc, ep })}
   ```
2. In `src/components/OnePacePlayer.jsx`, add `onPlayEpisode` to the destructured props (lines 16–26).

**Verify:**
- `grep -n "onPlayEpisode" src/components/OnePacePlayer.jsx` shows it in the props list AND at the call site.
- Manually: open a One Pace episode, seek to ≥90%, confirm UpNext card appears and "Play Now"/auto-advance navigates to the next episode without a console error.

**Anti-pattern guard:** Do NOT re-implement episode lookup inside the player. Reuse the `navigate("onepace-player", { arc, ep })` contract already used by `OnePaceArcPage` via `App.jsx:1439`.

### 1.2 Verify One Pace data shape end-to-end (prevent silent player break)
**Problem.** `OnePacePlayer.jsx` assumes `episode.resolutions[res].url`, `episode.subtitles[].url`, `.lang`, `.language`, `.id`, and `arc.episodes`, `arc.episodeCount`, `arc.id`, `arc.slug`, `arc.name`. These come from the merge in `src/ipc/onepace.js`. If the merge output keys differ, the player renders an empty `<video>`.

**Steps:**
1. Read `src/ipc/onepace.js` fully — confirm the exact object keys returned by `listArcs()` / `getArc()`.
2. Cross-check each field the player and `OnePaceArcPage.jsx` read against that output.
3. Fix any mismatch **at the data layer** (normalize in `onepace.js`) so the UI contract stays stable.

**Verify:** Launch app → One Pace → open an arc → play an episode. Confirm video loads, resolution picker lists real options, subtitle track(s) appear.

**Anti-pattern guard:** Don't patch field names inside the player to match the data; normalize once in `onepace.js` so all consumers agree.

### 1.3 Remove/repair placeholder magnet fallback
**Problem.** `OnePacePlayer.jsx:392` `copyMagnetLink` builds a fake `magnet:?xt=urn:btih:...` that copies a non-functional link.

**Fix:** Either (a) wire the real magnet from the episode data if `onepace.js` exposes one, or (b) if no magnet is available, remove the "Copy Magnet Link" button from the fallback card and keep only "Open onepace.net" + "Retry".

**Verify:** Trigger the fallback (point a resolution at a dead URL) → no button produces a bogus magnet.

---

## Phase 2 — Centralize relay/guest configuration

**Problem.** The relay host is hardcoded in 3 places with `http://`/`ws://` (insecure) and the guest/relay domains are scattered. Production needs `https://`/`wss://`.

### 2.1 Single source of truth in the Electron app
1. Create `src/utils/partyConfig.js`:
   ```js
   const isDev = typeof window !== "undefined" && window.location.href.includes("localhost:");
   const RELAY_HOST = isDev ? "localhost:3000" : "movievault-party.up.railway.app";
   const SECURE = !isDev;
   export const PARTY_HTTP = `${SECURE ? "https" : "http"}://${RELAY_HOST}`;
   export const PARTY_WS   = `${SECURE ? "wss"   : "ws"}://${RELAY_HOST}`;
   export const GUEST_APP_ORIGIN = "https://movievault-party.vercel.app";
   ```
2. Replace the inline `relayHost`/`HTTP_URL`/`WS_URL` block in `src/App.jsx:686–689` with imports from this module.
3. Replace the hardcoded `joinUrl` base in `WatchPartyHostModal.jsx:10` with `${GUEST_APP_ORIGIN}/join/${session.sessionId}` and the `code` tab footer text (`:167`) with the same origin.

### 2.2 Mirror the fix in the guest app
In `apps/party-guest/src/App.jsx:3–8`, switch the prod branch to `https`/`wss`:
```js
const isLocal = window.location.hostname === "localhost";
const relayHost = isLocal ? "localhost:3000" : "movievault-party.up.railway.app";
const HTTP_URL = `${isLocal ? "http" : "https"}://${relayHost}`;
const WS_URL   = `${isLocal ? "ws"   : "wss"}://${relayHost}`;
```

**Verify:** `grep -rn "ws://\|http://" src/App.jsx apps/party-guest/src/App.jsx` shows only the localhost/dev branch using insecure protocols.

**Anti-pattern guard:** Do not leave any production code path on `ws://` — Vercel HTTPS pages block mixed-content WebSockets silently.

---

## Phase 3 — Deploy the relay server (Railway)

**Reference:** `services/party-relay/index.js` (already complete), `package.json` has `start: node index.js`.

### 3.1 Add deployment + hardening files
1. Pin Node and add a Procfile-style start. Create `services/party-relay/Procfile`:
   ```
   web: node index.js
   ```
   (Railway also honors the `start` script; the Procfile makes intent explicit.)
2. Add `"engines": { "node": ">=20" }` to `services/party-relay/package.json`.
3. **Lock CORS** (currently `*` at `index.js:46`). Read `ALLOWED_ORIGINS` from env (comma-separated), fall back to `*` only in dev:
   - Replace the static `Access-Control-Allow-Origin: *` with a lookup against `process.env.ALLOWED_ORIGINS`.
   - Set `ALLOWED_ORIGINS` to the guest app origin + the Electron app origin once known.
4. (Optional) Add `services/party-relay/.dockerignore` with `node_modules`.

### 3.2 Deploy
1. Push repo. In Railway: New Project → Deploy from GitHub repo → set **root directory** to `services/party-relay`.
2. Set env vars: `MAX_GUESTS_PER_SESSION` (default 20 already in code as `MAX_GUESTS`), `SESSION_TTL_HOURS`, `ALLOWED_ORIGINS`. *(Note: code currently hardcodes `MAX_GUESTS`/`SESSION_TTL` — wire these to env while you're in `index.js`, or skip and keep defaults.)*
3. Confirm the generated public domain matches `movievault-party.up.railway.app` (or update Phase 2 constants to the real domain).

**Verify:**
- `curl -X POST https://<relay-domain>/session` returns `{ sessionId, sessionCode, hostToken }` in <500ms.
- Railway logs show `[relay] WebSocket server listening on port ...`.

**Anti-pattern guard:** The relay is in-memory by design — do NOT add a database. Restart = sessions die (acceptable for personal use, per PRD §6.1).

---

## Phase 4 — Deploy the guest web app (Vercel)

**Reference:** `apps/party-guest/` (Vite + React 19, complete UI in `src/App.jsx` + `src/index.css`).

### 4.1 Add SPA routing config (critical)
The whole share flow uses `/join/{sessionId}` deep links. Without a rewrite, Vercel 404s them. Create `apps/party-guest/vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 4.2 Confirm relay URL (from Phase 2.2) points at the live Railway domain.

### 4.3 Deploy
1. Vercel: New Project → import repo → set **root directory** to `apps/party-guest`.
2. Framework preset: Vite. Build: `vite build`, output: `dist`.
3. Confirm domain matches `movievault-party.vercel.app` (or update `GUEST_APP_ORIGIN` in Phase 2.1 to the real one).

**Verify:**
- Visit `https://<guest-domain>/join/test-id` directly → join screen renders (no 404), Session ID prefilled to `test-id`.
- Start a party from the desktop app, scan the QR / open the link, enter the code → guest connects, host's guest list updates within ~1s.

**Anti-pattern guard:** Don't add TMDB API keys or scraping to the guest app — it mirrors the host's `embedUrl` only (PRD §6.3). Keep its dependency surface tiny.

---

## Phase 5 — Watch Party end-to-end hardening

These close gaps between the relay/host and the guest that the PRD specified but the code skips.

### 5.1 Guest: display other guests' hand-raises
**Problem.** Guest `onmessage` switch (`apps/party-guest/src/App.jsx:127–190`) has no `GUEST_HAND_RAISE` case, so only the host sees raises. Add a case that calls `showLocalToast(\`✋ ${data.displayName} raised their hand\`)`.

### 5.2 Guest: cap chat + throttle reactions (PRD §6.5)
1. Cap retained chat at 50 messages: in the `GUEST_CHAT` handler, `slice(-50)`.
2. Throttle outgoing reactions to 3 per 5s in `sendReaction` (a small timestamp ring buffer).

### 5.3 Confirm host-side social toasts
Host already toasts chat/react/hand-raise (`App.jsx:722–728`). Verify these fire end-to-end after deploy.

### 5.4 One Pace in a party (cross-origin video)
The guest plays Pixeldrain `fileUrl` via a native `<video>` (`party-guest App.jsx:415`). Confirm Pixeldrain allows hotlinked playback from the Vercel origin; if blocked, document the limitation (movies/TV via iframe still work).

**Verify (multi-device):**
- Host play/pause/seek reflects on guest within ±3s (PRD §6.4 tolerance).
- Title change on host reloads guest source.
- Kick closes the guest socket and shows the removed message.
- Host close ends party for all guests (60s disconnect overlay then exit).

---

## Phase 6 — Settings, docs, definition-of-done

### 6.1 Verify Settings toggles are wired
Confirm `src/pages/SettingsPage.jsx` exposes and persists:
- "Show One Pace" → `STORAGE_KEYS.SHOW_ONE_PACE` (drives sidebar entry via `App.jsx:148–151`).
- "Sync One Pace progress to AniList" → `SYNC_ONE_PACE_ANILIST` (read in `OnePacePlayer.jsx:170`).
- "Party sync offset" → `PARTY_SYNC_OFFSET` (read in `App.jsx:779`, displayed in `OnePacePlayer.jsx:427`).
- "Autoplay trailers on banner" (PRD §4.2 FR6) → confirm key exists and `HeroBanner.jsx` respects it.
Add any missing toggle; do not introduce new storage keys outside `STORAGE_KEYS`.

### 6.2 Update CHANGELOG + README (PRD §8 DoD)
- `CHANGELOG.md`: add a V2 entry covering Skeletons, Hero banner, Rich detail pages, One Pace, Watch Party — include the known limitations (in-memory relay, Pixeldrain dependency, one-way iframe sync).
- `README.md`: document One Pace section + Watch Party (host + guest), and the relay/guest deploy URLs.

### 6.3 (Optional) Happy-path smoke test
PRD §8 asks for a Playwright smoke test that launches the app and plays one movie + one TV episode + one One Pace episode. Add if pursuing the full DoD; otherwise note as deferred.

---

## Phase 7 — Final verification

Run top-to-bottom and check off:

- [ ] `grep -rn "ws://\|http://" src apps/party-guest/src` → only dev/localhost branches insecure.
- [ ] `grep -n "onPlayEpisode" src/components/OnePacePlayer.jsx` → present in props + call site.
- [ ] One Pace: browse → arc → play → subtitles + resolution work → UpNext auto-advances (no console error).
- [ ] `POST https://<relay>/session` returns a session; WS connects from both host and guest.
- [ ] Guest deep link `/join/{id}` loads (no 404); join → synced playback for movie, TV, and One Pace.
- [ ] Chat (≤50 retained), reactions (throttled, animate on all), hand-raise (visible to host AND guests).
- [ ] Kick + host-close behave correctly on the guest.
- [ ] Settings toggles persist and take effect.
- [ ] CHANGELOG + README updated.
- [ ] App still launches and plays one movie + one TV episode + one One Pace episode end-to-end.

---

## Execution order summary

1. **Phase 1** — fix the crash + verify One Pace data shape (local, no deploy).
2. **Phase 2** — centralize config / fix protocols (prerequisite for any deploy test).
3. **Phase 3** — deploy relay (everything in P6 needs a live relay).
4. **Phase 4** — deploy guest app.
5. **Phase 5** — harden the live party flow.
6. **Phase 6** — settings + docs.
7. **Phase 7** — final verification.

> Do not reorder Phases 2→4 (config must precede deploy). Phases 1, 5, 6 can be parallelized by separate sessions once Phase 2 lands.

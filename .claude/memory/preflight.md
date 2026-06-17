# Preflight — MovieVault Session Start

> Read this at the start of every session before touching code.
> One-page gate — five questions, then you can build.

---

## 1. Which codebase am I working in?

| Codebase | Root | Run command | Can use native APIs? |
|----------|------|-------------|----------------------|
| Electron desktop app | `src/` | `npm run start` (root) | Yes |
| Web app | `apps/web/src/` | `cd apps/web && npm run dev` | No — polyfill only |
| Party guest app | `apps/party-guest/` | own dev server | No |

**Rule:** Never edit `src/` and `apps/web/src/` in the same session without explicitly tracking both. Changes do not sync automatically.

---

## 2. Does a plan exist before I build?

- Non-trivial feature → plan doc in `refdocs/plans/` + execution doc in `refdocs/execution/`
- If neither exists, create them first. See the READMEs in those folders.

---

## 3. If adding a new `window.electron` method — is the polyfill updated?

Any new method in `preload.js` must have a matching stub in `apps/web/src/ipc/polyfill.js`.
The `check_polyfill_sync` hook will remind you, but you still have to do it.

ADR: `refdocs/changelog/DECISIONS.md` — ADR-002.

---

## 4. Have I checked feature_parity.md for the thing I'm about to build?

`refdocs/guides/feature_parity.md` tracks what's ported and what's missing.
Before porting a component: confirm it's marked ❌ or 🔄, not already ✅.
After porting: update the table.

---

## 5. Will I update the changelog before ending the session?

`refdocs/changelog/CHANGELOG.md` — mandatory entry after any session with code changes or decisions.

Format:
```
### YYYY-MM-DD — [session goal]
- **Changed:** ...
- **Decided:** ...
- **Deviations:** ...
- **Known issues / next steps:** ...
```

---

## Quick links

| Doc | Purpose |
|-----|---------|
| `CLAUDE.md` | Full rules + codebase overview |
| `refdocs/guides/project_file_structure.md` | Every file in both codebases |
| `refdocs/guides/feature_parity.md` | What's ported to web vs Electron-only |
| `refdocs/guides/env_setup.md` | TMDB keys, where they go |
| `refdocs/changelog/DECISIONS.md` | Architectural decisions — read before re-debating |
| `refdocs/plans/` | Feature plans |
| `refdocs/execution/` | Execution plans |

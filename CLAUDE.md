# MovieVault — Claude Context

> Read this file at the start of every session. Then read `.claude/memory/preflight.md` and run through it. The rules below are mandatory for all AI agents.

---

## Mandatory Rules

### 1. Update the changelog after every session
After any session where code was changed, a decision was made, or a plan was modified — add an entry to:

**`refdocs/changelog/CHANGELOG.md`**

Entry format:
```
### YYYY-MM-DD — [short summary of session goal]
- **Changed:** what files/components were touched and why
- **Decided:** any architectural or design decisions and the reasoning
- **Deviations:** anything that differed from the plan, and why
- **Known issues / next steps:** what was left open
```

Do not skip this. Even a one-line fix gets a one-line entry.

### 2. Plan before you build
Before implementing any non-trivial feature:
1. A **plan doc** must exist in `refdocs/plans/` covering *what* and *why*
2. An **execution doc** must exist in `refdocs/execution/` covering *how* and *in what order*

If neither exists, create them before writing code. See the READMEs in those folders for required sections and naming conventions.

### 3. Keep docs current
If you deviate from a plan during execution, update the execution doc to reflect the actual approach taken. Stale docs are worse than no docs.

---

## Two Separate Codebases

This repo contains two distinct apps that **do not share source code**:

### Electron Desktop App (`src/`)
- Full-featured desktop app — has all V2 UI (HeroBanner, CastRow, SimilarRow, RatingBadge)
- Can use native Electron APIs: file downloads, `webview` tags, IPC, system dialogs
- **Run:** `npm run start` (root) — builds and launches the Electron window
- **Dev watch:** `npm run dev` (root) — runs `vite build --watch`, does NOT open a browser

### Web App (`apps/web/src/`)
- Browser-only React app, deployed to `movie-vault-neon.vercel.app`
- Uses an IPC polyfill that stubs Electron APIs — cannot download files or use `webview`
- **Currently being updated** to match the V2 Electron design
- **Run:** `cd apps/web && npm run dev` — Vite dev server at `http://localhost:5173`

### Party Guest App (`apps/party-guest/`)
- Separate Vite app for watch-party guests, deployed alongside the web app

> Changes to `src/` do not affect `apps/web/src/` and vice versa. Always confirm which codebase you're working in.

---

## Reference Docs (`refdocs/`)

```
refdocs/
  changelog/
    CHANGELOG.md          ← MANDATORY AI session log (update every session)
    DECISIONS.md          ← Architectural decisions (ADRs) — read before re-debating settled choices
  plans/
    README.md             ← Rules for plan docs
    IMPROVEMENT_PLAN.md   ← V1 Electron improvements roadmap
    IMPROVEMENT_PLAN_V2.md ← V2 PRD: UX polish, One Pace, Watch Party
  execution/
    README.md             ← Rules for execution docs
    V2_EXECUTION_PLAN.md  ← V2 step-by-step execution (P4+P5 done, P6 undeployed)
  guides/
    project_file_structure.md ← Full file map of both codebases
    feature_parity.md         ← What's ported to web vs Electron-only
    env_setup.md              ← All env vars, where to get them, how to configure
    checklist.md              ← Pre-ship checklist for Electron and web
    tmdb-tutorial.md          ← How to get a TMDB API token
```

---

## Running the App

```bash
# Electron desktop app
npm run start           # build + launch Electron window
npm run dev             # watch mode only (no window opens)

# Web app (browser)
cd apps/web
npm install
npm run dev             # http://localhost:5173
```

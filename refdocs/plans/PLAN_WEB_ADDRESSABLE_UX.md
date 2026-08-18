# PLAN — Addressable URLs, Player Chrome, and Playback Recovery (Web)

> Status: Phase 1 implemented 2026-08-18.
> Target: `apps/web/`
> Companion execution: [EXEC_WEB_ADDRESSABLE_UX.md](../execution/EXEC_WEB_ADDRESSABLE_UX.md)
> Research: [STREAMING_UX_TEARDOWN.md](../research/STREAMING_UX_TEARDOWN.md)
> Related: [PLAN_WEB_PLAYBACK_RELIABILITY.md](PLAN_WEB_PLAYBACK_RELIABILITY.md), [PLAN_NATIVE_PLAYER.md](PLAN_NATIVE_PLAYER.md)

## Goal

Close the three gaps that make the deployed web app read as a mock rather than a
streaming product: it has no addresses, its player fails silently for other
people, and its own controls collide with each other and vanish exactly when
they are needed. Netflix and Disney+ both treat the URL as part of the product
(teardown §2.1 deep-link resume, §4 share sheet) and treat a failed player as a
recoverable state rather than a dead end (§6.9).

## Scope

**In**
- Real addresses for every screen, with browser Back/Forward, reload, sharing
  and bookmarking behaving as on any website.
- Deep links that land on the title page, never on home (teardown §14 P1).
- A single, non-overlapping cluster for MovieVault's own player controls, kept
  available in fullscreen and on touch devices.
- A recovery path when an embedded provider shows nothing, including an honest
  explanation of *why* — network-level block versus embed refusal.

**Out (this phase)**
- Transport controls (play/pause/seek/subtitles) over third-party embeds — see
  Constraints; impossible from the parent page.
- Replacing third-party providers with an owned backend — tracked in
  `PLAN_NATIVE_PLAYER.md`, currently NO-GO after the Phase 0 spike.
- Profiles, Match %, post-play for movies, and the remaining teardown P2 set.

## Constraints

- A cross-origin `<iframe>` exposes no playback state, no DOM, and no media
  element to the parent page. Custom play/seek/subtitle controls are therefore
  only possible on the app-owned native `<video>` player (One Pace, downloads).
- A provider refusing to be embedded (`X-Frame-Options` / `frame-ancestors`)
  still fires the iframe `load` event, and so does a domain blocked by DNS, an
  ad blocker or an ISP. Neither is detectable from the `load` signal alone.
- A no-cors `fetch` cannot read the response, but its promise still separates
  "the origin answered" from "the request never left the network".
- The app's navigation model is a `{ page, selected }` pair; a URL can only
  carry the identity of a screen, not a hydrated TMDB object.

## Acceptance criteria

- Every screen has its own address; Back, Forward, reload and a pasted link all
  land where the user expects.
- A shared movie/TV link opens that title's page directly, keeping its slug.
- The tab title names the title being viewed, including on a cold deep link.
- No two MovieVault player buttons occupy the same position at any viewport.
- Player controls remain reachable in fullscreen and on touch devices.
- A player that has shown nothing for ~11s offers next source, open-in-new-tab,
  and dismiss, with a diagnosis that distinguishes a blocked network from an
  embed refusal.
- `npm run build` passes and the Playwright smoke suite covers routing.

## Open questions

- Whether the friend's "Iframe Sandbox Detected" report reproduces on the
  current deployment: the null-sandbox fix for Videasy is in `origin/main`, so
  the screenshots may predate it. Needs one confirmation on their device.
- Whether to canonicalise the URL slug after TMDB resolves a deep-linked title
  (currently the slug is preserved as shared, never rewritten).
- Whether provider reachability should be probed *before* first paint to pick a
  working source, rather than after a failure — a pre-probe costs a request per
  source and may itself be blocked.

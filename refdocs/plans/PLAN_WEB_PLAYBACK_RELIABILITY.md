# PLAN — Web Playback Reliability & Streaming UX

> Status: Phase 1 complete; Phase 2 in progress.
> Target: `apps/web/`
> Companion execution: [EXEC_WEB_PLAYBACK_RELIABILITY.md](../execution/EXEC_WEB_PLAYBACK_RELIABILITY.md)
> Research: [STREAMING_UX_TEARDOWN.md](../research/STREAMING_UX_TEARDOWN.md)

## Goal

Make the browser player safer and more predictable while applying the highest-value streaming UX principles: clear playback state, fullscreen immersion, recoverable source selection, and low-friction continuation.

## Scope

- Use a verified working provider by default, while offering sandbox-first playback as an explicit Pop-up Shield preference.
- Keep an explicit manual source choice for compatibility recovery.
- Use a consistent MovieVault mark for the web sidebar and browser favicon.
- Verify the production build at desktop and narrow-mobile viewports with Playwright.
- Upgrade the native One Pace player with screen lock, visible seek controls, double-tap seeking, speed selection, and an explicit next-episode action.
- Keep the existing recent-search recovery and useful empty search state verified as part of the regression pass.
- Replace the Home page's bare loading state with layout-preserving skeletons.

## Constraints

- Browser iframes cannot inspect cross-origin provider playback state.
- Providers that reject `sandbox` cannot simultaneously be embedded safely and have their popups blocked; see ADR-013 and ADR-016.
- No provider is considered verified merely because its iframe fires `load`.
- Cross-origin embedded providers cannot receive the same in-app controls as the native One Pace `<video>` player.

## Acceptance criteria

- New web sessions select a provider verified to play in the browser.
- Pop-up Shield is opt-in because the current sandboxed providers reject iframe sandboxing for the verified title.
- The app builds and its first-run screen renders at desktop and 390px mobile widths.
- Research and implementation notes are indexed in `refdocs`.
- Native One Pace playback exposes the P0 control layer without affecting embedded movie/TV sources.
- Search preserves a small, removable recent-search history.
- Home loading retains its content geometry rather than showing an empty page.

## Open questions

- Confirm VidSrc compatibility with the sandbox using a title known to be available, on a real device and network.
- Decide whether a licensed/owned streaming backend should replace third-party iframe playback for reliable, ad-free playback.

// Surviving an ad that steals the tab.
//
// An unsandboxed provider can navigate the *top-level* browsing context, not
// just open a window. On mobile that is the common case: a tap on the embed's
// own play button replaces MovieVault with the ad. Pressing Back then reloads
// the app, which means pressing Play again — and that fresh click is worth
// another ad to the same script. That is the loop.
//
// The routing work means Back already returns to the right title. This closes
// the other half: the player reopens by itself, so returning costs no click.
//
// Deliberately narrow. The intent is only honoured on a *document* load that
// came from Back/Forward or a reload — exactly the shape of returning from a
// hijacked tab. Moving around inside the app never triggers it, because that
// is a component remount with no navigation entry.

const KEY = "mv_playback_intent";
const MAX_AGE_MS = 30 * 60 * 1000;

const store = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null; // private mode or storage disabled
  }
};

export function rememberPlayback(intent) {
  const s = store();
  if (!s || !intent?.id) return;
  try {
    s.setItem(KEY, JSON.stringify({ ...intent, at: Date.now() }));
  } catch {
    // A full or unavailable store just means no auto-resume.
  }
}

export function forgetPlayback() {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    // ignored
  }
}

function returnedToThisDocument() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    // "navigate" is a fresh visit and must not auto-play; the other two are a
    // user coming back to something that was already running.
    return nav?.type === "back_forward" || nav?.type === "reload";
  } catch {
    return false;
  }
}

// Was this exact title playing when the document was last torn down?
export function recallPlayback(match) {
  const s = store();
  if (!s || !match?.id) return false;
  if (!returnedToThisDocument()) return false;

  let intent;
  try {
    intent = JSON.parse(s.getItem(KEY) || "null");
  } catch {
    return false;
  }
  if (!intent) return false;
  if (Date.now() - (intent.at || 0) > MAX_AGE_MS) return false;
  if (intent.type !== match.type) return false;
  if (String(intent.id) !== String(match.id)) return false;

  if (match.type === "tv") {
    return {
      season: intent.season ?? null,
      episode: intent.episode ?? null,
    };
  }
  return true;
}

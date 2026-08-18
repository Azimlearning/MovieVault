// Why a provider embed showed nothing.
//
// A cross-origin <iframe> gives the parent page no readable failure signal: a
// provider that refuses embedding (X-Frame-Options / frame-ancestors) still
// fires `load`, and a domain blocked by DNS, an ad blocker or an ISP fires
// `load` too. Both look identical from here — which is why a black player has
// so far been a dead end for the user.
//
// A no-cors fetch does separate the two cases. The response is opaque either
// way, so nothing about the *content* is readable, but the promise itself is
// informative:
//   rejects  → the request never reached the origin (DNS/adblock/ISP/offline)
//   resolves → the origin answered; a blank player is then an embed refusal
//
// That is the difference between "your network is blocking this domain" and
// "this provider won't allow embedding", and it is the difference between the
// two errors the user's friend is hitting.

export const REACHABILITY = {
  UNKNOWN: "unknown",
  BLOCKED: "blocked",
  REACHABLE: "reachable",
};

export async function probeReachable(url, timeoutMs = 6000) {
  if (!url) return REACHABILITY.UNKNOWN;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return REACHABILITY.UNKNOWN; // offline is its own banner, not a source fault
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    return REACHABILITY.REACHABLE;
  } catch (err) {
    // An abort means slow, not blocked; claiming "blocked" on a timeout would
    // send users chasing a network problem they do not have.
    if (err?.name === "AbortError") return REACHABILITY.UNKNOWN;
    return REACHABILITY.BLOCKED;
  } finally {
    clearTimeout(timer);
  }
}

export function diagnosisMessage(reachability, sourceLabel) {
  const label = sourceLabel || "This source";
  switch (reachability) {
    case REACHABILITY.BLOCKED:
      return `${label} can't be reached from this network — an ad blocker, DNS filter, VPN or mobile carrier is most likely blocking it. Try another source, or the same one on a different network.`;
    case REACHABILITY.REACHABLE:
      // Two causes look identical from out here: the provider refusing to be
      // embedded, and the provider having no source for this particular title.
      // Naming only one of them would be a guess presented as a diagnosis.
      return `${label} is reachable, so this is either a title it has no sources for or a frame it won't allow. Another source usually works, or open it in a new tab.`;
    default:
      return `${label} isn't responding. Try another source, or open it in a new tab.`;
  }
}

// First source in `sourceIds` whose origin actually answers. Probes are
// sequential and capped: the point is to skip a provider the user's network
// blocks outright, not to survey every provider on every play.
export async function pickReachableSource(
  sourceIds,
  buildUrl,
  { maxProbes = 3, timeoutMs = 4500 } = {},
) {
  for (const sourceId of (sourceIds || []).slice(0, maxProbes)) {
    const url = buildUrl(sourceId);
    if (!url) continue;
    // Sequential on purpose: a parallel burst would fire requests at providers
    // we may never need, on a connection already struggling enough for one of
    // them to be blocked.
    const result = await probeReachable(url, timeoutMs);
    if (result === REACHABILITY.REACHABLE) return sourceId;
  }
  return null;
}

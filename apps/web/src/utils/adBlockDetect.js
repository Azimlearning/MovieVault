// Is a content blocker active in this browser?
//
// A web page cannot block network requests on its own — that is the whole
// reason the browser build has no ad blocking of its own to offer. What it can
// do is tell whether the user already has one, and stop nagging if they do.
//
// Two independent signals, because either alone gives false answers:
//   1. A bait element carrying class names every filter list hides. Cosmetic
//      filtering collapses it. This catches blockers that only hide, and costs
//      no network request.
//   2. A bait request to a hostname on every blocklist. Network-level blocking
//      rejects the promise. This catches blockers that do not do cosmetics, and
//      DNS/upstream blockers the page cannot see any other way.
//
// Either firing means a blocker is present. Neither firing means "none that we
// can see" — never stated more strongly than that, since a blocker with an
// exception for this site is indistinguishable from no blocker at all.

export const BLOCKER = {
  ACTIVE: "active",
  ABSENT: "absent",
  UNKNOWN: "unknown",
};

const BAIT_CLASSES =
  "adsbox ad-placement ad-banner pub_300x250 text-ad sponsored-ad";

// Hostname carried by every mainstream list. Requested once, only when asked.
const BAIT_URL =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

function cosmeticBait() {
  if (typeof document === "undefined") return false;
  const bait = document.createElement("div");
  bait.className = BAIT_CLASSES;
  bait.setAttribute("aria-hidden", "true");
  bait.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;width:300px;height:250px;pointer-events:none;";
  document.body.appendChild(bait);

  const style = window.getComputedStyle(bait);
  const blocked =
    bait.offsetHeight === 0 ||
    bait.offsetParent === null ||
    style.display === "none" ||
    style.visibility === "hidden";

  bait.remove();
  return blocked;
}

async function networkBait(timeoutMs = 3500) {
  if (typeof fetch !== "function") return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(BAIT_URL, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return false; // the request reached the network
  } catch (err) {
    // An abort is a slow connection, not a block: claiming "blocked" there
    // would tell users they are protected when they are not.
    if (err?.name === "AbortError") return false;
    return true;
  } finally {
    clearTimeout(timer);
  }
}

export async function detectContentBlocker() {
  if (typeof window === "undefined") return BLOCKER.UNKNOWN;
  if (navigator.onLine === false) return BLOCKER.UNKNOWN;

  try {
    if (cosmeticBait()) return BLOCKER.ACTIVE;
    return (await networkBait()) ? BLOCKER.ACTIVE : BLOCKER.ABSENT;
  } catch {
    return BLOCKER.UNKNOWN;
  }
}

// The right recommendation depends on the browser: uBlock Origin cannot be
// installed on Chrome for Android at all, which is exactly the case the user's
// friend is in, so pointing everyone at the Chrome Web Store would be wrong.
export function blockerAdvice(ua = navigator.userAgent || "") {
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(ua) && navigator.maxTouchPoints > 1);
  const isFirefox = /Firefox/i.test(ua);
  const isEdge = /Edg\//i.test(ua);
  const isChromeLike = /Chrome|Chromium/i.test(ua) && !isEdge;

  if (isIOS) {
    return {
      browser: "iOS",
      note: "iOS only allows content blockers through Safari, or a browser that ships its own.",
      links: [
        { label: "Get Brave for iOS", url: "https://brave.com/download/" },
        { label: "Safari content blockers", url: "https://apps.apple.com/app/adguard-adblock-privacy/id1047223162" },
      ],
    };
  }

  if (isAndroid) {
    return {
      browser: "Android",
      note: "Chrome for Android cannot install extensions. Use a browser that can, or one that blocks by itself.",
      links: [
        { label: "Firefox for Android + uBlock Origin", url: "https://addons.mozilla.org/android/addon/ublock-origin/" },
        { label: "Get Brave for Android", url: "https://brave.com/download/" },
      ],
    };
  }

  if (isFirefox) {
    return {
      browser: "Firefox",
      links: [{ label: "uBlock Origin for Firefox", url: "https://addons.mozilla.org/firefox/addon/ublock-origin/" }],
    };
  }

  if (isEdge) {
    return {
      browser: "Edge",
      links: [{ label: "uBlock Origin for Edge", url: "https://microsoftedge.microsoft.com/addons/detail/odfafepnkmbhccpbejgmiehpchacaeak" }],
    };
  }

  if (isChromeLike) {
    return {
      browser: "Chrome",
      note: "Chrome's extension rules limit what blockers can do; uBlock Origin Lite is the version that still works there.",
      links: [
        { label: "uBlock Origin Lite for Chrome", url: "https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh" },
        { label: "Get Brave (blocks by default)", url: "https://brave.com/download/" },
      ],
    };
  }

  return {
    browser: "your browser",
    links: [{ label: "uBlock Origin", url: "https://github.com/gorhill/uBlock#installation" }],
  };
}

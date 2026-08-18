import { storage } from "./storage";
import { sourceIsProtected } from "./api";

const CACHE_PREFIX = "lastGoodSource_";

export const sourceQueue = {
  getPriorityOrder() {
    const custom = storage.get("sourcePriority");
    if (Array.isArray(custom) && custom.length > 0) {
      // Preserve the user's ordering, while avoiding duplicate or stale IDs.
      return [...new Set(custom.filter((s) => ["vidsrc", "2embed", "videasy"].includes(s)))];
    }
    // The only currently verified working provider is Videasy. The shield can
    // move sandboxed providers ahead when the user prioritises popup blocking.
    return ["videasy", "vidsrc", "2embed"];
  },

  // Pop-up Shield: when on, sandbox-protected sources are tried before
  // unprotected ones (Videasy), trading playback compatibility for browser-
  // enforced popup blocking. It is opt-in because both currently configured
  // protected providers reject sandboxed playback for this title.
  getPopupShield() {
    return storage.get("popupShield") === true;
  },

  savePopupShield(enabled) {
    storage.set("popupShield", enabled === true);
    window.dispatchEvent(
      new CustomEvent("movievault:popup-shield-changed", { detail: enabled }),
    );
  },
  
  savePriorityOrder(order) {
    storage.set("sourcePriority", order);
    // Dispatch custom event to notify components
    window.dispatchEvent(new CustomEvent("movievault:source-priority-changed", { detail: order }));
  },

  getSourceTimeout() {
    const val = storage.get("sourceTimeout");
    return val !== null && val !== undefined ? Number(val) : 10; // default 10 seconds
  },

  saveSourceTimeout(seconds) {
    const val = Math.max(5, Math.min(30, Number(seconds) || 10));
    storage.set("sourceTimeout", val);
  },

  getLastGoodSource(tmdbId, season, episode) {
    const key = this._getHistoryKey(tmdbId, season, episode);
    const cached = storage.get(key);
    if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
      return cached.sourceId;
    }
    return null;
  },

  saveLastGoodSource(tmdbId, season, episode, sourceId) {
    const key = this._getHistoryKey(tmdbId, season, episode);
    storage.set(key, { sourceId, ts: Date.now() });
  },

  _getHistoryKey(tmdbId, season, episode) {
    const suffix = season != null ? `_s${season}e${episode}` : "";
    return `${CACHE_PREFIX}${tmdbId}${suffix}`;
  },

  /**
   * Generates a queue of source IDs.
   * Default: the verified working provider first. With Pop-up Shield enabled,
   * only sandbox-compatible sources are attempted.
   * With Pop-up Shield on: only sandbox-protected sources are eligible.
   * This is intentional: trying an unprotected provider as a fallback silently
   * reintroduces the pop-up/tab-hijack problem that the setting promises to stop.
   */
  getQueue(tmdbId, season, episode) {
    const order = [...this.getPriorityOrder()];
    if (this.getPopupShield()) {
      return order.filter((s) => sourceIsProtected(s));
    }
    return order;
  },
};

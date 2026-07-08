import { storage } from "./storage";
import { sourceIsProtected } from "./api";

const CACHE_PREFIX = "lastGoodSource_";

export const sourceQueue = {
  getPriorityOrder() {
    const custom = storage.get("sourcePriority");
    if (Array.isArray(custom) && custom.length > 0) {
      const order = custom.filter((s) => s !== "videasy");
      return ["videasy", ...order];
    }
    // Default priority order: videasy first
    return ["videasy", "vidsrc", "2embed"];
  },

  // Pop-up Shield: when on, sandbox-protected sources are tried before
  // unprotected ones (Videasy), trading Videasy's catalog/quality for
  // browser-enforced popup blocking. Off by default — Videasy is the most
  // reliable source and some users prefer that over ad-free.
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
   * Default: videasy at the front, followed by the remaining priority sources.
   * With Pop-up Shield on: stable-partitioned so sandbox-protected sources
   * come first (in priority order) and unprotected ones (videasy) go last.
   */
  getQueue(tmdbId, season, episode) {
    const order = [...this.getPriorityOrder()];
    if (this.getPopupShield()) {
      const protectedSrcs = order.filter((s) => sourceIsProtected(s));
      const unprotectedSrcs = order.filter((s) => !sourceIsProtected(s));
      return [...protectedSrcs, ...unprotectedSrcs];
    }
    const filtered = order.filter((s) => s !== "videasy");
    return ["videasy", ...filtered];
  },
};

import { storage } from "./storage";

const CACHE_PREFIX = "lastGoodSource_";

export const sourceQueue = {
  getPriorityOrder() {
    const custom = storage.get("sourcePriority");
    if (Array.isArray(custom) && custom.length > 0) return custom;
    // Default priority order
    return ["vidsrc", "videasy", "2embed"];
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
   * Places the last successful source at the front if it's less than 24 hours old.
   */
  getQueue(tmdbId, season, episode) {
    const order = [...this.getPriorityOrder()];
    const lastGood = this.getLastGoodSource(tmdbId, season, episode);
    
    if (lastGood && order.includes(lastGood)) {
      const filtered = order.filter((s) => s !== lastGood);
      return [lastGood, ...filtered];
    }
    return order;
  },
};

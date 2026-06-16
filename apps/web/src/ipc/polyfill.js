if (typeof window !== "undefined") {
  if (!window.electron) {
    window.electron = {
      getAppVersion: async () => "1.0.0 (Web)",
      getPlatform: async () => "web",
      getDownloads: async () => [],
      fileExists: async () => false,
      pruneSubtitlePaths: async () => ({ ok: true, subtitlePaths: [] }),
      clearAppCache: async () => {},
      secureGet: async (key) => {
        return localStorage.getItem("streambert_sec_" + key);
      },
      secureSet: async (key, value) => {
        if (value === null || value === undefined) {
          localStorage.removeItem("streambert_sec_" + key);
        } else {
          localStorage.setItem("streambert_sec_" + key, value);
        }
      },
      resolveAllManga: async (args) => {
        try {
          const params = new URLSearchParams();
          params.append("title", args.title || "");
          params.append("season", args.seasonNumber !== undefined ? args.seasonNumber : (args.season || "1"));
          params.append("episode", args.episodeNumber !== undefined ? args.episodeNumber : (args.episode || "1"));
          params.append("translationType", args.translationType || "sub");
          if (args.isMovie) {
            params.append("isMovie", "true");
          }

          const res = await fetch(`/api/resolve-allmanga?` + params.toString());
          if (!res.ok) {
            return { ok: false, error: `HTTP ${res.status}` };
          }
          const json = await res.json();
          if (json?.ok && json.data) {
            return { ok: true, ...json.data };
          }
          return json || { ok: false, error: "Invalid response format" };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
      onM3u8Found: () => () => {},
      offM3u8Found: () => {},
      onSubtitleFound: () => () => {},
      offSubtitleFound: () => {},
      onDownloadProgress: () => () => {},
      offDownloadProgress: () => {},
      onConfirmClose: () => () => {},
      offConfirmClose: () => {},
      respondClose: () => {},
      onWebviewEnterFullscreen: () => () => {},
      offWebviewEnterFullscreen: () => {},
      onWebviewLeaveFullscreen: () => () => {},
      offWebviewLeaveFullscreen: () => {},
      onBlockedUpdate: () => () => {},
      offBlockedUpdate: () => {},
      getBlockStats: async () => ({ total: 0, domains: {} }),
      showNotification: () => {},
      playerStopped: () => {},
      getCacheSize: async () => 0,
      getDownloadsSize: async () => ({ bytes: 0 }),
      clearWatchData: async () => ({ ok: true }),
      deleteAllDownloads: async () => ({ ok: true }),
      resetApp: async () => {
        localStorage.clear();
        return { ok: true };
      },
      searchSubtitles: async () => ({ ok: true, results: [] }),
      getSubtitleUrl: async () => ({ ok: false, error: "Not supported on web" }),
      downloadSubtitlesForFile: async () => ({ ok: false, error: "Not supported on web" }),
      deleteSubtitleFile: async () => ({ ok: true }),
      wyzieOpenRedeem: async () => ({ ok: false, error: "Not supported on web" }),
      wyzieValidateKey: async () => ({ ok: true }),
      openPipWindow: () => {},
      closePipWindow: () => {},
      getPipWebContentsId: async () => null,
      onPipOpened: () => () => {},
      offPipOpened: () => {},
      onPipClosed: () => () => {},
      offPipClosed: () => {},
      windowMinimize: () => {},
      windowToggleMaximize: () => {},
      windowClose: () => {},
      windowIsMaximized: async () => false,
      onWindowMaximize: () => () => {},
      offWindowMaximize: () => {},
      getVideoDuration: async () => 0,
      setZoomFactor: () => {},
      detectUpdateFormat: async () => null,
      downloadAndInstallUpdate: async () => ({ ok: false, error: "Not supported on web" }),
      cancelUpdate: async () => {},
      onUpdateProgress: () => () => {},
      offUpdateProgress: () => {},
      getScheduledBackupSettings: async () => null,
      setScheduledBackupSettings: async () => {},
      performScheduledBackup: async () => {},
      onScheduledBackupRequested: () => () => {},
      offScheduledBackupRequested: () => {},
      setDiscordActivity: () => {},
      clearDiscordActivity: () => {},
      startOauthServer: () => {},
      stopOauthServer: () => {},
      onOauthCallback: () => () => {},
      offOauthCallback: () => {},
      openExternal: (url) => {
        window.open(url, "_blank");
      },
    };
  }

  // Polyfill executeJavaScript for standard same-origin frames, fail silently on cross-origin
  if (!HTMLIFrameElement.prototype.executeJavaScript) {
    HTMLIFrameElement.prototype.executeJavaScript = async function (code) {
      try {
        if (this.contentWindow) {
          // Check same-origin access. Accessing document will throw if cross-origin
          const doc = this.contentWindow.document;
          if (doc) {
            return this.contentWindow.eval(code);
          }
        }
      } catch (err) {
        // Cross-origin iframe or iframe not loaded, resolve to null silently
        console.debug("executeJavaScript suppressed on cross-origin frame:", err);
      }
      return null;
    };
  }

  // Emulate webview-specific event listeners (did-finish-load, did-fail-load) on standard iframes
  const origAddEventListener = HTMLIFrameElement.prototype.addEventListener;
  HTMLIFrameElement.prototype.addEventListener = function (type, listener, options) {
    if (type === "did-finish-load") {
      return origAddEventListener.call(this, "load", listener, options);
    }
    if (type === "did-fail-load") {
      return origAddEventListener.call(this, "error", listener, options);
    }
    if (type === "before-input-event" || type === "will-navigate") {
      return; // stubbed
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  const origRemoveEventListener = HTMLIFrameElement.prototype.removeEventListener;
  HTMLIFrameElement.prototype.removeEventListener = function (type, listener, options) {
    if (type === "did-finish-load") {
      return origRemoveEventListener.call(this, "load", listener, options);
    }
    if (type === "did-fail-load") {
      return origRemoveEventListener.call(this, "error", listener, options);
    }
    if (type === "before-input-event" || type === "will-navigate") {
      return; // stubbed
    }
    return origRemoveEventListener.call(this, type, listener, options);
  };
}

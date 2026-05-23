const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  // m3u8 capture
  onM3u8Found: (cb) => {
    const h = (_, url) => cb(url);
    ipcRenderer.on("m3u8-found", h);
    return h;
  },
  offM3u8Found: (h) => ipcRenderer.removeListener("m3u8-found", h),

  // subtitle capture (.vtt / .srt), cb receives { url, lang }
  onSubtitleFound: (cb) => {
    const h = (_, data) => cb(data);
    ipcRenderer.on("subtitle-found", h);
    return h;
  },
  offSubtitleFound: (h) => ipcRenderer.removeListener("subtitle-found", h),

  // Download progress events
  onDownloadProgress: (cb) => {
    const h = (_, d) => cb(d);
    ipcRenderer.on("download-progress", h);
    return h;
  },
  offDownloadProgress: (h) =>
    ipcRenderer.removeListener("download-progress", h),

  // Download actions
  checkDownloader: (folder) => ipcRenderer.invoke("check-downloader", folder).then((r) => r.ok ? r.data : { exists: false, reason: r.error?.code }),
  runDownload: (args) => ipcRenderer.invoke("run-download", args).then((r) => r.ok ? { ok: true, id: r.data?.id ?? r.id } : { ok: false, error: r.error?.message }),
  getDownloads: () => ipcRenderer.invoke("get-downloads").then((r) => r.ok ? r.data : []),
  deleteDownload: (args) => ipcRenderer.invoke("delete-download", args).then((r) => r.ok ? { ok: true } : { ok: false, error: r.error?.message }),
  showInFolder: (path) => ipcRenderer.invoke("show-in-folder", path).then((r) => r.ok ? r.data : null),
  fileExists: (path) => ipcRenderer.invoke("file-exists", path).then((r) => r.ok ? r.data : false),
  scanDirectory: (path) => ipcRenderer.invoke("scan-directory", path).then((r) => r.ok ? r.data : []),

  // Misc
  pickFolder: () => ipcRenderer.invoke("pick-folder").then((r) => r.ok ? r.data : null),
  openExternal: (url) => ipcRenderer.invoke("open-external", url).then((r) => r.ok ? r.data : null),
  openPath: (filePath) => ipcRenderer.invoke("open-path", filePath).then((r) => r.ok ? r.data : null),
  getInstallPath: () => ipcRenderer.invoke("get-install-path").then((r) => r.ok ? r.data : null),
  openPathAtTime: (filePath, seconds, subtitlePaths) =>
    ipcRenderer.invoke("open-path-at-time", {
      filePath,
      seconds,
      subtitlePaths,
    }).then((r) => r.ok ? r.data : null),
  pruneSubtitlePaths: (downloadId) =>
    ipcRenderer.invoke("prune-subtitle-paths", { downloadId }).then((r) => r.ok ? { ok: true, subtitlePaths: r.data?.subtitlePaths ?? r.subtitlePaths } : { ok: false, error: r.error?.message }),

  // Close confirmation
  onConfirmClose: (cb) => {
    const h = (_, data) => cb(data);
    ipcRenderer.on("confirm-close", h);
    return h;
  },
  offConfirmClose: (h) => ipcRenderer.removeListener("confirm-close", h),
  respondClose: (confirm) => ipcRenderer.send("close-response", confirm),

  // anime episode resolver (main-process HTTP, bypasses CORS/bot-check)
  resolveAllManga: (args) => ipcRenderer.invoke("resolve-allmanga", args).then((r) => r.ok ? { ok: true, ...r.data } : { ok: false, error: r.error?.message }),
  setPlayerVideo: (args) => ipcRenderer.invoke("set-player-video", args).then((r) => r.ok ? { ok: true, ...r.data } : { ok: false, error: r.error?.message }),
  debugAllManga: (args) => ipcRenderer.invoke("debug-allmanga", args).then((r) => r.ok ? r.data : null),

  // App version (from package.json via Electron)
  getAppVersion: () => ipcRenderer.invoke("get-app-version").then((r) => r.ok ? r.data : ""),

  // Webview fullscreen
  onWebviewEnterFullscreen: (cb) => {
    const h = () => cb();
    ipcRenderer.on("webview-enter-fullscreen", h);
    return h;
  },
  offWebviewEnterFullscreen: (h) =>
    ipcRenderer.removeListener("webview-enter-fullscreen", h),
  onWebviewLeaveFullscreen: (cb) => {
    const h = () => cb();
    ipcRenderer.on("webview-leave-fullscreen", h);
    return h;
  },
  offWebviewLeaveFullscreen: (h) =>
    ipcRenderer.removeListener("webview-leave-fullscreen", h),

  // Block stats
  onBlockedUpdate: (cb) => {
    const h = (_, data) => cb(data);
    ipcRenderer.on("blocked-stats-update", h);
    return h;
  },
  offBlockedUpdate: (h) =>
    ipcRenderer.removeListener("blocked-stats-update", h),
  getBlockStats: () => ipcRenderer.invoke("get-block-stats").then((r) => r.ok ? r.data : { total: 0, domains: {} }),

  // Desktop notifications (triggered from renderer, executed in main)
  showNotification: ({ title, body, silent }) =>
    ipcRenderer.invoke("show-notification", { title, body, silent }),

  // Quit app
  quitApp: () => ipcRenderer.invoke("quit-app"),

  // Signal to main process that the player has stopped
  playerStopped: () => ipcRenderer.send("player-stopped"),

  // Storage cleaning
  getCacheSize: () => ipcRenderer.invoke("get-cache-size").then((r) => r.ok ? r.data : 0),
  getDownloadsSize: () => ipcRenderer.invoke("get-downloads-size").then((r) => r.ok ? r.data : { bytes: 0 }),
  clearAppCache: () => ipcRenderer.invoke("clear-app-cache").then((r) => r.ok ? r.data : null),
  queryVideoProgress: (webContentsId) =>
    ipcRenderer.invoke("query-video-progress", webContentsId).then((r) => r.ok ? r.data : null),
  clearWatchData: () => ipcRenderer.invoke("clear-watch-data").then((r) => r.ok ? { ok: true } : { ok: false, error: r.error?.message }),
  deleteAllDownloads: () => ipcRenderer.invoke("delete-all-downloads").then((r) => r.ok ? { ok: true, ...r.data } : { ok: false, error: r.error?.message }),
  resetApp: () => ipcRenderer.invoke("reset-app").then((r) => r.ok ? { ok: true } : { ok: false, error: r.error?.message }),
  // Subtitles
  searchSubtitles: (args) => ipcRenderer.invoke("search-subtitles", args).then((r) => r.ok ? { ok: true, results: r.data } : { ok: false, error: r.error?.message }),
  getSubtitleUrl: (args) => ipcRenderer.invoke("get-subtitle-url", args).then((r) => r.ok ? { ok: true, ...r.data } : { ok: false, error: r.error?.message }),
  downloadSubtitlesForFile: (args) =>
    ipcRenderer.invoke("download-subtitles-for-file", args).then((r) => r.ok ? { ok: true, ...r.data } : { ok: false, error: r.error?.message }),
  deleteSubtitleFile: (args) =>
    ipcRenderer.invoke("delete-subtitle-file", args).then((r) => r.ok ? { ok: true } : { ok: false, error: r.error?.message }),
  // Wyzie API key redemption
  wyzieOpenRedeem: () => ipcRenderer.invoke("wyzie-open-redeem").then((r) => r.ok ? { ok: true, ...r.data } : { ok: false, error: r.error?.message, cancelled: r.cancelled, timeout: r.timeout }),
  wyzieValidateKey: (key) => ipcRenderer.invoke("wyzie-validate-key", key).then((r) => r.ok ? { ok: true } : { ok: false, error: r.error?.message }),
  // Secure key store (OS-encrypted via safeStorage)
  secureGet: (key) =>
    ipcRenderer.invoke("secure-store-get", key).then((r) => r.ok ? (r.data?.value ?? r.value ?? null) : null),
  secureSet: (key, value) =>
    ipcRenderer.invoke("secure-store-set", { key, value }),
  // Picture-in-Picture pop-out (full player UI, only one stream active at a time)
  openPipWindow: (url, title) =>
    ipcRenderer.invoke("open-pip-window", { url, title }),
  closePipWindow: () => ipcRenderer.invoke("close-pip-window"),
  getPipWebContentsId: () => ipcRenderer.invoke("get-pip-webcontents-id").then((r) => r.ok ? r.data : null),
  onPipOpened: (cb) => {
    const h = () => cb();
    ipcRenderer.on("pip-window-opened", h);
    return h;
  },
  offPipOpened: (h) => ipcRenderer.removeListener("pip-window-opened", h),
  onPipClosed: (cb) => {
    const h = () => cb();
    ipcRenderer.on("pip-window-closed", h);
    return h;
  },
  offPipClosed: (h) => ipcRenderer.removeListener("pip-window-closed", h),
  // Window controls (Windows custom titlebar)
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowToggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized").then((r) => r.ok ? r.data : false),
  getPlatform: () => ipcRenderer.invoke("get-platform").then((r) => r.ok ? r.data : process.platform),
  // Push events: main process emits "window-maximized" with a boolean payload
  onWindowMaximize: (cb) => {
    const h = (_, v) => cb(v);
    ipcRenderer.on("window-maximized", h);
    return h;
  },
  offWindowMaximize: (h) => ipcRenderer.removeListener("window-maximized", h),
  getVideoDuration: (filePath) =>
    ipcRenderer.invoke("get-video-duration", filePath),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  // Auto-updater
  detectUpdateFormat: () => ipcRenderer.invoke("detect-update-format").then((r) => r.ok ? r.data : null),
  downloadAndInstallUpdate: (args) =>
    ipcRenderer.invoke("download-and-install-update", args).then((r) => r.ok ? { ok: true, ...r.data } : { ok: false, error: r.error?.message }),
  cancelUpdate: () => ipcRenderer.invoke("cancel-update").then((r) => r.ok ? r.data : null),
  onUpdateProgress: (cb) => {
    const h = (_, data) => cb(data);
    ipcRenderer.on("update-progress", h);
    return h;
  },
  offUpdateProgress: (h) => ipcRenderer.removeListener("update-progress", h),
  // Scheduled backups
  getScheduledBackupSettings: () =>
    ipcRenderer.invoke("get-scheduled-backup-settings").then((r) => r.ok ? r.data : null),
  setScheduledBackupSettings: (settings) =>
    ipcRenderer.invoke("set-scheduled-backup-settings", settings),
  performScheduledBackup: (args) =>
    ipcRenderer.invoke("perform-scheduled-backup", args),
  onScheduledBackupRequested: (cb) => {
    const h = () => cb();
    ipcRenderer.on("scheduled-backup-requested", h);
    return h;
  },
  offScheduledBackupRequested: (h) =>
    ipcRenderer.removeListener("scheduled-backup-requested", h),
});

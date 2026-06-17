import { useState, useEffect, useRef } from "react";
import {
  PlayIcon,
  PauseIcon,
  MaximizeIcon,
  VolumeIcon,
  VolumeMuteIcon,
  SettingsIcon,
  BackIcon
} from "./Icons";
import { storage, STORAGE_KEYS } from "../utils/storage";
import { scrobbleAnilist } from "../utils/oauth";
import { getHighestOriginalEpisode } from "../utils/onepaceMapping";
import "../styles/onepacePlayer.css";

export default function OnePacePlayer({
  arc,
  episode,
  progress = {},
  saveProgress,
  onBack,
  onPlayEpisode,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const resolutions = Object.keys(episode.resolutions);
  const defaultRes = storage.get("onepaceDefaultResolution") || "1080p";
  const initialRes = resolutions.includes(defaultRes) ? defaultRes : resolutions[0];
  const [resolution, setResolution] = useState(initialRes);

  const [subtitles, setSubtitles] = useState([]);
  const [activeSubId, setActiveSubId] = useState("off");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => storage.get("playerVolume") ?? 0.8);
  const [isMuted, setIsMuted] = useState(() => storage.get("playerMuted") ?? false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);

  const [playError, setPlayError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const [showUpNext, setShowUpNext] = useState(false);
  const [upNextCount, setUpNextCount] = useState(10);
  const nextEpisode = arc.episodes.find(e => e.episodeNumber === episode.episodeNumber + 1);

  const controlsTimeoutRef = useRef(null);
  const upNextTimerRef = useRef(null);

  const videoUrl = episode.resolutions[resolution]?.url || "";

  useEffect(() => {
    let mounted = true;
    const loadedSubs = [];

    const loadAllSubs = async () => {
      for (const sub of episode.subtitles) {
        try {
          const res = await fetch(sub.url);
          if (!res.ok) continue;
          const srtText = await res.text();
          const vttText = "WEBVTT\n\n" + srtText
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
          const blob = new Blob([vttText], { type: "text/vtt" });
          const blobUrl = URL.createObjectURL(blob);
          loadedSubs.push({ ...sub, blobUrl });
        } catch (e) {
          console.error("Failed parsing subtitle", sub.lang, e);
        }
      }
      if (mounted) {
        setSubtitles(loadedSubs);
        if (loadedSubs.length > 0) setActiveSubId(loadedSubs[0].id);
      }
    };

    loadAllSubs();
    return () => {
      mounted = false;
      loadedSubs.forEach(s => URL.revokeObjectURL(s.blobUrl));
    };
  }, [episode]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    handleMouseMove();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isPlaying]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    const progressKey = `onepace.${arc.id}.${episode.episodeNumber}`;
    const pct = progress[progressKey] || 0;
    if (pct > 0 && pct < 90) {
      video.currentTime = (pct / 100) * video.duration;
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    const pct = Math.round((video.currentTime / video.duration) * 100);
    const progressKey = `onepace.${arc.id}.${episode.episodeNumber}`;

    saveProgress(progressKey, pct, {
      item: { id: arc.slug, title: `${arc.name} - One Pace`, name: `${arc.name} - One Pace`, genres: [16] },
      season: 1,
      episode: episode.episodeNumber,
      position: video.currentTime,
      duration: video.duration,
      source: "Pixeldrain",
      episodeTitle: episode.title
    });

    const syncAnilist = storage.get(STORAGE_KEYS.SYNC_ONE_PACE_ANILIST) === true;
    const isLastEpisode = episode.episodeNumber === arc.episodeCount;
    if (pct >= 90 && isLastEpisode && syncAnilist && !window[`__onepace_anilist_${arc.id}`]) {
      window[`__onepace_anilist_${arc.id}`] = true;
      const highestOriginal = getHighestOriginalEpisode(arc.id);
      if (highestOriginal) {
        scrobbleAnilist(21, highestOriginal, "CURRENT")
          .then(() => showToast(`✓ Synced Arc progress to AniList (Episode ${highestOriginal})`))
          .catch(err => console.error("AniList One Pace sync failed:", err));
      }
    }

    if (pct >= 90 && nextEpisode && !showUpNext) {
      setShowUpNext(true);
    }
  };

  useEffect(() => {
    if (showUpNext) {
      upNextTimerRef.current = setInterval(() => {
        setUpNextCount(prev => {
          if (prev <= 1) {
            clearInterval(upNextTimerRef.current);
            handleNextEpisode();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (upNextTimerRef.current) clearInterval(upNextTimerRef.current); };
  }, [showUpNext]);

  const handleNextEpisode = () => {
    if (nextEpisode && onPlayEpisode) onPlayEpisode(arc, nextEpisode);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch(e => {
        console.error("Playback failed:", e);
        setPlayError(e.message);
      });
    }
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    video.currentTime = percentage * video.duration;
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    setVolume(val);
    video.volume = val;
    setIsMuted(val === 0);
    storage.set("playerVolume", val);
    storage.set("playerMuted", val === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    video.muted = nextMute;
    storage.set("playerMuted", nextMute);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error("Fullscreen failed:", err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const video = videoRef.current;
      if (!video) return;
      switch (e.code) {
        case "Space": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": e.preventDefault(); video.currentTime = Math.min(video.duration, video.currentTime + 10); showToast("+10s"); break;
        case "ArrowLeft": e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); showToast("-10s"); break;
        case "ArrowUp": {
          e.preventDefault();
          const upVol = Math.min(1, volume + 0.1);
          setVolume(upVol); video.volume = upVol; video.muted = false; setIsMuted(false);
          storage.set("playerVolume", upVol);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const downVol = Math.max(0, volume - 0.1);
          setVolume(downVol); video.volume = downVol; video.muted = downVol === 0; setIsMuted(downVol === 0);
          storage.set("playerVolume", downVol);
          break;
        }
        case "KeyF": e.preventDefault(); toggleFullscreen(); break;
        case "Escape":
          if (isFullscreen) document.exitFullscreen();
          else onBack();
          break;
        default: break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, volume, isFullscreen]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const formattedS = s < 10 ? `0${s}` : s;
    if (h > 0) { const formattedM = m < 10 ? `0${m}` : m; return `${h}:${formattedM}:${formattedS}`; }
    return `${m}:${formattedS}`;
  };

  const selectResolution = (res) => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    setResolution(res);
    storage.set("onepaceDefaultResolution", res);
    const resumeAfterLoad = () => {
      video.currentTime = time;
      video.play().then(() => setIsPlaying(true));
      video.removeEventListener("canplay", resumeAfterLoad);
    };
    video.addEventListener("canplay", resumeAfterLoad);
    setShowQualityMenu(false);
  };

  const copyPixeldrainLink = () => {
    const pixeldrainId = episode.resolutions[resolution]?.pixeldrainId;
    const url = pixeldrainId ? `https://pixeldrain.com/u/${pixeldrainId}` : "";
    navigator.clipboard.writeText(url);
    showToast("✓ Pixeldrain link copied!");
  };

  return (
    <div
      ref={containerRef}
      className={`onepace-player-container ${showControls ? "show-controls" : ""}`}
      onMouseMove={handleMouseMove}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      {showControls && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)", padding: "24px 30px", display: "flex", alignItems: "center", gap: 16, zIndex: 101 }}>
          <button onClick={onBack} className="onepace-control-btn" title="Back">
            <BackIcon size={20} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{arc.name}</div>
            <div style={{ fontSize: 13, color: "#ccc" }}>Episode {episode.episodeNumber}: {episode.title}</div>
          </div>
        </div>
      )}

      {videoUrl && !playError && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="onepace-video"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          autoPlay
          crossOrigin="anonymous"
          onError={() => setPlayError("Pixeldrain stream error. Try swapping resolution or copy the link.")}
        >
          {subtitles.map(sub => (
            <track key={sub.id} label={sub.lang} kind="subtitles" srcLang={sub.language} src={sub.blobUrl} default={sub.id === activeSubId} />
          ))}
        </video>
      )}

      {playError && (
        <div className="onepace-fallback">
          <h2 className="onepace-fallback-title">Stream Offline</h2>
          <p className="onepace-fallback-text">{playError}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={copyPixeldrainLink} className="btn btn-primary" style={{ padding: "8px 16px" }}>
              Copy Pixeldrain Link
            </button>
            <button onClick={() => window.open("https://onepace.net", "_blank", "noopener")} className="btn btn-secondary" style={{ padding: "8px 16px" }}>
              Open onepace.net
            </button>
            <button onClick={() => setPlayError(null)} className="btn btn-ghost" style={{ padding: "8px 16px" }}>
              Retry
            </button>
          </div>
        </div>
      )}

      {toastMessage && <div className="onepace-toast">{toastMessage}</div>}

      {showUpNext && nextEpisode && (
        <div className="onepace-up-next">
          <div className="onepace-up-next-title">Up Next in {upNextCount}s</div>
          <div className="onepace-up-next-ep">Episode {nextEpisode.episodeNumber}: {nextEpisode.title}</div>
          <p className="onepace-up-next-desc">{nextEpisode.overview}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowUpNext(false); if (upNextTimerRef.current) clearInterval(upNextTimerRef.current); }} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>Cancel</button>
            <button onClick={handleNextEpisode} className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>Play Now</button>
          </div>
        </div>
      )}

      {showControls && !playError && (
        <div className="onepace-controls-overlay">
          <div className="onepace-progress-container" onClick={handleSeek}>
            <div className="onepace-progress-bar" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}>
              <div className="onepace-progress-handle" />
            </div>
          </div>

          <div className="onepace-controls-row">
            <div className="onepace-controls-group">
              <button onClick={togglePlay} className="onepace-control-btn" title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
              </button>
              <div className="onepace-volume-container">
                <button onClick={toggleMute} className="onepace-control-btn" title={isMuted ? "Unmute" : "Mute"}>
                  {isMuted ? <VolumeMuteIcon size={20} /> : <VolumeIcon size={20} />}
                </button>
                <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="onepace-volume-slider" />
              </div>
              <div className="onepace-time-display">{formatTime(currentTime)} / {formatTime(duration)}</div>
            </div>

            <div className="onepace-controls-group">
              {subtitles.length > 0 && (
                <div className="onepace-dropdown">
                  <button onClick={() => { setShowSubMenu(!showSubMenu); setShowQualityMenu(false); }} className="onepace-control-btn" title="Subtitles">
                    <span style={{ fontSize: 12, fontWeight: 700, border: "2px solid", borderRadius: 3, padding: "0 3px" }}>CC</span>
                  </button>
                  {showSubMenu && (
                    <div className="onepace-dropdown-menu">
                      <button onClick={() => { setActiveSubId("off"); setShowSubMenu(false); }} className={`onepace-dropdown-item ${activeSubId === "off" ? "active" : ""}`}>Off</button>
                      {subtitles.map(sub => (
                        <button key={sub.id} onClick={() => { setActiveSubId(sub.id); setShowSubMenu(false); }} className={`onepace-dropdown-item ${activeSubId === sub.id ? "active" : ""}`}>{sub.lang}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {resolutions.length > 1 && (
                <div className="onepace-dropdown">
                  <button onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSubMenu(false); }} className="onepace-control-btn" title="Quality">
                    <SettingsIcon size={20} />
                  </button>
                  {showQualityMenu && (
                    <div className="onepace-dropdown-menu">
                      {resolutions.map(res => (
                        <button key={res} onClick={() => selectResolution(res)} className={`onepace-dropdown-item ${resolution === res ? "active" : ""}`}>{res}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button onClick={toggleFullscreen} className="onepace-control-btn" title="Fullscreen">
                <MaximizeIcon size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

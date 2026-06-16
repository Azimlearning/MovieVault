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
  progress,
  saveProgress,
  onBack,
  onPlayEpisode,
  partySession,
  onToggleWatchParty,
  onPlayerStateUpdate,
  onPlayerTitleChange,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Resolution selection
  const resolutions = Object.keys(episode.resolutions); // e.g. ['1080p']
  const defaultRes = storage.get("onepaceDefaultResolution") || "1080p";
  const initialRes = resolutions.includes(defaultRes) ? defaultRes : resolutions[0];
  const [resolution, setResolution] = useState(initialRes);

  // Subtitles selection
  const [subtitles, setSubtitles] = useState([]); // [{ id, lang, url, blobUrl }]
  const [activeSubId, setActiveSubId] = useState("off"); // 'off' or sub.id

  // Player UI states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => storage.get("playerVolume") ?? 0.8);
  const [isMuted, setIsMuted] = useState(() => storage.get("playerMuted") ?? false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);

  // Playback errors / Fallbacks
  const [playError, setPlayError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Up Next Countdown
  const [showUpNext, setShowUpNext] = useState(false);
  const [upNextCount, setUpNextCount] = useState(10);
  const nextEpisode = arc.episodes.find(e => e.episodeNumber === episode.episodeNumber + 1);

  const controlsTimeoutRef = useRef(null);
  const upNextTimerRef = useRef(null);

  // 1. Get video source URL
  const videoUrl = episode.resolutions[resolution]?.url || "";

  // 2. Fetch and convert subtitles (.srt -> VTT Blob)
  useEffect(() => {
    let mounted = true;
    const loadedSubs = [];

    const loadAllSubs = async () => {
      for (const sub of episode.subtitles) {
        try {
          const res = await fetch(sub.url);
          if (!res.ok) continue;
          const srtText = await res.text();
          
          // SRT to VTT translation
          const vttText = "WEBVTT\n\n" + srtText
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

          const blob = new Blob([vttText], { type: "text/vtt" });
          const blobUrl = URL.createObjectURL(blob);
          
          loadedSubs.push({
            ...sub,
            blobUrl
          });
        } catch (e) {
          console.error("Failed parsing subtitle", sub.lang, e);
        }
      }

      if (mounted) {
        setSubtitles(loadedSubs);
        if (loadedSubs.length > 0) {
          // Default to first English/available subtitle track
          setActiveSubId(loadedSubs[0].id);
        }
      }
    };

    loadAllSubs();

    return () => {
      mounted = false;
      // Revoke blob URLs to prevent memory leak
      loadedSubs.forEach(s => URL.revokeObjectURL(s.blobUrl));
    };
  }, [episode]);

  // 3. Keep video controls active or hide on idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    handleMouseMove();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // 4. Handle video duration & metadata load
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);

    // Resume watch progress if exists
    const progressKey = `onepace.${arc.id}.${episode.episodeNumber}`;
    const pct = progress[progressKey] || 0;
    if (pct > 0 && pct < 90) {
      video.currentTime = (pct / 100) * video.duration;
    }
  };

  // 5. Handle progress save and integrations sync
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    const pct = Math.round((video.currentTime / video.duration) * 100);
    const progressKey = `onepace.${arc.id}.${episode.episodeNumber}`;

    // Throttle progress save in React State (Debounced storage writes inside saveProgress)
    saveProgress(progressKey, pct, {
      item: {
        id: arc.slug,
        title: `${arc.name} - One Pace`,
        name: `${arc.name} - One Pace`,
        genres: [16] // Anime
      },
      season: 1, // Arcs act as series/seasons
      episode: episode.episodeNumber,
      position: video.currentTime,
      duration: video.duration,
      source: "Pixeldrain",
      episodeTitle: episode.title
    });

    // Sync to AniList on arc completion (last episode watched >= 90%)
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

    // Up Next Card countdown trigger at 90% completion
    if (pct >= 90 && nextEpisode && !showUpNext) {
      setShowUpNext(true);
    }

    if (onPlayerStateUpdate) {
      onPlayerStateUpdate(video.currentTime, !video.paused);
    }
  };

  // 6. Up Next Timer countdown
  useEffect(() => {
    if (showUpNext) {
      upNextTimerRef.current = setInterval(() => {
        setUpNextCount(prev => {
          if (prev <= 1) {
            clearInterval(upNextTimerRef.current);
            // Autoplay next episode
            handleNextEpisode();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
    };
  }, [showUpNext]);

  const handleNextEpisode = () => {
    if (nextEpisode && onPlayEpisode) {
      onPlayEpisode(arc, nextEpisode);
    }
  };

  // Notify watch party of title change
  useEffect(() => {
    onPlayerTitleChange?.({
      type: "onepace",
      arcName: arc.name,
      fileUrl: videoUrl,
      title: `${arc.name} - One Pace - Episode ${episode.episodeNumber}`
    });
  }, [arc, episode, videoUrl, onPlayerTitleChange]);

  // 7. Video keyboard and mouse control handlers
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
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
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
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {
        console.error("Fullscreen request failed:", err);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Sync state on fullscreen changes (esc key)
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Keyboard shortcuts (space play, arrows seek, etc.)
  useEffect(() => {
    const handler = (e) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          showToast("+10s");
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          showToast("-10s");
          break;
        case "ArrowUp":
          e.preventDefault();
          const upVol = Math.min(1, volume + 0.1);
          setVolume(upVol);
          video.volume = upVol;
          video.muted = false;
          setIsMuted(false);
          storage.set("playerVolume", upVol);
          break;
        case "ArrowDown":
          e.preventDefault();
          const downVol = Math.max(0, volume - 0.1);
          setVolume(downVol);
          video.volume = downVol;
          video.muted = downVol === 0;
          setIsMuted(downVol === 0);
          storage.set("playerVolume", downVol);
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "Escape":
          if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onBack();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, volume, isFullscreen]);

  // Toast notifications helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Helper formatting seconds
  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const formattedS = s < 10 ? `0${s}` : s;
    if (h > 0) {
      const formattedM = m < 10 ? `0${m}` : m;
      return `${h}:${formattedM}:${formattedS}`;
    }
    return `${m}:${formattedS}`;
  };

  // Resolution switch helper
  const selectResolution = (res) => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    setResolution(res);
    storage.set("onepaceDefaultResolution", res);
    
    // Resume current playhead on source switch
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
    const url = pixeldrainId
      ? `https://pixeldrain.com/u/${pixeldrainId}`
      : `https://pixeldrain.com/api/file/${episode.resolutions[resolution]?.pixeldrainId}?download`;
    navigator.clipboard.writeText(url || "");
    showToast("✓ Pixeldrain link copied!");
  };

  return (
    <div
      ref={containerRef}
      className={`onepace-player-container ${showControls ? "show-controls" : ""}`}
      onMouseMove={handleMouseMove}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      {/* Watch Party Sync Offset Indicator */}
      {partySession && (
        <div
          style={{
            position: "absolute",
            top: 72,
            right: 30,
            zIndex: 101,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            borderRadius: 16,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: "#fff",
            pointerEvents: "none",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 4
          }}
        >
          <span style={{ color: "var(--red)" }}>●</span>
          <span>Party Sync: +{storage.get("partySyncOffset") ?? 1.5}s</span>
        </div>
      )}
      {/* Title / Back Panel top */}
      {showControls && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)",
            padding: "24px 30px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 101
          }}
        >
          <button onClick={onBack} className="onepace-control-btn" title="Back">
            <BackIcon size={20} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {arc.name}
            </div>
            <div style={{ fontSize: 13, color: "#ccc" }}>
              Episode {episode.episodeNumber}: {episode.title}
            </div>
          </div>
        </div>
      )}

      {/* Main Video */}
      {videoUrl && !playError && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="onepace-video"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => {
            setIsPlaying(true);
            onPlayerStateUpdate?.(videoRef.current?.currentTime || 0, true);
          }}
          onPause={() => {
            setIsPlaying(false);
            onPlayerStateUpdate?.(videoRef.current?.currentTime || 0, false);
          }}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          autoPlay
          crossOrigin="anonymous"
          onError={(e) => setPlayError("Pixeldrain stream error. Try swapping resolution or copy the magnet.")}
        >
          {/* Active text tracks converted from SRT */}
          {subtitles.map(sub => (
            <track
              key={sub.id}
              label={sub.lang}
              kind="subtitles"
              srcLang={sub.language}
              src={sub.blobUrl}
              default={sub.id === activeSubId}
            />
          ))}
        </video>
      )}

      {/* Playback Errors fallback card */}
      {playError && (
        <div className="onepace-fallback">
          <h2 className="onepace-fallback-title">Stream Offline</h2>
          <p className="onepace-fallback-text">
            {playError}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={copyPixeldrainLink} className="btn btn-primary" style={{ padding: "8px 16px" }}>
              Copy Pixeldrain Link
            </button>
            <button onClick={() => window.electron.openExternal("https://onepace.net")} className="btn btn-secondary" style={{ padding: "8px 16px" }}>
              Open onepace.net
            </button>
            <button onClick={() => setPlayError(null)} className="btn btn-ghost" style={{ padding: "8px 16px" }}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Toast popup */}
      {toastMessage && <div className="onepace-toast">{toastMessage}</div>}

      {/* Up Next Card overlay */}
      {showUpNext && nextEpisode && (
        <div className="onepace-up-next">
          <div className="onepace-up-next-title">Up Next in {upNextCount}s</div>
          <div className="onepace-up-next-ep">Episode {nextEpisode.episodeNumber}: {nextEpisode.title}</div>
          <p className="onepace-up-next-desc">{nextEpisode.overview}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setShowUpNext(false);
                if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
              }}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              onClick={handleNextEpisode}
              className="btn btn-primary"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              Play Now
            </button>
          </div>
        </div>
      )}

      {/* Custom HTML5 video controls at bottom */}
      {showControls && !playError && (
        <div className="onepace-controls-overlay">
          {/* Progress Seek Bar */}
          <div className="onepace-progress-container" onClick={handleSeek}>
            <div
              className="onepace-progress-bar"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="onepace-progress-handle" />
            </div>
          </div>

          <div className="onepace-controls-row">
            {/* Play & Vol controls left */}
            <div className="onepace-controls-group">
              <button onClick={togglePlay} className="onepace-control-btn" title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
              </button>

              <div className="onepace-volume-container">
                <button onClick={toggleMute} className="onepace-control-btn" title={isMuted ? "Unmute" : "Mute"}>
                  {isMuted ? <VolumeMuteIcon size={20} /> : <VolumeIcon size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="onepace-volume-slider"
                />
              </div>

              <div className="onepace-time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Quality, Subs & Fullscreen controls right */}
            <div className="onepace-controls-group">
              {/* Subtitles Picker */}
              {subtitles.length > 0 && (
                <div className="onepace-dropdown">
                  <button
                    onClick={() => {
                      setShowSubMenu(!showSubMenu);
                      setShowQualityMenu(false);
                    }}
                    className="onepace-control-btn"
                    title="Subtitles"
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, border: "2px solid", borderRadius: 3, padding: "0 3px" }}>CC</span>
                  </button>
                  {showSubMenu && (
                    <div className="onepace-dropdown-menu">
                      <button
                        onClick={() => {
                          setActiveSubId("off");
                          setShowSubMenu(false);
                        }}
                        className={`onepace-dropdown-item ${activeSubId === "off" ? "active" : ""}`}
                      >
                        Off
                      </button>
                      {subtitles.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setActiveSubId(sub.id);
                            setShowSubMenu(false);
                          }}
                          className={`onepace-dropdown-item ${activeSubId === sub.id ? "active" : ""}`}
                        >
                          {sub.lang}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quality Picker */}
              {resolutions.length > 1 && (
                <div className="onepace-dropdown">
                  <button
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu);
                      setShowSubMenu(false);
                    }}
                    className="onepace-control-btn"
                    title="Quality"
                  >
                    <SettingsIcon size={20} />
                  </button>
                  {showQualityMenu && (
                    <div className="onepace-dropdown-menu">
                      {resolutions.map(res => (
                        <button
                          key={res}
                          onClick={() => selectResolution(res)}
                          className={`onepace-dropdown-item ${resolution === res ? "active" : ""}`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Watch Party button */}
              <button
                onClick={onToggleWatchParty}
                className="onepace-control-btn"
                title={partySession ? "Watch Party active" : "Start Watch Party"}
                style={partySession ? { color: "var(--red)" } : undefined}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </button>
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

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  memo,
  useCallback,
  useMemo,
} from "react";
import AsyncBoundary from "../components/AsyncBoundary";
import PlayerTroubleBar from "../components/PlayerTroubleBar";
import { canonicaliseTitleSlug } from "../utils/router";
import {
  REACHABILITY,
  pickReachableSource,
  probeReachable,
} from "../utils/sourceHealth";
import { sourceQueue } from "../utils/sourceQueue";
import {
  tmdbFetch,
  imgUrl,
  PLAYER_SOURCES,
  getSourceUrl,
  sourceSupportsProgress,
  sourceProgressViaFrames,
  sourceIsAsync,
  sourceSandbox,
  sourceIsProtected,
  fetchAnilistData,
  cleanAnilistDescription,
  isAnimeContent,
  ANIME_DEFAULT_SOURCE,
  NON_ANIME_DEFAULT_SOURCE,
  NEEDS_INTERCEPT,
} from "../utils/api";
import {
  PlayIcon,
  BookmarkIcon,
  BookmarkFillIcon,
  BackIcon,
  StarIcon,
  FilmIcon,
  DownloadIcon,
  WatchedIcon,
  TrailerIcon,
  SourceIcon,
  ShieldBlockIcon,
  PopOutIcon,
  FullscreenIcon,
} from "../components/Icons";
import DownloadModal from "../components/DownloadModal";
import TrailerModal from "../components/TrailerModal";
import BlockedStatsModal from "../components/BlockedStatsModal";
import PopupShieldModal from "../components/PopupShieldModal";
import { useBlockedStats } from "../utils/useBlockedStats";
import MediaCard from "../components/MediaCard";
import { storage } from "../utils/storage";
import {
  fetchMovieRating,
  isRestricted,
  getAgeLimitSetting,
  getRatingCountry,
} from "../utils/ageRating";
import CastRow from "../components/CastRow";
import SimilarRow from "../components/SimilarRow";
import RatingBadge from "../components/RatingBadge";

export default function MoviePage({
  item,
  apiKey,
  onSave,
  isSaved,
  onHistory,
  progress,
  saveProgress,
  onBack,
  onSettings,
  onDownloadStarted,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  downloads,
  onGoToDownloads,
  onSelect,
  onSearch,
}) {
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  // A deep-linked page starts from a URL stub with no title, so the tab would
  // stay generic until the user navigated again. Name it once TMDB answers.
  useEffect(() => {
    const resolved = details?.title || item?.title;
    if (!resolved) return;
    document.title = `${resolved} — MovieVault`;
    canonicaliseTitleSlug(item?.id, resolved);
  }, [details, item]);
  const [playing, setPlaying] = useState(() => !!item?.playDirectly);
  // Teardown §6.5: the end of a film is the start of the next decision. An
  // embedded provider never tells us it finished, so this is raised by the only
  // completion signal the web build actually has — the user marking 100%.
  const [postPlay, setPostPlay] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [m3u8Url, setM3u8Url] = useState(null);
  const [interceptedSubs, setInterceptedSubs] = useState([]);
  const [playerSource, setPlayerSource] = useState(
    () => storage.get("playerSource") || NON_ANIME_DEFAULT_SOURCE,
  );
  const progressViaFrames = useMemo(
    () => sourceProgressViaFrames(playerSource),
    [playerSource],
  );
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [dubMode, setDubMode] = useState(
    () => storage.get("allmangaDubMode") || "sub",
  );
  const [anilistData, setAnilistData] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const sourceRef = useRef(null);
  const playerWrapRef = useRef(null);
  const cssFullscreenRef = useRef(false);
  const webviewRef = useRef(null);
  // Always-current refs for interval callbacks, avoids stale closures without restarting the interval
  const saveProgressRef = useRef(saveProgress);
  saveProgressRef.current = saveProgress;
  const onMarkWatchedRef = useRef(onMarkWatched);
  onMarkWatchedRef.current = onMarkWatched;
  // AllManga async URL resolution
  const [resolvedPlayerUrl, setResolvedPlayerUrl] = useState(null);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const [collection, setCollection] = useState(null); // { name, parts }
  // Webview loading overlay
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(false);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  // pipOpen=true: main webview shows about:blank, pop-out window has the real player
  const [pipOpen, setPipOpen] = useState(false);
  const pipUrlRef = useRef(null); // URL to restore when pop-out closes
  const pipWebContentsIdRef = useRef(null); // cached WebContents ID of the pop-out window
  
  const [failoverQueue, setFailoverQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [failoverError, setFailoverError] = useState(false);
  const timeoutRef = useRef(null);

  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [feedbackText, setFeedbackText] = useState(null);
  const feedbackTimerRef = useRef(null);

  const [downloaderFolder, setDownloaderFolder] = useState(
    () => storage.get("downloaderFolder") || "",
  );
  const [rating, setRating] = useState({ cert: null, minAge: null });
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);

  const progressKey = `movie_${item.id}`;
  const {
    sessionTotal: blockedSession,
    alltimeTotal: blockedAlltime,
    showModal: showBlockedModal,
    setShowModal: setShowBlockedModal,
    getSessionDomains: getBlockedDomains,
  } = useBlockedStats(item.id);
  const pct = progress[progressKey] || 0;
  const isWatched = !!watched?.[progressKey];
  const hasProgress = pct > 0;

  const d = details || item;
  const title = d.title || d.name;
  const year = (d.release_date || "").slice(0, 4);
  const mediaName = `${title}${year ? " (" + year + ")" : ""}`;

  const isAnime = useMemo(
    () => isAnimeContent(item, details),
    [item.id, details],
  );

  const { watchedSecs, totalSecs, displayPct, progressLabel, remainingLabel } =
    useMemo(() => {
    const watchedSecs = storage.get("dlTime_" + progressKey) || 0;
    const totalSecs = d?.runtime ? d.runtime * 60 : 0;
    const derivedPct =
      watchedSecs > 0 && totalSecs > 0
        ? Math.floor((watchedSecs / totalSecs) * 100)
        : 0;
    const displayPct = pct > 0 ? pct : derivedPct;
    const fmt = (s) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
        : `${m}:${String(sec).padStart(2, "0")}`;
    };
    const progressLabel =
      watchedSecs > 0 && totalSecs > 0
        ? `${fmt(watchedSecs)} / ${fmt(totalSecs)}`
        : watchedSecs > 0
          ? fmt(watchedSecs)
          : displayPct > 0
            ? `${displayPct}%`
            : null;
    const remainingSecs =
      totalSecs > 0
        ? Math.max(
            0,
            totalSecs -
              (watchedSecs > 0 ? watchedSecs : (displayPct / 100) * totalSecs),
          )
        : 0;
    const remainingLabel =
      remainingSecs >= 3600
        ? `${Math.floor(remainingSecs / 3600)}h ${Math.round(
            (remainingSecs % 3600) / 60,
          )}m left`
        : remainingSecs >= 60
          ? `${Math.round(remainingSecs / 60)}m left`
          : null;
    return {
      watchedSecs,
      totalSecs,
      displayPct,
      progressLabel,
      remainingLabel,
    };
  }, [progressKey, pct, d?.runtime]);

  // Teardown §4: the primary CTA says where the user actually is, so nobody has
  // to remember whether they finished this or stopped twenty minutes in.
  const playLabel = playing
    ? "Restart"
    : isWatched
      ? "Watch again"
      : displayPct > 0
        ? remainingLabel
          ? `Resume · ${remainingLabel}`
          : "Resume"
        : "Play";

  const [watchedThreshold] = useState(
    () => storage.get("watchedThreshold") ?? 20,
  );

  const ageLimitSetting = useMemo(() => getAgeLimitSetting(storage), []);
  const ratingCountry = useMemo(() => getRatingCountry(storage), []);
  const restricted = isRestricted(rating.minAge, ageLimitSetting);

  // Ref to prevent double-marking
  const autoMarkedRef = useRef(false);
  // Tracks last known playback position, used to detect resolution-change resets
  const lastKnownTimeRef = useRef(0);
  const hasSeekedSavedTimeRef = useRef(false);
  // Timestamp until which we ignore reset detection (post-seekback cooldown)
  const seekBackCooldownRef = useRef(0);

  const showFeedback = useCallback((text) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackText(text);
    feedbackTimerRef.current = setTimeout(() => setFeedbackText(null), 2000);
  }, []);

  // A provider blocked at the network level — DNS filter, ad blocker, VPN, or a
  // mobile carrier — loads an error page that fires the iframe's `load` event
  // like a success would. Probing once per play lets us move to a provider the
  // user's network actually allows, instead of leaving them on a black frame.
  const autoSwitchedRef = useRef(false);
  useEffect(() => {
    autoSwitchedRef.current = false;
  }, [item.id]);

  useEffect(() => {
    if (!playing || autoSwitchedRef.current || sourceIsAsync(playerSource)) {
      return undefined;
    }
    let active = true;
    const buildUrl = (id) => getSourceUrl(id, "movie", item.id, null, null);

    probeReachable(buildUrl(playerSource)).then(async (result) => {
      if (!active || result !== REACHABILITY.BLOCKED) return;
      const alternatives = PLAYER_SOURCES.filter(
        (src) => src.id !== playerSource && !src.async,
      ).map((src) => src.id);
      const next = await pickReachableSource(alternatives, buildUrl);
      if (!active || !next) return;

      autoSwitchedRef.current = true;
      const blockedLabel =
        PLAYER_SOURCES.find((src) => src.id === playerSource)?.label ?? "Source";
      const nextLabel =
        PLAYER_SOURCES.find((src) => src.id === next)?.label ?? next;
      showFeedback(`${blockedLabel} is blocked here — switched to ${nextLabel}`);

      setFailoverQueue([next]);
      setCurrentQueueIndex(0);
      setPlayerSource(next);
      setFailoverError(false);
      setWebviewLoading(true);
      storage.set("playerSource", next);
      setM3u8Url(null);
      setInterceptedSubs([]);
      setResolvedPlayerUrl(null);
      setResolvingUrl(false);
      setResolveError(null);
    });

    return () => {
      active = false;
    };
  }, [playing, playerSource, item.id, showFeedback]);

  // Use the browser Fullscreen API when available, with the CSS fullscreen
  // layout as a fallback for browsers/embedded contexts that reject it.
  const togglePlayerFullscreen = useCallback(async () => {
    const container = playerWrapRef.current;
    const isFullscreen = Boolean(document.fullscreenElement) || playerFullscreen;

    if (isFullscreen) {
      cssFullscreenRef.current = false;
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {}
      setPlayerFullscreen(false);
      document.documentElement.removeAttribute("data-player-fullscreen");
      return;
    }

    try {
      if (container?.requestFullscreen) {
        await container.requestFullscreen();
      }
    } catch {}

    // Keep the app-level layout working even when the API is unavailable.
    cssFullscreenRef.current = !document.fullscreenElement;
    setPlayerFullscreen(true);
    document.documentElement.setAttribute("data-player-fullscreen", "1");
  }, [playerFullscreen]);

  useEffect(() => {
    const syncFullscreenState = () => {
      if (document.fullscreenElement === playerWrapRef.current) {
        setPlayerFullscreen(true);
        document.documentElement.setAttribute("data-player-fullscreen", "1");
      } else if (document.fullscreenElement === null && playerFullscreen && !cssFullscreenRef.current) {
        setPlayerFullscreen(false);
        document.documentElement.removeAttribute("data-player-fullscreen");
      }
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, [playerFullscreen]);

  const changeSubtitleOffset = useCallback((delta) => {
    setSubtitleOffset((prev) => {
      const next = Math.max(-5.0, Math.min(5.0, parseFloat((prev + delta).toFixed(1))));
      storage.set("subOffset_" + progressKey, next);
      showFeedback(`Subtitle offset: ${next > 0 ? "+" : ""}${next.toFixed(1)}s`);
      
      const wv = webviewRef.current;
      if (wv) {
        wv.executeJavaScript(`
          (() => {
            const v = document.querySelector('video');
            if (!v) return;
            if (window.__subOffset === undefined) {
              window.__subOffset = 0;
            }
            const oldOffset = window.__subOffset;
            window.__subOffset = ${next};
            const diff = window.__subOffset - oldOffset;
            if (diff === 0) return;
            for (let i = 0; i < v.textTracks.length; i++) {
              const track = v.textTracks[i];
              if (track.cues) {
                for (let j = 0; j < track.cues.length; j++) {
                  const cue = track.cues[j];
                  cue.startTime += diff;
                  cue.endTime += diff;
                }
              }
            }
          })()
        `).catch(() => {});
      }
      return next;
    });
  }, [progressKey, showFeedback]);

  const handlePlaybackKey = useCallback((key, shift, ctrl, meta, preventDefault) => {
    const keyL = key.toLowerCase();

    // 1. Global Navigation Shortcuts (Command/Control + key)
    if (ctrl || meta) {
      if (keyL === "k" || keyL === "f") {
        if (preventDefault) preventDefault();
        window.dispatchEvent(new CustomEvent("movievault:open-search"));
        return;
      }
      if (key === ",") {
        if (preventDefault) preventDefault();
        window.dispatchEvent(new CustomEvent("movievault:open-settings"));
        return;
      }
      if (keyL === "l") {
        if (preventDefault) preventDefault();
        window.dispatchEvent(new CustomEvent("movievault:open-library"));
        return;
      }
      if (keyL === "h") {
        if (preventDefault) preventDefault();
        window.dispatchEvent(new CustomEvent("movievault:open-home"));
        return;
      }
    }

    // Escape: exit playback
    if (key === "Escape") {
      if (preventDefault) preventDefault();
      onBack();
      return;
    }

    const wv = webviewRef.current;
    if (!wv) return;

    // Play/Pause: Space or K
    if (key === " " || keyL === "k") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) {
            if (v.paused) v.play();
            else v.pause();
            return !v.paused;
          }
          return null;
        })()
      `).then((res) => {
        if (res !== null) showFeedback(res ? "Play" : "Pause");
      }).catch(() => {});
      return;
    }

    // Seek: ArrowLeft/ArrowRight (5s), J/L (10s)
    if (key === "ArrowLeft") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) {
            v.currentTime = Math.max(0, v.currentTime - 5);
            return v.currentTime;
          }
          return null;
        })()
      `).catch(() => {});
      return;
    }
    if (key === "ArrowRight") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) {
            v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 5);
            return v.currentTime;
          }
          return null;
        })()
      `).catch(() => {});
      return;
    }
    if (keyL === "j") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) {
            v.currentTime = Math.max(0, v.currentTime - 10);
            return v.currentTime;
          }
          return null;
        })()
      `).catch(() => {});
      return;
    }
    if (keyL === "l") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) {
            v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
            return v.currentTime;
          }
          return null;
        })()
      `).catch(() => {});
      return;
    }

    // Volume: ArrowUp/ArrowDown (10%)
    if (key === "ArrowUp") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) {
            v.volume = Math.max(0, Math.min(1, v.volume + 0.1));
            v.muted = false;
            return Math.round(v.volume * 100);
          }
          return null;
        })()
      `).then((vol) => {
        if (vol !== null) showFeedback(`Volume: ${vol}%`);
      }).catch(() => {});
      return;
    }
    if (key === "ArrowDown") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) {
            v.volume = Math.max(0, Math.min(1, v.volume - 0.1));
            return Math.round(v.volume * 100);
          }
          return null;
        })()
      `).then((vol) => {
        if (vol !== null) showFeedback(`Volume: ${vol}%`);
      }).catch(() => {});
      return;
    }

    // Mute: M
    if (keyL === "m") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) {
            v.muted = !v.muted;
            return v.muted;
          }
          return null;
        })()
      `).then((muted) => {
        if (muted !== null) showFeedback(muted ? "Muted" : "Unmuted");
      }).catch(() => {});
      return;
    }

    // Fullscreen: F
    if (keyL === "f") {
      if (preventDefault) preventDefault();
      togglePlayerFullscreen();
      return;
    }

    // Toggle Subtitles: C
    if (keyL === "c") {
      if (preventDefault) preventDefault();
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (!v) return null;
          let active = false;
          for (let i = 0; i < v.textTracks.length; i++) {
            const track = v.textTracks[i];
            track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
            active = track.mode === 'showing';
          }
          return active;
        })()
      `).then((active) => {
        if (active !== null) showFeedback(active ? "Subtitles On" : "Subtitles Off");
      }).catch(() => {});
      return;
    }

    // Subtitle offset: G / H
    if (keyL === "g" || keyL === "h") {
      if (preventDefault) preventDefault();
      const delta = keyL === "g" ? (shift ? -1.0 : -0.1) : (shift ? 1.0 : 0.1);
      changeSubtitleOffset(delta);
      return;
    }
  }, [onBack, changeSubtitleOffset, showFeedback, togglePlayerFullscreen]);

  // Load saved subtitle offset when starting playback
  useEffect(() => {
    if (playing) {
      const globalDefault = storage.get("defaultSubtitleOffset") ?? 0;
      const savedOffset = storage.get("subOffset_" + progressKey) ?? globalDefault;
      const parsed = parseFloat(savedOffset) || 0;
      setSubtitleOffset(parsed);
      
      // Inject the saved offset after 3 seconds to ensure textTracks are loaded
      const t = setTimeout(() => {
        const wv = webviewRef.current;
        if (wv) {
          wv.executeJavaScript(`
            (() => {
              const v = document.querySelector('video');
              if (!v) return;
              window.__subOffset = ${parsed};
              for (let i = 0; i < v.textTracks.length; i++) {
                const track = v.textTracks[i];
                if (track.cues) {
                  for (let j = 0; j < track.cues.length; j++) {
                    const cue = track.cues[j];
                    cue.startTime += ${parsed};
                    cue.endTime += ${parsed};
                  }
                }
              }
            })()
          `).catch(() => {});
        }
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [playing, progressKey]);

  const detailState = useMemo(() => {
    if (!details && detailsLoading) return "loading";
    if (detailsError) return { loading: false, error: detailsError };
    return null;
  }, [details, detailsLoading, detailsError]);

  const allMangaState = useMemo(() => {
    if (resolvingUrl) return "loading";
    if (resolveError) {
      return {
        loading: false,
        error: {
          code: "SCRAPER_PARSE_FAIL",
          message: resolveError,
        },
      };
    }
    return null;
  }, [resolvingUrl, resolveError]);

  const handleRetryAllManga = useCallback(() => {
    setResolvedPlayerUrl(null);
    setResolveError(null);
    setResolvingUrl(false);
  }, []);



  const fetchDetails = useCallback(() => {
    let mounted = true;
    setDetailsLoading(true);
    setDetailsError(null);
    tmdbFetch(`/movie/${item.id}?append_to_response=credits,similar,videos`, apiKey)
      .then((d) => {
        if (mounted) {
          setDetails(d);
          setDetailsError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setDetailsError({
            code: err.code || "UNKNOWN_ERROR",
            message: err.message || "Failed to load movie details",
          });
        }
      })
      .finally(() => {
        if (mounted) setDetailsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [item.id, apiKey]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    let mounted = true;
    fetchMovieRating(item.id, apiKey, ratingCountry).then((r) => {
      if (mounted) setRating(r);
    });
    return () => {
      mounted = false;
    };
  }, [item.id, apiKey, ratingCountry]);

  useEffect(() => {
    let mounted = true;
    tmdbFetch(`/movie/${item.id}/videos`, apiKey)
      .then((data) => {
        if (!mounted) return;
        const videos = data.results || [];
        const trailer =
          videos.find((v) => v.type === "Trailer" && v.site === "YouTube") ||
          videos.find((v) => v.site === "YouTube");
        if (trailer) setTrailerKey(trailer.key);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [item.id, apiKey]);

  // Fetch movie collection (sequels/prequels)
  useEffect(() => {
    setCollection(null);
    if (!details?.belongs_to_collection?.id) return;
    let mounted = true;
    tmdbFetch(`/collection/${details.belongs_to_collection.id}`, apiKey)
      .then((data) => {
        if (!mounted) return;
        const parts = (data.parts || [])
          .map((p) => ({ ...p, media_type: "movie" }))
          .sort((a, b) =>
            (a.release_date || "").localeCompare(b.release_date || ""),
          );
        if (parts.length > 1) {
          setCollection({ name: data.name, parts });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [details?.belongs_to_collection?.id, apiKey]);

  // Reset m3u8 URL, subtitle URL and source menu whenever the movie or source changes
  useEffect(() => {
    setM3u8Url(null);
    setInterceptedSubs([]);
    setShowSourceMenu(false);
    setAnilistData(null);
    setResolvedPlayerUrl(null);
    setResolvingUrl(false);
    setResolveError(null);
    setWebviewLoading(true); // instantly blank the player on every source/item switch
  }, [item.id, playerSource, dubMode]);

  // Fetch AniList data + auto-set source for anime/non-anime
  useEffect(() => {
    let mounted = true;
    if (isAnime) {
      fetchAnilistData(item.title || item.name, "ANIME", item.id).then(
        (data) => {
          if (mounted && data) setAnilistData(data);
        },
      );
      // Switch to anime source if current source is not an anime source
      const currentSrc = PLAYER_SOURCES.find((s) => s.id === playerSource);
      if (!currentSrc?.tag) {
        const saved = storage.get("playerSource");
        const savedSrc = PLAYER_SOURCES.find((s) => s.id === saved);
        setPlayerSource(savedSrc?.tag ? saved : ANIME_DEFAULT_SOURCE);
      }
    } else {
      // Switch back to non-anime source if current source is anime-only
      const currentSrc = PLAYER_SOURCES.find((s) => s.id === playerSource);
      if (currentSrc?.tag) {
        const saved = storage.get("playerSource");
        const savedSrc = PLAYER_SOURCES.find((s) => s.id === saved);
        setPlayerSource(!savedSrc?.tag ? saved : NON_ANIME_DEFAULT_SOURCE);
      }
    }
    return () => {
      mounted = false;
    };
  }, [item.id, isAnime]);

  // Resolve AllManga movie URL via main-process IPC
  useEffect(() => {
    if (!playing || !sourceIsAsync(playerSource)) return;
    if (resolvedPlayerUrl || resolvingUrl) return;
    setResolvingUrl(true);
    setResolveError(null);
    const startTime = storage.get("dlTime_" + progressKey) || 0;
    let mounted = true;
    window.electron
      .resolveAllManga({
        title,
        seasonNumber: 1,
        episodeNumber: 1,
        isMovie: true,
        translationType: dubMode,
      })
      .then((res) => {
        if (!mounted) return;
        if (res?.ok && res.url) {
          const playerHtmlUrl = `/player.html?url=${encodeURIComponent(res.url)}&referer=${encodeURIComponent(res.referer || "https://allmanga.to")}&startTime=${startTime}`;
          setResolvedPlayerUrl(playerHtmlUrl);
          setM3u8Url(res.url);
        } else {
          setResolveError(res?.error || "Movie not found on AllManga");
        }
      })
      .catch((e) => {
        if (mounted) setResolveError(e.message || "Error");
      })
      .finally(() => {
        if (mounted) setResolvingUrl(false);
      });
    return () => {
      mounted = false;
    };
  }, [playing, playerSource, dubMode]);

  useEffect(() => {
    if (!window.electron) return;
    const handler = window.electron.onM3u8Found((url) => {
      setM3u8Url((prev) => (prev !== url ? url : prev));
    });
    return () => window.electron.offM3u8Found(handler);
  }, []);

  // Close source dropdown on scroll or click-outside
  useEffect(() => {
    if (!showSourceMenu) return;
    const close = () => setShowSourceMenu(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    const handleClick = (e) => {
      if (
        sourceRef.current?.contains(e.target) ||
        e.target.closest(".source-dropdown")
      )
        return;
      close();
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showSourceMenu]);

  useEffect(() => {
    if (!window.electron) return;
    const handler = window.electron.onSubtitleFound(({ url, lang }) => {
      // Only keep VTT, deduplicate per language (latest wins)
      if (!url || !url.toLowerCase().includes(".vtt")) return;
      setInterceptedSubs((prev) => {
        const filtered = prev.filter((s) => s.lang !== lang);
        return [...filtered, { url, lang: lang || "unknown" }];
      });
    });
    return () => window.electron.offSubtitleFound(handler);
  }, []);

  // Reset auto-mark guard when a new movie loads or watched state resets
  useEffect(() => {
    autoMarkedRef.current = false;
    lastKnownTimeRef.current = 0;
    seekBackCooldownRef.current = 0;
    hasSeekedSavedTimeRef.current = false;
  }, [item.id, isWatched]);

  // Show loader instantly when play starts
  useEffect(() => {
    if (playing) setWebviewLoading(true);
  }, [playing]);

  // ── Webview memory cleanup ────────────────────────────────────────────────
  // useLayoutEffect fires synchronously BEFORE React mutates the DOM, so the
  // webview is still attached when we navigate it to about:blank.
  // This lets Chromium unload.
  useLayoutEffect(() => {
    if (playing) return;
    const wv = webviewRef.current;
    if (wv) {
      try {
        wv.src = "about:blank";
      } catch {}
    }
  }, [playing]);

  // On unmount: signal main process to destroy the player WebContents and flush session cache.
  useEffect(() => {
    return () => {
      window.electron?.playerStopped?.();
    };
  }, []);

  const handleFailover = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    setCurrentQueueIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      if (nextIndex < failoverQueue.length) {
        return nextIndex;
      } else {
        setFailoverError(true);
        setWebviewLoading(false);
        setLoadingStatus("");
        return prevIndex;
      }
    });
  }, [failoverQueue]);

  // Real browser <iframe> load signal. Cross-origin content can't be
  // inspected (no executeJavaScript like Electron's <webview>), so a fired
  // onLoad is the only success signal available on web — treat it as
  // "source is up" and stop the failover timer. Hard failures (blocked
  // domain, dead host) are still caught by the timeout in the effect below.
  const handleIframeLoad = useCallback(() => {
    if (sourceIsAsync(playerSource)) {
      setWebviewLoading(false);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setWebviewLoading(false);
    setLoadingStatus("");
    const activeSourceId = failoverQueue[currentQueueIndex] || playerSource;
    sourceQueue.saveLastGoodSource(item.id, null, null, activeSourceId);
  }, [playerSource, failoverQueue, currentQueueIndex, item.id]);

  // Initialize queue when playing starts
  useEffect(() => {
    if (!playing) {
      setFailoverQueue([]);
      setCurrentQueueIndex(0);
      setLoadingStatus("");
      setFailoverError(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const initialSource = storage.get("playerSource") || NON_ANIME_DEFAULT_SOURCE;
    if (sourceIsAsync(initialSource)) {
      setPlayerSource(initialSource);
      return;
    }

    const q = sourceQueue.getQueue(item.id, null, null);
    setFailoverQueue(q);
    setCurrentQueueIndex(0);
    setPlayerSource(q[0]);
    setFailoverError(false);
  }, [playing, item.id]);

  // Handle active queue index changes
  useEffect(() => {
    if (!playing || failoverQueue.length === 0) return;
    const currentSourceId = failoverQueue[currentQueueIndex];
    if (!currentSourceId) return;

    setPlayerSource(currentSourceId);
    
    const sourceLabel = PLAYER_SOURCES.find((s) => s.id === currentSourceId)?.label || currentSourceId;
    setLoadingStatus(currentQueueIndex === 0 ? `Loading from ${sourceLabel}…` : `Trying ${sourceLabel}…`);

    const timeoutSeconds = sourceQueue.getSourceTimeout();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      console.log(`Source ${currentSourceId} timed out after ${timeoutSeconds}s.`);
      handleFailover();
    }, timeoutSeconds * 1000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [playing, failoverQueue, currentQueueIndex, handleFailover]);

  // Attach webview load events so we know when the new source has painted
  useEffect(() => {
    if (!playing) return;
    const wv = webviewRef.current;
    if (!wv) return;
    
    const handleFinished = async () => {
      if (sourceIsAsync(playerSource)) {
        setWebviewLoading(false);
        return;
      }

      try {
        const title = await wv.executeJavaScript("document.title");
        const bodyText = await wv.executeJavaScript("document.body.innerText");
        
        const isErrorTitle = title && (title.includes("502") || title.includes("504") || title.includes("Server Error") || title.includes("Cloudflare"));
        const isErrorBody = bodyText && (bodyText.includes("502 Bad Gateway") || bodyText.includes("504 Gateway Timeout") || bodyText.includes("Server Error") || bodyText.includes("Cloudflare"));
        
        if (isErrorTitle || isErrorBody) {
          console.log(`Webview loaded successfully but contains error content:`, title, bodyText);
          handleFailover();
          return;
        }
      } catch (err) {
        console.warn("Could not inspect webview page content:", err);
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setWebviewLoading(false);
      setLoadingStatus("");
      
      const activeSourceId = failoverQueue[currentQueueIndex] || playerSource;
      sourceQueue.saveLastGoodSource(item.id, null, null, activeSourceId);

      const runAutoplay = () => {
        if (window.electron?.autoplayVideo && wv && !wv.isDestroyed?.()) {
          window.electron.autoplayVideo(wv.getWebContentsId()).catch(() => {});
        }
      };
      runAutoplay();
      setTimeout(runAutoplay, 500);
      setTimeout(runAutoplay, 1500);
      setTimeout(runAutoplay, 3000);
    };

    const handleFailed = () => {
      if (sourceIsAsync(playerSource)) {
        setWebviewLoading(false);
        return;
      }
      handleFailover();
    };

    const handleWebviewInput = (e) => {
      handlePlaybackKey(
        e.key,
        e.shift,
        e.control,
        e.meta,
        () => e.preventDefault()
      );
    };

    wv.addEventListener("did-finish-load", handleFinished);
    wv.addEventListener("did-fail-load", handleFailed);
    wv.addEventListener("before-input-event", handleWebviewInput);
    return () => {
      wv.removeEventListener("did-finish-load", handleFinished);
      wv.removeEventListener("did-fail-load", handleFailed);
      wv.removeEventListener("before-input-event", handleWebviewInput);
    };
  }, [playing, playerSource, item.id, failoverQueue, currentQueueIndex, handleFailover, handlePlaybackKey]);

  // Window keydown listener for cases where focus is not trapped in webview
  useEffect(() => {
    if (!playing) return;
    const handleWinKey = (e) => {
      handlePlaybackKey(
        e.key,
        e.shiftKey,
        e.ctrlKey,
        e.metaKey,
        () => e.preventDefault()
      );
    };
    window.addEventListener("keydown", handleWinKey);
    return () => window.removeEventListener("keydown", handleWinKey);
  }, [playing, handlePlaybackKey]);

  // ── Auto-track progress + auto-watched every 5s ──────────────────────────
  useEffect(() => {
    if (!playing || !sourceSupportsProgress(playerSource)) return;
    let interval = null;
    const timer = setTimeout(() => {
      interval = setInterval(async () => {
        try {
          const wv = webviewRef.current;
          if (!wv) return;
          let result;
          // When the pop-out window is open the main webview shows about:blank
          // -> query the pip window's webContents directly.
          if (
            pipWebContentsIdRef.current != null &&
            window.electron?.queryVideoProgress
          ) {
            result = await window.electron.queryVideoProgress(
              pipWebContentsIdRef.current,
            );
          } else if (progressViaFrames && window.electron?.queryVideoProgress) {
            result = await window.electron.queryVideoProgress(
              wv.getWebContentsId(),
            );
          } else {
            result = await wv.executeJavaScript(`
              (() => {
                const v = document.querySelector('video')
                if (!v || !v.duration || v.duration === Infinity || v.paused) return null
                // Re-attach seek tracker if video element was recreated (e.g. quality change)
                if (!v._seekTracked) {
                  v._seekTracked = true
                  v.addEventListener('seeked', () => {
                    v._lastUserSeek = Date.now()
                    v._lastUserSeekTo = v.currentTime
                  })
                }
                return {
                  currentTime: v.currentTime,
                  duration: v.duration,
                  recentUserSeek: v._lastUserSeek ? (Date.now() - v._lastUserSeek < 6000) : false,
                  lastUserSeekTo: v._lastUserSeekTo ?? null,
                }
              })()
            `);
          }
          if (result && result.duration > 0) {
            const ct = result.currentTime;

            // Seek to saved position on first detection
            if (!hasSeekedSavedTimeRef.current) {
              const savedTime = storage.get("dlTime_" + progressKey) || 0;
              if (savedTime > 5 && savedTime < result.duration - 15) {
                hasSeekedSavedTimeRef.current = true;
                try {
                  await wv.executeJavaScript(`
                    (() => {
                      const v = document.querySelector('video')
                      if (v) v.currentTime = ${savedTime}
                    })()
                  `);
                  lastKnownTimeRef.current = savedTime;
                  return;
                } catch {}
              } else {
                hasSeekedSavedTimeRef.current = true;
              }
            }

            // ── Resolution-change reset detection ──────────────────────────
            // Videasy resets to 0 on quality change. We only seek back if:
            // - ct is near zero (≤5s)
            // - we were well into the video (>30s)
            // - the user did NOT manually seek in the last 6s
            const now = Date.now();
            if (
              lastKnownTimeRef.current > 30 &&
              ct <= 5 &&
              !result.recentUserSeek
            ) {
              if (now > seekBackCooldownRef.current) {
                // First reset: seek back and start cooldown
                const seekTo = lastKnownTimeRef.current;
                seekBackCooldownRef.current = now + 8000;
                try {
                  await wv.executeJavaScript(`
                    (() => {
                      const v = document.querySelector('video')
                      if (v) v.currentTime = ${seekTo}
                    })()
                  `);
                } catch {}
              }
              // In both cases (first reset or cooldown): skip progress save with wrong position
              return;
            }

            // If user seeked, update ref to their chosen position immediately
            if (result.recentUserSeek && result.lastUserSeekTo !== null) {
              lastKnownTimeRef.current = result.lastUserSeekTo;
            } else {
              lastKnownTimeRef.current = ct;
            }
            const p = Math.floor((ct / result.duration) * 100);
            saveProgressRef.current(progressKey, Math.min(p, 100), {
              item: d,
              position: ct,
              duration: result.duration,
              source: playerSource
            });
            // Also persist actual seconds so DownloadsPage can show resume position
            storage.set("dlTime_" + progressKey, Math.floor(ct));

            // Auto-mark watched when remaining time ≤ threshold
            const remaining = result.duration - ct;
            if (
              !autoMarkedRef.current &&
              remaining <= watchedThreshold &&
              remaining >= 0
            ) {
              autoMarkedRef.current = true;
              onMarkWatchedRef.current?.(progressKey);
            }
          }
        } catch {}
      }, 5000);
    }, 3000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [playing, progressKey, watchedThreshold, playerSource, progressViaFrames]);

  const handlePlay = useCallback(() => {
    setM3u8Url(null);
    setInterceptedSubs([]);
    setPlaying(true);
    onHistory({ ...d, media_type: "movie" });
  }, [d, onHistory]);


  // Intercept fullscreen requests from embedded players (vidsrc / 2embed use
  // the native Fullscreen API which would otherwise fullscreen the entire app).
  // Videasy and AllManga handle fullscreen internally via CSS, skip those.
  useEffect(() => {
    if (!playing) return;
    if (!NEEDS_INTERCEPT.includes(playerSource)) return;
    const enterH = window.electron?.onWebviewEnterFullscreen?.(() => {
      setPlayerFullscreen(true);
      document.documentElement.setAttribute("data-player-fullscreen", "1");
    });
    const leaveH = window.electron?.onWebviewLeaveFullscreen?.(() => {
      setPlayerFullscreen(false);
      document.documentElement.removeAttribute("data-player-fullscreen");
      if (document.fullscreenElement) document.exitFullscreen?.();
    });
    return () => {
      if (enterH) window.electron?.offWebviewEnterFullscreen?.(enterH);
      if (leaveH) window.electron?.offWebviewLeaveFullscreen?.(leaveH);
      document.documentElement.removeAttribute("data-player-fullscreen");
    };
  }, [playing, playerSource]);

  // ── PiP pop-out: navigate main webview away so only one stream is active ──
  useEffect(() => {
    if (!playing) return;
    const openH = window.electron?.onPipOpened?.(async () => {
      setPipOpen(true);
      pipWebContentsIdRef.current =
        (await window.electron.getPipWebContentsId?.()) ?? null;
    });
    const closeH = window.electron?.onPipClosed?.(() => {
      pipUrlRef.current = null;
      pipWebContentsIdRef.current = null;
      setPipOpen(false);
    });
    return () => {
      if (openH) window.electron?.offPipOpened?.(openH);
      if (closeH) window.electron?.offPipClosed?.(closeH);
    };
  }, [playing]);

  const handleSetDownloaderFolder = useCallback((folder) => {
    setDownloaderFolder(folder);
    storage.set("downloaderFolder", folder);
  }, []);

  // Prefer AniList metadata for anime when available
  const displayOverview =
    isAnime && anilistData?.description
      ? cleanAnilistDescription(anilistData.description)
      : d.overview;
  const displayScore =
    isAnime && anilistData?.averageScore
      ? (anilistData.averageScore / 10).toFixed(1)
      : d.vote_average > 0
        ? d.vote_average.toFixed(1)
        : null;
  const displayGenres =
    isAnime && anilistData?.genres?.length
      ? anilistData.genres.map((g, i) => ({ id: i, name: g }))
      : d.genres || [];

  const castList = d.credits?.cast || [];
  const similarList = (d.similar?.results || []).slice(0, 12);

  const productionCompanies = (d.production_companies || [])
    .map((c) => c.name)
    .join(", ");
  const productionCountries = (d.production_countries || [])
    .map((c) => c.name)
    .join(", ");
  const budgetFormatted =
    d.budget && d.budget > 0
      ? "$" + (d.budget / 1_000_000).toFixed(1) + "M"
      : null;
  const revenueFormatted =
    d.revenue && d.revenue > 0
      ? "$" + (d.revenue / 1_000_000).toFixed(1) + "M"
      : null;

  // Unreleased detection
  const isUnreleased = useMemo(() => {
    if (!d.release_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(d.release_date) > today;
  }, [d.release_date]);
  // A title arrived at with intent to watch — the hero's Play CTA, or Play
  // Something — is recorded as started; the player itself opens from the
  // initial `playing` state below. The render guard still enforces the age
  // rating and release date, so this cannot open restricted content.
  useEffect(() => {
    if (item?.playDirectly && !restricted && !isUnreleased) {
      onHistory({ ...d, media_type: "movie" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.playDirectly, restricted, isUnreleased]);

  // Check if this movie is already downloaded or currently downloading
  const movieDownload = (downloads || []).find(
    (dl) =>
      dl.mediaType === "movie" &&
      (dl.tmdbId === item.id || dl.mediaId === item.id) &&
      (dl.status === "completed" ||
        dl.status === "local" ||
        dl.status === "downloading"),
  );

  return (
    <div className="fade-in">
      <AsyncBoundary state={detailState} onRetry={fetchDetails}>
        <div className="detail-hero">
        <div
          className="detail-bg"
          style={{
            backgroundImage: `url(${imgUrl(d.backdrop_path, "w1280")})`,
          }}
        />
        <div className="detail-gradient" />
        <div className="detail-content">
          <div className="detail-poster" style={{ position: "relative" }}>
            {d.poster_path ? (
              <img src={imgUrl(d.poster_path)} alt={title} loading="lazy" />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text3)",
                }}
              >
                <FilmIcon />
              </div>
            )}
            {isWatched && (
              <div className="detail-watched-badge">
                <WatchedIcon size={36} />
              </div>
            )}
          </div>
          <div className="detail-info">
            <div className="detail-type">Movie</div>
            <div className="detail-title">{title}</div>
            <div className="genres">
              {displayGenres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="genre-tag genre-tag--link"
                  onClick={() => onSearch?.(g.name)}
                  title={`Browse ${g.name}`}
                >
                  {g.name}
                </button>
              ))}
            </div>
            <div className="detail-meta">
              {displayScore && (
                <span className="detail-rating">
                  <StarIcon /> {displayScore}
                </span>
              )}
              {year && <span>{year}</span>}
              {d.runtime && <span>{d.runtime} min</span>}
              {d.original_language && (
                <span>{d.original_language?.toUpperCase()}</span>
              )}
            </div>
            <RatingBadge cert={rating.cert} restricted={restricted} />
            {displayOverview && (
              <div className="synopsis-wrap" style={{ marginBottom: 12 }}>
                <p
                  className={`detail-overview synopsis-text${synopsisExpanded ? "" : " synopsis-text--clamped"}`}
                >
                  {displayOverview}
                </p>
                {displayOverview.length > 200 && (
                  <button
                    className="synopsis-expand-btn"
                    onClick={() => setSynopsisExpanded((e) => !e)}
                  >
                    {synopsisExpanded ? "Show less ▲" : "Read more ▼"}
                  </button>
                )}
              </div>
            )}
            {!isWatched && displayPct > 0 && (
              <div className="progress-bar-row" style={{ marginBottom: 12 }}>
                <div className="progress-bar-outer">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(displayPct, 100)}%` }}
                  />
                </div>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  {progressLabel}
                </span>
              </div>
            )}
            <div className="detail-actions">
              {isUnreleased ? (
                <button
                  className="btn btn-primary btn-restricted"
                  disabled
                  title="This movie has not been released yet"
                >
                  🔒 Unreleased
                </button>
              ) : restricted ? (
                <button
                  className="btn btn-primary btn-restricted"
                  disabled
                  title="Inappropriate for your age rating setting"
                >
                  🔒 Restricted
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handlePlay}>
                  <PlayIcon /> {playLabel}
                </button>
              )}
              {trailerKey &&
                (restricted ? (
                  <button
                    className="btn btn-secondary btn-restricted"
                    disabled
                    title="Inappropriate for your age rating setting"
                  >
                    🔒 Trailer
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowTrailer(true)}
                  >
                    <TrailerIcon /> Trailer
                  </button>
                ))}
              <button className="btn btn-secondary" onClick={onSave}>
                {isSaved ? <BookmarkFillIcon /> : <BookmarkIcon />}
                {isSaved ? "Saved" : "Save"}
              </button>
              {!isUnreleased &&
                (isWatched ? (
                  <button
                    className="btn btn-ghost watched-btn"
                    onClick={() => onMarkUnwatched?.(progressKey)}
                  >
                    <WatchedIcon size={16} /> Watched
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-ghost"
                      onClick={() => onMarkWatched?.(progressKey)}
                    >
                      ✓ Mark Watched
                    </button>
                    {hasProgress && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 13 }}
                        onClick={() => {
                          saveProgress(progressKey, 0);
                          storage.set("dlTime_" + progressKey, null);
                        }}
                      >
                        ⊘ Not Started
                      </button>
                    )}
                  </>
                ))}
              <button className="btn btn-ghost" onClick={onBack}>
                <BackIcon /> Back
              </button>
            </div>
          </div>
        </div>
      </div>

      {playing && !restricted && !isUnreleased && (
        <div className="section">
          <div
            className={`player-wrap${playerFullscreen ? " player-wrap--fullscreen" : ""}`}
            ref={playerWrapRef}
          >
            {/* Universal source-loading overlay, shown instantly on every source/item switch */}
            {webviewLoading && !resolveError && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.92)",
                  gap: 14,
                  borderRadius: "inherit",
                }}
              >
                <div className="spinner" />
                <span style={{ fontSize: 14, color: "var(--text2)" }}>
                  {resolvingUrl
                    ? "Looking up movie on AllManga…"
                    : loadingStatus || `Loading ${PLAYER_SOURCES.find((s) => s.id === playerSource)?.label ?? "source"}…`}
                </span>
              </div>
            )}
            {/* AllManga: error if lookup failed */}
            {sourceIsAsync(playerSource) && resolveError && !resolvingUrl && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.85)",
                  gap: 10,
                  borderRadius: "inherit",
                }}
              >
                <span style={{ fontSize: 28 }}>⚠️</span>
                <span style={{ fontSize: 14, color: "var(--text2)" }}>
                  Movie not found on AllManga
                </span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  {resolveError}
                </span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>
                  Try a different source, or switch sub/dub.
                </span>
              </div>
            )}
            {/* Failover Error Card */}
            {failoverError && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.92)",
                  gap: 16,
                  padding: 24,
                  borderRadius: "inherit",
                }}
              >
                <span style={{ fontSize: 48 }}>⚠️</span>
                <h3 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>All Sources Failed</h3>
                <p style={{ margin: 0, color: "var(--text3)", fontSize: 13, maxWidth: 400, textAlign: "center", lineHeight: 1.5 }}>
                  We tried all available video sources but none resolved successfully.
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setFailoverError(false);
                      setWebviewLoading(true);
                      setCurrentQueueIndex(0);
                    }}
                  >
                    Retry
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const btn = document.querySelector(".player-source-btn");
                      if (btn) btn.click();
                    }}
                  >
                    Switch Source Manually
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      const logs = storage.get("brokenSourceReports") || [];
                      logs.push({
                        tmdbId: item.id,
                        title: item.title || item.name,
                        type: "movie",
                        ts: Date.now(),
                        sourcesTried: failoverQueue
                      });
                      storage.set("brokenSourceReports", logs);
                      alert("Report saved to Settings -> Diagnostics.");
                    }}
                  >
                    Report Broken
                  </button>
                </div>
              </div>
            )}
            {/* Pop-out active: main stream is paused, pop-out has the real player */}
            {pipOpen && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.92)",
                  gap: 16,
                  borderRadius: "inherit",
                }}
              >
                <PopOutIcon size={36} />
                <span
                  style={{
                    fontSize: 15,
                    color: "var(--text1)",
                    fontWeight: 600,
                  }}
                >
                  Playing in pop-out window
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text2)",
                    textAlign: "center",
                    maxWidth: 260,
                  }}
                >
                  Closing the pop-out will reload the player here.
                </span>
                <button
                  className="player-overlay-btn"
                  onClick={() => window.electron?.closePipWindow?.()}
                  style={{ marginTop: 4 }}
                >
                  Close pop-out &amp; return
                </button>
              </div>
            )}
            {/* `key={playerSource}` forces a brand-new iframe element on every
                source switch. An iframe's sandbox flags are fixed when the frame
                is created and are not reliably re-read when React swaps the
                `src` and drops the `sandbox` attribute in the same commit, so
                reusing the element could navigate to an unsandboxed provider
                (Videasy) while the old flags still applied — which is exactly
                the provider's "Iframe Sandbox Detected" page. See ADR-017. */}
            {sourceIsAsync(playerSource) ? (
              <AsyncBoundary state={allMangaState} onRetry={handleRetryAllManga}>
                <iframe
                  key={playerSource}
                  ref={webviewRef}
                  src={
                    pipOpen
                      ? "about:blank"
                      : resolvedPlayerUrl || "about:blank"
                  }
                  sandbox={sourceSandbox(playerSource) || undefined}
                  allow="fullscreen *; autoplay *; encrypted-media *; picture-in-picture *"
                  allowFullScreen
                  onLoad={handleIframeLoad}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                    zIndex: 1,
                    visibility:
                      webviewLoading || !resolvedPlayerUrl
                        ? "hidden"
                        : "visible",
                  }}
                />
              </AsyncBoundary>
            ) : (
              <iframe
                key={playerSource}
                ref={webviewRef}
                src={
                  pipOpen
                    ? "about:blank"
                    : getSourceUrl(playerSource, "movie", item.id, null, null)
                }
                sandbox={sourceSandbox(playerSource) || undefined}
                allow="fullscreen *; autoplay *; encrypted-media *; picture-in-picture *"
                onLoad={handleIframeLoad}
                allowFullScreen
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                  zIndex: 1,
                  visibility: webviewLoading ? "hidden" : "visible",
                }}
              />
            )}
            {/* Left-side overlay button group, flex row, no fixed px offsets */}
            <div className="player-overlay-group">
              <button
                ref={sourceRef}
                className="player-overlay-btn"
                onClick={() => {
                  const rect = sourceRef.current?.getBoundingClientRect();
                  if (rect)
                    setMenuPos({ top: rect.bottom + 6, left: rect.left });
                  setShowSourceMenu((v) => !v);
                }}
                title="Change source"
              >
                <SourceIcon />
                {PLAYER_SOURCES.find((s) => s.id === playerSource)?.label ??
                  "Source"}
              </button>
              {/* Sub/Dub toggle, only for AllManga */}
              {playerSource === "allmanga" && (
                <button
                  className="player-overlay-btn"
                  onClick={() => {
                    const next = dubMode === "sub" ? "dub" : "sub";
                    setDubMode(next);
                    storage.set("allmangaDubMode", next);
                    setM3u8Url(null);
                    setInterceptedSubs([]);
                    setResolvedPlayerUrl(null);
                    setResolvingUrl(false);
                    setResolveError(null);
                  }}
                  title="Toggle Sub/Dub"
                >
                  {dubMode === "sub" ? "SUB" : "DUB"}
                </button>
              )}
              {/* Blocked ads & trackers button */}
              <button
                className="player-overlay-btn"
                onClick={() => {
                  setShowSourceMenu(false);
                  setShowBlockedModal(true);
                }}
                title={
                  window.electron?.isWebPolyfill
                    ? sourceIsProtected(playerSource)
                      ? "Pop-ups blocked on this source"
                      : "Pop-ups possible on this source"
                    : "Blocked ads & trackers"
                }
              >
                <ShieldBlockIcon />
                {blockedSession > 0 && (
                  <span className="player-blocked-badge">{blockedSession}</span>
                )}
              </button>
              {/* Pop-out button*/}
              <button
                className="player-overlay-btn"
                onClick={() => {
                  if (pipOpen) {
                    window.electron?.closePipWindow?.();
                    return;
                  }
                  const url = sourceIsAsync(playerSource)
                    ? resolvedPlayerUrl
                    : getSourceUrl(playerSource, "movie", item.id, null, null);
                  if (!url) return;
                  pipUrlRef.current = url;
                  window.electron?.openPipWindow?.(url, item.title);
                }}
                title={pipOpen ? "Close pop-out" : "Pop out player"}
                disabled={
                  !pipOpen &&
                  (webviewLoading ||
                    !!(sourceIsAsync(playerSource) && !resolvedPlayerUrl))
                }
                style={pipOpen ? { color: "var(--red)" } : undefined}
              >
                <PopOutIcon />
              </button>
            </div>
            {showSourceMenu && menuPos && (
              <div
                className="source-dropdown source-dropdown--fixed"
                style={{ top: menuPos.top, left: menuPos.left }}
                onClick={(e) => e.stopPropagation()}
              >
                {PLAYER_SOURCES.map((src) => (
                  <button
                    key={src.id}
                    className={
                      "source-dropdown__item" +
                      (playerSource === src.id
                        ? " source-dropdown__item--active"
                        : "")
                    }
                    onClick={() => {
                      setShowSourceMenu(false);
                      if (src.id === playerSource) return;
                      // Manual override: reset failover queue with just the selected source
                      setFailoverQueue([src.id]);
                      setCurrentQueueIndex(0);
                      setPlayerSource(src.id);
                      setFailoverError(false);
                      setWebviewLoading(true);
                      storage.set("playerSource", src.id);
                      setM3u8Url(null);
                      setInterceptedSubs([]);
                      setResolvedPlayerUrl(null);
                      setResolvingUrl(false);
                      setResolveError(null);
                    }}
                  >
                    <span>{src.label}</span>
                    {src.tag && (
                      <span className="source-dropdown__tag">{src.tag}</span>
                    )}
                    {src.note && (
                      <span className="source-dropdown__note">{src.note}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {/* Right-hand cluster of MovieVault's own controls. These sit outside
                the provider's UI on purpose: a click inside the embed can open an
                ad tab, so anything the user needs to be able to click safely lives
                here. Grouped rather than absolutely positioned, so the buttons
                cannot land on top of each other. */}
            <div className="player-overlay-group player-overlay-group--right">
            <button
              className="player-overlay-btn"
              onClick={() =>
                movieDownload
                  ? onGoToDownloads?.(movieDownload.id)
                  : (setShowSourceMenu(false), setShowDownload(true))
              }
              title={
                movieDownload
                  ? movieDownload.status === "downloading"
                    ? "Downloading… - view in Downloads"
                    : "Already downloaded - view in Downloads"
                  : "Download"
              }
            >
              {movieDownload ? (
                <span
                  className="player-downloaded-icon"
                  style={{
                    color:
                      movieDownload.status === "downloading"
                        ? "var(--red)"
                        : "#4caf50",
                  }}
                >
                  {movieDownload.status === "downloading" ? "↓" : "✓"}
                </span>
              ) : (
                <DownloadIcon />
              )}
              {!movieDownload && m3u8Url && (
                <span className="player-overlay-dot" />
              )}
              {!sourceSupportsProgress(playerSource) && (
                <span
                  className="player-no-progress-hint"
                  title="No automatic progress tracking for this source"
                >
                  ⚠ no tracking
                </span>
              )}
            </button>
              <button
                type="button"
                className="player-fullscreen-button"
                onClick={togglePlayerFullscreen}
                title={playerFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                aria-label={
                  playerFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                <FullscreenIcon exit={playerFullscreen} />
              </button>
            </div>
            <PlayerTroubleBar
              key={playerSource}
              sourceLabel={
                PLAYER_SOURCES.find((s) => s.id === playerSource)?.label
              }
              url={
                sourceIsAsync(playerSource)
                  ? resolvedPlayerUrl
                  : getSourceUrl(playerSource, "movie", item.id, null, null)
              }
              onTryNext={() => {
                const ids = PLAYER_SOURCES.map((src) => src.id);
                const next =
                  ids[(ids.indexOf(playerSource) + 1) % ids.length];
                if (!next || next === playerSource) return;
                  setShowSourceMenu(false);
                  setFailoverQueue([next]);
                  setCurrentQueueIndex(0);
                  setPlayerSource(next);
                  setFailoverError(false);
                  setWebviewLoading(true);
                  storage.set("playerSource", next);
                  setM3u8Url(null);
                  setInterceptedSubs([]);
                  setResolvedPlayerUrl(null);
                  setResolvingUrl(false);
                  setResolveError(null);
              }}
            />
            {postPlay && similarList.length > 0 && (
              <div className="post-play">
                <div className="post-play__card">
                  <p className="post-play__eyebrow">Finished {title}</p>
                  <h3 className="post-play__title">More like this</h3>
                  <div className="post-play__row">
                    {similarList.slice(0, 3).map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        className="post-play__item"
                        onClick={() => {
                          setPostPlay(false);
                          onSelect?.({ ...rec, media_type: "movie" });
                        }}
                      >
                        {imgUrl(rec.poster_path, "w185") && (
                          <img
                            src={imgUrl(rec.poster_path, "w185")}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <span>{rec.title || rec.name}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="post-play__dismiss"
                    onClick={() => setPostPlay(false)}
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}
            {feedbackText && (
              <div className="player-feedback-overlay">
                {feedbackText}
              </div>
            )}
          </div>

          {displayPct > 0 && (
            <div className="progress-bar-row">
              <div className="progress-bar-outer">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(displayPct, 100)}%` }}
                />
              </div>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                {progressLabel}
              </span>
            </div>
          )}
          <div className="progress-mark-row">
            <span
              style={{ fontSize: 12, color: "var(--text3)", marginRight: 4 }}
            >
              Mark progress:
            </span>
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                className="btn btn-ghost"
                style={{ padding: "5px 14px", fontSize: 12 }}
                onClick={() => {
                  saveProgress(progressKey, p);
                  if (p === 100) setPostPlay(true);
                }}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}

      {collection && onSelect && (
        <div className="section">
          <div className="section-title">{collection.name}</div>
          <div className="scroll-row">
            {collection.parts.map((part) => {
              const pk = `movie_${part.id}`;
              const isCurrent = part.id === item.id;
              return (
                <CollectionCard
                  key={part.id}
                  part={part}
                  pk={pk}
                  isCurrent={isCurrent}
                  onSelect={onSelect}
                  progress={progress[pk] || 0}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                />
              );
            })}
          </div>
        </div>
      )}

      {showTrailer && trailerKey && (
        <TrailerModal
          trailerKey={trailerKey}
          title={title}
          onClose={() => setShowTrailer(false)}
        />
      )}

      {showBlockedModal &&
        (window.electron?.isWebPolyfill ? (
          // The browser build cannot block network requests, so reporting a
          // count here would always read zero. It explains the mechanism and
          // offers the sandbox trade-off instead.
          <PopupShieldModal
            sourceLabel={
              PLAYER_SOURCES.find((src) => src.id === playerSource)?.label
            }
            sourceProtected={sourceIsProtected(playerSource)}
            shieldOn={sourceQueue.getPopupShield()}
            onToggleShield={() => {
              sourceQueue.savePopupShield(!sourceQueue.getPopupShield());
              setShowBlockedModal(false);
            }}
            onClose={() => setShowBlockedModal(false)}
          />
        ) : (
          <BlockedStatsModal
            sessionDomains={getBlockedDomains()}
            sessionTotal={blockedSession}
            alltimeTotal={blockedAlltime}
            onClose={() => setShowBlockedModal(false)}
          />
        ))}

      {showDownload && (
        <DownloadModal
          onClose={() => setShowDownload(false)}
          m3u8Url={m3u8Url}
          subtitles={interceptedSubs}
          mediaName={mediaName}
          downloaderFolder={downloaderFolder}
          setDownloaderFolder={handleSetDownloaderFolder}
          onOpenSettings={onSettings}
          onDownloadStarted={onDownloadStarted}
          mediaId={item.id}
          mediaType="movie"
          posterPath={d.poster_path}
          tmdbId={item.id}
        />
      )}

      {/* ── Cast row ── */}
      {castList.length > 0 && (
        <CastRow cast={castList} max={15} onSearch={onSearch} />
      )}

      {/* ── Production details (collapsible) ── */}
      {(productionCompanies || productionCountries || budgetFormatted || revenueFormatted) && (
        <div className="detail-extra-panel">
          <button
            className="detail-extra-toggle"
            onClick={() => setShowDetailsPanel((p) => !p)}
          >
            {showDetailsPanel ? "▲" : "▼"} Production Details
          </button>
          {showDetailsPanel && (
            <div className="detail-extra-content">
              {productionCompanies && (
                <div className="detail-extra-item">
                  <span className="detail-extra-label">Production</span>
                  <span className="detail-extra-value">{productionCompanies}</span>
                </div>
              )}
              {productionCountries && (
                <div className="detail-extra-item">
                  <span className="detail-extra-label">Country</span>
                  <span className="detail-extra-value">{productionCountries}</span>
                </div>
              )}
              {budgetFormatted && (
                <div className="detail-extra-item">
                  <span className="detail-extra-label">Budget</span>
                  <span className="detail-extra-value">{budgetFormatted}</span>
                </div>
              )}
              {revenueFormatted && (
                <div className="detail-extra-item">
                  <span className="detail-extra-label">Box Office</span>
                  <span className="detail-extra-value">{revenueFormatted}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Similar titles ── */}
      {similarList.length > 0 && onSelect && (
        <SimilarRow
          items={similarList}
          mediaType="movie"
          onSelect={onSelect}
          progress={progress}
          watched={watched}
          onMarkWatched={onMarkWatched}
          onMarkUnwatched={onMarkUnwatched}
          apiKey={apiKey}
        />
      )}

      </AsyncBoundary>
    </div>
  );
}

// ── CollectionCard ─────────────────────────────────────────────────────────
// Isolated memo'd wrapper so the onClick for each collection part is stable
// and doesn't cause MediaCard to re-render on every progress tick.
const CollectionCard = memo(function CollectionCard({
  part,
  isCurrent,
  onSelect,
  progress,
  watched,
  onMarkWatched,
  onMarkUnwatched,
}) {
  const handleClick = useCallback(() => onSelect(part), [onSelect, part]);
  return (
    <div
      style={{
        opacity: isCurrent ? 0.5 : 1,
        pointerEvents: isCurrent ? "none" : "auto",
      }}
    >
      <MediaCard
        item={part}
        onClick={handleClick}
        progress={progress}
        watched={watched}
        onMarkWatched={onMarkWatched}
        onMarkUnwatched={onMarkUnwatched}
      />
    </div>
  );
});

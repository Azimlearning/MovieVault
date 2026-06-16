import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { imgUrl, tmdbFetch } from "../utils/api";
import { storage, STORAGE_KEYS } from "../utils/storage";
import { PlayIcon, BookmarkIcon, BookmarkFillIcon, StarIcon } from "./Icons";

const ROTATION_INTERVAL_MS = 12_000;
const HOVER_DELAY_MS = 2_000;
const LEAVE_DELAY_MS = 4_000;

const VolumeOnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);
const VolumeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function HeroBanner({
  trending = [],
  trendingTV = [],
  apiKey,
  onSelect,
  onSave,
  saved = [],
}) {
  const heroPool = useMemo(() => {
    const movies = trending.slice(0, 3).map((i) => ({ ...i, media_type: "movie" }));
    const tvs = trendingTV.slice(0, 2).map((i) => ({ ...i, media_type: "tv" }));
    const merged = [];
    const max = Math.max(movies.length, tvs.length);
    for (let i = 0; i < max; i++) {
      if (movies[i]) merged.push(movies[i]);
      if (tvs[i]) merged.push(tvs[i]);
    }
    return merged.slice(0, 5);
  }, [trending, trendingTV]);

  const [activeIdx, setActiveIdx] = useState(0);
  const hero = heroPool[activeIdx] ?? null;

  const detailCacheRef = useRef({});
  const [detail, setDetail] = useState(null);

  const [trailerActive, setTrailerActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef(null);

  const hoverTimerRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const rotationTimerRef = useRef(null);
  const isHoveringRef = useRef(false);

  const autoplayEnabled = storage.get(STORAGE_KEYS.AUTOPLAY_TRAILERS) !== false;

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const bannerRef = useRef(null);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    if (!hero || !apiKey) return;

    const cacheKey = `${hero.id}_${hero.media_type}`;
    if (detailCacheRef.current[cacheKey] !== undefined) {
      setDetail(detailCacheRef.current[cacheKey]);
      return;
    }

    let mounted = true;
    const type = hero.media_type === "tv" ? "tv" : "movie";

    Promise.all([
      tmdbFetch(`/${type}/${hero.id}`, apiKey),
      tmdbFetch(`/${type}/${hero.id}/videos`, apiKey),
    ])
      .then(([d, vids]) => {
        if (!mounted) return;
        const trailers = (vids.results || []).filter(
          (v) => v.type === "Trailer" && v.site === "YouTube",
        );
        const resolved = {
          tagline: d.tagline || null,
          trailerKey: trailers[0]?.key || null,
        };
        detailCacheRef.current[cacheKey] = resolved;
        setDetail(resolved);
      })
      .catch(() => {
        if (!mounted) return;
        detailCacheRef.current[cacheKey] = null;
        setDetail(null);
      });

    return () => {
      mounted = false;
    };
  }, [hero?.id, hero?.media_type, apiKey]);

  useEffect(() => {
    setTrailerActive(false);
    setIsMuted(true);
    setDetail(null);
  }, [activeIdx]);

  const startRotation = useCallback(() => {
    clearInterval(rotationTimerRef.current);
    rotationTimerRef.current = setInterval(() => {
      if (isHoveringRef.current || trailerActive) return;
      setActiveIdx((prev) => (heroPool.length > 0 ? (prev + 1) % heroPool.length : 0));
    }, ROTATION_INTERVAL_MS);
  }, [heroPool.length, trailerActive]);

  useEffect(() => {
    if (heroPool.length === 0) return;
    startRotation();
    return () => clearInterval(rotationTimerRef.current);
  }, [heroPool.length, startRotation]);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting && autoplayEnabled && !prefersReducedMotion) {
          hoverTimerRef.current = setTimeout(() => {
            if (isVisibleRef.current && !isHoveringRef.current) {
              activateTrailer();
            }
          }, HOVER_DELAY_MS);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimeout(hoverTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayEnabled, prefersReducedMotion]);

  const activateTrailer = useCallback(() => {
    if (!detail?.trailerKey) return;
    if (!autoplayEnabled || prefersReducedMotion) return;
    setTrailerActive(true);
  }, [detail, autoplayEnabled, prefersReducedMotion]);

  const handleMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    clearTimeout(leaveTimerRef.current);

    if (!autoplayEnabled || prefersReducedMotion) return;

    hoverTimerRef.current = setTimeout(() => {
      if (isHoveringRef.current) activateTrailer();
    }, HOVER_DELAY_MS);
  }, [autoplayEnabled, prefersReducedMotion, activateTrailer]);

  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    clearTimeout(hoverTimerRef.current);

    leaveTimerRef.current = setTimeout(() => {
      setTrailerActive(false);
      setIsMuted(true);
    }, LEAVE_DELAY_MS);
  }, []);

  const toggleMute = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    if (isMuted) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "unMute" }),
        "*",
      );
    } else {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "mute" }),
        "*",
      );
    }
    setIsMuted((m) => !m);
  }, [isMuted]);

  const isHeroSaved = useMemo(() => {
    if (!hero) return false;
    const savedArray = Array.isArray(saved) ? saved : Object.values(saved || {});
    return savedArray.some(
      (s) => s && s.id === hero.id && (s.media_type || "movie") === hero.media_type,
    );
  }, [saved, hero]);

  const iframeSrc = useMemo(() => {
    if (!detail?.trailerKey) return null;
    return `https://www.youtube.com/embed/${detail.trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&playsinline=1&enablejsapi=1&rel=0&loop=1&playlist=${detail.trailerKey}`;
  }, [detail?.trailerKey]);

  if (!hero) return null;

  const title = hero.title || hero.name || "";
  const year = (hero.release_date || hero.first_air_date || "").slice(0, 4);
  const rating = hero.vote_average?.toFixed(1);
  const typeLabel = hero.media_type === "tv" ? "Trending · Series" : "Trending · Movie";
  const backdropUrl = imgUrl(hero.backdrop_path, "original");

  return (
    <div
      ref={bannerRef}
      className="hero-banner"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="hero-banner-backdrop"
        style={{
          backgroundImage: backdropUrl ? `url(${backdropUrl})` : undefined,
          opacity: trailerActive && !prefersReducedMotion ? 0 : 1,
        }}
      />

      {trailerActive && iframeSrc && !prefersReducedMotion && (
        <div className={`hero-banner-video-wrap${trailerActive ? " active" : ""}`}>
          <iframe
            ref={iframeRef}
            className="hero-banner-iframe"
            src={iframeSrc}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="Trailer"
          />
        </div>
      )}

      <div className="hero-banner-overlay" />

      <div className="hero-banner-content">
        <div className="hero-banner-type">{typeLabel}</div>
        <div className="hero-banner-title">{title}</div>

        {detail?.tagline && (
          <div className="hero-banner-tagline">"{detail.tagline}"</div>
        )}

        <div className="hero-banner-overview">
          {hero.overview}
        </div>

        {(rating || year) && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
            {rating && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#f5c518", fontSize: 13, fontWeight: 700 }}>
                <StarIcon size={12} />
                {rating}
              </span>
            )}
            {year && (
              <span style={{ color: "var(--text3)", fontSize: 13 }}>{year}</span>
            )}
          </div>
        )}

        <div className="hero-banner-actions">
          <button
            className="btn btn-primary"
            onClick={() => onSelect({ ...hero, playDirectly: true })}
            aria-label={`Play ${title}`}
          >
            <PlayIcon /> Play
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => {
              if (onSave) onSave(hero);
            }}
            aria-label={isHeroSaved ? "Remove from library" : "Add to library"}
          >
            {isHeroSaved ? <BookmarkFillIcon /> : <BookmarkIcon />}
            {isHeroSaved ? "In Library" : "Add to Library"}
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => onSelect(hero)}
            aria-label={`More info about ${title}`}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#fff",
              padding: "8px 18px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            More Info
          </button>
        </div>
      </div>

      {trailerActive && !prefersReducedMotion ? (
        <div className="hero-banner-video-active-controls">
          <div className="hero-banner-dots" style={{ position: "static" }}>
            {heroPool.map((_, idx) => (
              <button
                key={idx}
                className={`hero-banner-dot${idx === activeIdx ? " hero-banner-dot--active" : ""}`}
                onClick={() => {
                  setActiveIdx(idx);
                  setTrailerActive(false);
                }}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            className="hero-banner-unmute"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute trailer" : "Mute trailer"}
            style={{ position: "static" }}
          >
            {isMuted ? <VolumeOffIcon /> : <VolumeOnIcon />}
          </button>
        </div>
      ) : (
        heroPool.length > 1 && (
          <div className="hero-banner-dots">
            {heroPool.map((_, idx) => (
              <button
                key={idx}
                className={`hero-banner-dot${idx === activeIdx ? " hero-banner-dot--active" : ""}`}
                onClick={() => setActiveIdx(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

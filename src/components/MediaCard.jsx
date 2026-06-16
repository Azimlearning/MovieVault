import { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { imgUrl, isAnimeContent, tmdbFetch } from "../utils/api";
import Skeleton from "./Skeleton";
import {
  PlayIcon,
  FilmIcon,
  TVIcon,
  WatchedIcon,
  RatingShieldIcon,
  RatingLockIcon,
} from "./Icons";

const MediaCard = memo(function MediaCard({
  item,
  onClick,
  progress,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  ageRating,
  restricted,
  onRemove,
  apiKey,
}) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const isTV = item.media_type === "tv";
  const isAnime = isAnimeContent(item);

  // Unreleased detection
  const rawDate = item.release_date || item.first_air_date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isUnreleased = rawDate ? new Date(rawDate) > today : false;

  // Build watched key for TV cards from Continue Watching we get season/episode
  const watchedKey = isTV
    ? item.season != null && item.episode != null
      ? `tv_${item.id}_s${item.season}e${item.episode}`
      : `tv_${item.id}`
    : `movie_${item.id}`;

  const isWatched = !!watched?.[watchedKey];

  // Context menu state
  const [menu, setMenu] = useState(null); // { x, y }
  const menuRef = useRef(null);

  // Hover/Focus popout states
  const cardRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const [showPopout, setShowPopout] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [details, setDetails] = useState(null);
  const [popoutPos, setPopoutPos] = useState({ top: 0, left: 0 });

  // For TV series cards without a specific episode, watched marking is disabled
  const canMarkWatched = !isTV || (item.season != null && item.episode != null);

  const openMenu = useCallback(
    (e) => {
      if (!canMarkWatched) return; // no context menu for whole series
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY });
    },
    [canMarkWatched],
  );

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  const handleMarkWatched = (e) => {
    e.stopPropagation();
    onMarkWatched?.(watchedKey);
    setMenu(null);
  };
  const handleMarkUnwatched = (e) => {
    e.stopPropagation();
    onMarkUnwatched?.(watchedKey);
    setMenu(null);
  };

  // Hover and Focus Handlers for Popout
  const handleMouseEnter = useCallback(
    (e) => {
      if (isUnreleased) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      const rect = e.currentTarget.getBoundingClientRect();

      hoverTimerRef.current = setTimeout(async () => {
        const spacing = 8;
        const popoutWidth = 280;
        let left = rect.right + spacing;
        if (left + popoutWidth > window.innerWidth) {
          left = rect.left - popoutWidth - spacing;
          if (left < 0) {
            left = Math.max(8, window.innerWidth - popoutWidth - 8);
          }
        }

        let top = rect.top + window.scrollY + (rect.height - 120) / 2;
        const docHeight = document.documentElement.scrollHeight;
        top = Math.max(window.scrollY + 8, Math.min(top, docHeight - 160));

        setPopoutPos({ top, left });
        setShowPopout(true);

        if (!details && apiKey) {
          setLoadingDetails(true);
          try {
            const type = isTV ? "tv" : "movie";
            const data = await tmdbFetch(`/${type}/${item.id}`, apiKey);
            setDetails(data);
          } catch (err) {
            console.error("Failed to fetch details on card hover:", err);
          } finally {
            setLoadingDetails(false);
          }
        }
      }, 600);
    },
    [item.id, isTV, details, apiKey, isUnreleased],
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowPopout(false);
  }, []);

  const handleFocus = useCallback(
    (e) => {
      if (isUnreleased) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      const rect = e.currentTarget.getBoundingClientRect();

      hoverTimerRef.current = setTimeout(async () => {
        const spacing = 8;
        const popoutWidth = 280;
        let left = rect.right + spacing;
        if (left + popoutWidth > window.innerWidth) {
          left = rect.left - popoutWidth - spacing;
          if (left < 0) {
            left = Math.max(8, window.innerWidth - popoutWidth - 8);
          }
        }

        let top = rect.top + window.scrollY + (rect.height - 120) / 2;
        const docHeight = document.documentElement.scrollHeight;
        top = Math.max(window.scrollY + 8, Math.min(top, docHeight - 160));

        setPopoutPos({ top, left });
        setShowPopout(true);

        if (!details && apiKey) {
          setLoadingDetails(true);
          try {
            const type = isTV ? "tv" : "movie";
            const data = await tmdbFetch(`/${type}/${item.id}`, apiKey);
            setDetails(data);
          } catch (err) {
            console.error("Failed to fetch details on card focus:", err);
          } finally {
            setLoadingDetails(false);
          }
        }
      }, 600);
    },
    [item.id, isTV, details, apiKey, isUnreleased],
  );

  const handleBlur = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowPopout(false);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setShowPopout(false);
        onClick?.();
        return;
      }

      const cards = Array.from(document.querySelectorAll(".card"));
      const currentIndex = cards.indexOf(e.currentTarget);
      if (currentIndex === -1) return;

      const currentRect = e.currentTarget.getBoundingClientRect();

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < cards.length - 1) cards[currentIndex + 1].focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) cards[currentIndex - 1].focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const belowCards = cards.filter((card) => {
          const rect = card.getBoundingClientRect();
          return rect.top > currentRect.top + 5;
        });
        let closestRowTop = Infinity;
        belowCards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          if (rect.top < closestRowTop) closestRowTop = rect.top;
        });
        let closestCard = null;
        let minXDiff = Infinity;
        belowCards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          if (Math.abs(rect.top - closestRowTop) < 10) {
            const xDiff = Math.abs(rect.left - currentRect.left);
            if (xDiff < minXDiff) {
              minXDiff = xDiff;
              closestCard = card;
            }
          }
        });
        closestCard?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const aboveCards = cards.filter((card) => {
          const rect = card.getBoundingClientRect();
          return rect.top < currentRect.top - 5;
        });
        let closestRowTop = -Infinity;
        aboveCards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          if (rect.top > closestRowTop) closestRowTop = rect.top;
        });
        let closestCard = null;
        let minXDiff = Infinity;
        aboveCards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          if (Math.abs(rect.top - closestRowTop) < 10) {
            const xDiff = Math.abs(rect.left - currentRect.left);
            if (xDiff < minXDiff) {
              minXDiff = xDiff;
              closestCard = card;
            }
          }
        });
        closestCard?.focus();
      }
    },
    [onClick],
  );

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const ratingValue = details
    ? details.vote_average?.toFixed(1)
    : item.vote_average?.toFixed(1) || "N/A";
  const yearValue = details
    ? (details.release_date || details.first_air_date || "").slice(0, 4)
    : year;
  const runtimeValue = details
    ? isTV
      ? details.episode_run_time?.[0]
        ? `${details.episode_run_time[0]}m`
        : details.last_episode_to_air?.runtime
        ? `${details.last_episode_to_air.runtime}m`
        : "N/A"
      : details.runtime
      ? `${details.runtime}m`
      : "N/A"
    : null;

  return (
    <>
      <div
        ref={cardRef}
        className={`card${isWatched ? " ep-watched" : ""}${isUnreleased ? " card--unreleased" : ""}`}
        onClick={() => {
          setShowPopout(false);
          onClick?.();
        }}
        onContextMenu={isUnreleased ? undefined : openMenu}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <div className="card-poster">
          {item.poster_path ? (
            <img
              src={imgUrl(item.poster_path, "w342")}
              alt={title}
              loading="lazy"
            />
          ) : (
            <div className="no-poster">
              {isTV ? <TVIcon /> : <FilmIcon />}
              <span style={{ fontSize: 10, color: "var(--text3)" }}>
                No Image
              </span>
            </div>
          )}
          {ageRating && (
            <div
              className={`card-age-badge${restricted ? " card-age-badge--restricted" : ""}`}
            >
              {restricted ? (
                <RatingLockIcon size={9} />
              ) : (
                <RatingShieldIcon size={9} />
              )}
              {ageRating}
            </div>
          )}

          <div className="card-overlay">
            {isUnreleased ? (
              <div className="card-unreleased-overlay">
                <span className="card-unreleased-label">🔒 Unreleased</span>
              </div>
            ) : (
              <div className="card-play">
                <PlayIcon />
              </div>
            )}
          </div>
          {!isUnreleased && progress > 0 && !isWatched && (
            <div className="card-progress">
              <div
                className="card-progress-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
          {!isUnreleased && isWatched && (
            <div className="card-watched-badge">
              <WatchedIcon size={26} />
            </div>
          )}
        </div>
        <div className="card-info">
          <div className="card-title" title={title}>
            {title}
          </div>
          <div className="card-year">
            {year} · {isTV ? "Series" : "Movie"}
          </div>
        </div>
        <span
          className={`card-badge${isUnreleased ? " card-badge--unreleased" : ""}${isAnime && !isUnreleased ? " card-badge--anime" : ""}`}
        >
          {isUnreleased ? "SOON" : isAnime ? "ANIME" : isTV ? "TV" : "HD"}
        </span>
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {isWatched ? (
            <button className="context-menu-item" onClick={handleMarkUnwatched}>
              ↩ Mark as Unwatched
            </button>
          ) : (
            <button className="context-menu-item" onClick={handleMarkWatched}>
              ✓ Mark as Watched
            </button>
          )}
          {onRemove && (
            <button
              className="context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(watchedKey);
                setMenu(null);
              }}
              style={{ color: "var(--red)" }}
            >
              ✕ Remove from Continue
            </button>
          )}
        </div>
      )}

      {showPopout &&
        createPortal(
          <div
            className="card-info-popout"
            style={{
              top: popoutPos.top,
              left: popoutPos.left,
            }}
          >
            <div className="popout-header">
              <div className="popout-title">{title}</div>
              <div className="popout-rating">⭐ {ratingValue}</div>
            </div>
            <div className="popout-meta">
              <span>{yearValue}</span>
              <span>•</span>
              {loadingDetails ? (
                <Skeleton
                  width="40px"
                  height="12px"
                  style={{ display: "inline-block" }}
                />
              ) : (
                <span>{runtimeValue}</span>
              )}
              <span>•</span>
              <span>{isTV ? "Series" : "Movie"}</span>
            </div>
            <div className="popout-genres">
              {loadingDetails ? (
                <>
                  <Skeleton
                    width="45px"
                    height="16px"
                    style={{ borderRadius: 4, marginRight: 4 }}
                  />
                  <Skeleton
                    width="55px"
                    height="16px"
                    style={{ borderRadius: 4 }}
                  />
                </>
              ) : (
                details?.genres?.slice(0, 3).map((g) => (
                  <span key={g.id} className="popout-genre-chip">
                    {g.name}
                  </span>
                ))
              )}
            </div>
            <div className="popout-synopsis">
              {details?.overview || item.overview || "No synopsis available."}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
});
export default MediaCard;

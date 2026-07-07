import { imgUrl } from "../utils/api";
import { StarIcon } from "./Icons";

/**
 * HeroQuickPicks — small Bento tiles beside the main hero banner.
 * Props:
 *   items    – array of TMDB movie/tv objects (distinct from the hero's pool)
 *   onSelect – fn(item) opens detail page
 *   title    – section label (default "Top Rated")
 */
export default function HeroQuickPicks({ items = [], onSelect, title = "Top Rated" }) {
  const shown = items.slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <div className="hero-quickpicks">
      <div className="hero-quickpicks-title">{title}</div>
      <div className="hero-quickpicks-list">
        {shown.map((item) => {
          const itemTitle = item.title || item.name;
          const year = (item.release_date || item.first_air_date || "").slice(0, 4);
          const backdrop = imgUrl(item.backdrop_path || item.poster_path, "w300");
          return (
            <div
              key={`${item.media_type || "movie"}_${item.id}`}
              className="hero-quickpick-tile"
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(item);
                }
              }}
              style={{ backgroundImage: backdrop ? `url(${backdrop})` : undefined }}
              aria-label={itemTitle}
            >
              <div className="hero-quickpick-overlay" />
              <div className="hero-quickpick-info">
                <div className="hero-quickpick-title">{itemTitle}</div>
                <div className="hero-quickpick-meta">
                  {item.vote_average > 0 && (
                    <span className="hero-quickpick-rating">
                      <StarIcon size={10} />
                      {item.vote_average.toFixed(1)}
                    </span>
                  )}
                  {year && <span>{year}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

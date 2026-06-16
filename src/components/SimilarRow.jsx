import MediaCard from "./MediaCard";

/**
 * SimilarRow — "More like this" horizontal scroll of similar/recommended titles.
 * Props:
 *   items     – array of TMDB movie/tv objects
 *   mediaType – 'movie' | 'tv'
 *   onSelect  – fn(item) opens detail page
 *   progress  – watch progress map
 *   watched   – watched map
 *   onMarkWatched    – fn
 *   onMarkUnwatched  – fn
 *   apiKey    – for MediaCard hover popouts
 *   label     – section title (default "More Like This")
 */
export default function SimilarRow({
  items = [],
  mediaType = "movie",
  onSelect,
  progress = {},
  watched = {},
  onMarkWatched,
  onMarkUnwatched,
  apiKey,
  label = "More Like This",
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="section">
      <div className="section-title">{label}</div>
      <div className="scroll-row">
        {items.map((item) => {
          const enriched = { ...item, media_type: item.media_type || mediaType };
          const pk = `${mediaType}_${item.id}`;
          return (
            <MediaCard
              key={item.id}
              item={enriched}
              onClick={() => onSelect?.(enriched)}
              progress={progress[pk] || 0}
              watched={watched}
              onMarkWatched={onMarkWatched}
              onMarkUnwatched={onMarkUnwatched}
              apiKey={apiKey}
            />
          );
        })}
      </div>
    </div>
  );
}

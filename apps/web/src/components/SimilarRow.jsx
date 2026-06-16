import MediaCard from "./MediaCard";

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

const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w185";

export default function CastRow({ cast = [], max = 12, onSearch }) {
  if (!cast || cast.length === 0) return null;

  const shown = cast.slice(0, max);

  return (
    <div className="cast-row-wrap">
      <div className="cast-row-title">Cast</div>
      <div className="cast-row">
        {shown.map((person) => (
          <button
            key={person.id}
            type="button"
            className="cast-card"
            onClick={() => onSearch?.(person.name)}
            title={`Search for ${person.name}`}
          >
            <div className="cast-photo-wrap">
              {person.profile_path ? (
                <img
                  src={`${TMDB_IMG_BASE}${person.profile_path}`}
                  alt={person.name}
                  className="cast-photo"
                  loading="lazy"
                />
              ) : (
                <div className="cast-photo-placeholder">
                  <span style={{ fontSize: 28, opacity: 0.35 }}>👤</span>
                </div>
              )}
            </div>
            <div className="cast-name">{person.name}</div>
            {person.character && (
              <div className="cast-character">{person.character}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

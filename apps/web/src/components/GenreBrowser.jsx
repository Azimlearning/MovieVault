import { useState, useEffect, useCallback } from "react";
import MediaCard from "./MediaCard";
import { tmdbFetch } from "../utils/api";

export default function GenreBrowser({
  apiKey,
  onSelect,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  ratingsMap = {},
}) {
  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let mounted = true;
    Promise.all([
      tmdbFetch("/genre/movie/list", apiKey),
      tmdbFetch("/genre/tv/list", apiKey),
    ])
      .then(([movieG, tvG]) => {
        if (!mounted) return;
        const merged = new Map();
        (movieG.genres || []).forEach((g) => {
          merged.set(g.name, { ...(merged.get(g.name) || {}), name: g.name, idMovie: g.id });
        });
        (tvG.genres || []).forEach((g) => {
          merged.set(g.name, { ...(merged.get(g.name) || { name: g.name }), idTv: g.id });
        });
        setGenres(Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [apiKey]);

  const selectGenre = useCallback(
    (genre) => {
      if (activeGenre?.name === genre.name) {
        setActiveGenre(null);
        setResults([]);
        return;
      }
      setActiveGenre(genre);
      setLoading(true);
      const fetches = [];
      if (genre.idMovie) {
        fetches.push(
          tmdbFetch(`/discover/movie?with_genres=${genre.idMovie}&sort_by=popularity.desc`, apiKey)
            .then((d) => (d.results || []).map((r) => ({ ...r, media_type: "movie" })))
            .catch(() => []),
        );
      }
      if (genre.idTv) {
        fetches.push(
          tmdbFetch(`/discover/tv?with_genres=${genre.idTv}&sort_by=popularity.desc`, apiKey)
            .then((d) => (d.results || []).map((r) => ({ ...r, media_type: "tv" })))
            .catch(() => []),
        );
      }
      Promise.all(fetches).then((lists) => {
        const merged = lists
          .flat()
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        setResults(merged.slice(0, 24));
        setLoading(false);
      });
    },
    [activeGenre, apiKey],
  );

  if (genres.length === 0) return null;

  return (
    <div className="section">
      <div className="section-title">Browse by Genre</div>
      <div className="genre-chip-row">
        {genres.map((g) => (
          <button
            key={g.name}
            className={`genre-tag${activeGenre?.name === g.name ? " genre-tag--active" : ""}`}
            onClick={() => selectGenre(g)}
          >
            {g.name}
          </button>
        ))}
      </div>

      {activeGenre && (
        <div className="cards-grid" style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ color: "var(--text3)", fontSize: 13, padding: "8px 0" }}>
              Loading {activeGenre.name}…
            </div>
          ) : (
            results.map((item, idx) => {
              const rk = `${item.media_type}_${item.id}`;
              const rd = ratingsMap[rk] || {};
              return (
                <MediaCard
                  key={rk}
                  item={item}
                  onClick={() => onSelect(item)}
                  progress={0}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                  ageRating={rd.cert}
                  restricted={rd.restricted}
                  apiKey={apiKey}
                  featured={idx === 0}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

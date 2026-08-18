import { useState, useEffect, useCallback } from "react";
import MediaCard from "./MediaCard";
import { tmdbFetch } from "../utils/api";

// name: what the user sees. movie/tv: the TMDB genre names to resolve ids from.
// A TV umbrella genre deliberately backs two entries — a viewer looking for
// Fantasy series and one looking for Sci-Fi series both land on the same TMDB
// bucket, which is TMDB's modelling, not something to expose as two pills.
const CANONICAL_GENRES = [
  { name: "Action", movie: "Action", tv: "Action & Adventure" },
  { name: "Adventure", movie: "Adventure", tv: "Action & Adventure" },
  { name: "Comedy", movie: "Comedy", tv: "Comedy" },
  { name: "Drama", movie: "Drama", tv: "Drama" },
  { name: "Sci-Fi", movie: "Science Fiction", tv: "Sci-Fi & Fantasy" },
  { name: "Fantasy", movie: "Fantasy", tv: "Sci-Fi & Fantasy" },
  { name: "Thriller", movie: "Thriller", tv: null },
  { name: "Horror", movie: "Horror", tv: null },
  { name: "Crime", movie: "Crime", tv: "Crime" },
  { name: "Mystery", movie: "Mystery", tv: "Mystery" },
  { name: "Romance", movie: "Romance", tv: null },
  { name: "Animation", movie: "Animation", tv: "Animation" },
  { name: "Family", movie: "Family", tv: "Kids" },
  { name: "Documentary", movie: "Documentary", tv: "Documentary" },
  { name: "History", movie: "History", tv: null },
  { name: "War", movie: "War", tv: "War & Politics" },
  { name: "Western", movie: "Western", tv: "Western" },
];

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
        const byName = new Map();
        (movieG.genres || []).forEach((g) => byName.set(g.name, g.id));
        const tvByName = new Map();
        (tvG.genres || []).forEach((g) => tvByName.set(g.name, g.id));

        // Merging the two TMDB lists by raw name produced both "Action" and
        // "Action & Adventure", both "Science Fiction" and "Sci-Fi & Fantasy",
        // plus API artefacts nobody browses by (Soap, Talk, News, TV Movie).
        // This is the curated set, in the order people actually think in.
        const built = CANONICAL_GENRES.map((genre) => {
          const idMovie = genre.movie ? byName.get(genre.movie) : undefined;
          const idTv = genre.tv ? tvByName.get(genre.tv) : undefined;
          return idMovie || idTv
            ? { name: genre.name, idMovie, idTv }
            : null;
        }).filter(Boolean);

        setGenres(built);
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

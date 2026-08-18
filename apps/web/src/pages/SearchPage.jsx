import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { tmdbFetch, imgUrl } from "../utils/api";
import { SearchIcon, CloseIcon } from "../components/Icons";
import MediaCard from "../components/MediaCard";
import { storage } from "../utils/storage";

const HISTORY_KEY = "searchHistory";
const MAX_HISTORY = 12;

const GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 10759, name: "Action & Adventure" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
];

const GENRE_NAMES = Object.fromEntries(GENRES.map((g) => [g.id, g.name]));

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
];

const loadHistory = () => storage.get(HISTORY_KEY) || [];
const saveHistory = (history) => storage.set(HISTORY_KEY, history);

// Recent searches used to fill up with the keystrokes on the way to a word —
// "wan", "darede", "daredevi". Anything the new term starts with was a step
// towards it, not a search of its own, so it is replaced rather than kept.
function addTerm(list, term) {
  const trimmed = term.trim();
  if (!trimmed) return list;
  const lower = trimmed.toLowerCase();
  const kept = list.filter((entry) => {
    const existing = entry.toLowerCase();
    return existing !== lower && !lower.startsWith(existing);
  });
  return [trimmed, ...kept].slice(0, MAX_HISTORY);
}

function fuzzyMatch(text, query) {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  if (haystack.includes(needle)) return true;
  let idx = 0;
  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i] === needle[idx]) {
      idx++;
      if (idx === needle.length) return true;
    }
  }
  return false;
}

export default function SearchPage({
  apiKey,
  onSelect,
  offline,
  initialQuery = "",
  watched = {},
  onMarkWatched,
  onMarkUnwatched,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState("all"); // "all" | "library"
  const [fetched, setFetched] = useState({ titles: [], people: [] });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [showFilters, setShowFilters] = useState(false);
  const [trending, setTrending] = useState([]);

  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedLang, setSelectedLang] = useState("");
  const [selectedRating, setSelectedRating] = useState("");

  const inputRef = useRef();

  useEffect(() => {
    const tid = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(tid);
  }, []);

  // The query belongs in the address bar: a search is a place, so it can be
  // reloaded, shared and returned to. replaceState keeps typing out of the Back
  // stack — otherwise every keystroke would become a history entry.
  useEffect(() => {
    const tid = setTimeout(() => {
      const next = query.trim()
        ? `/search?q=${encodeURIComponent(query.trim())}`
        : "/search";
      if (next !== window.location.pathname + window.location.search) {
        window.history.replaceState(window.history.state, "", next);
      }
    }, 350);
    return () => clearTimeout(tid);
  }, [query]);

  // The empty state is a browse surface, not a blank screen (teardown §5).
  useEffect(() => {
    if (offline) return;
    tmdbFetch("/trending/all/week", apiKey)
      .then((data) => {
        if (data?.results) {
          setTrending(
            data.results.filter((r) => r.media_type !== "person").slice(0, 12),
          );
        }
      })
      .catch(() => {});
  }, [apiKey, offline]);

  const localLibrary = useMemo(() => {
    const saved = storage.get("saved") || {};
    const hist = storage.get("history") || [];
    const watchHist = storage.get("watchHistory") || {};

    const map = new Map();
    Object.values(saved).forEach((item) => {
      map.set(`${item.media_type}_${item.id}`, item);
    });
    hist.forEach((item) => {
      map.set(`${item.media_type}_${item.id}`, item);
    });
    Object.values(watchHist).forEach((item) => {
      map.set(`${item.media_type}_${item.tmdbId}`, {
        id: item.tmdbId,
        title: item.title,
        name: item.title,
        poster_path: item.poster_path,
        media_type: item.media_type,
        release_date: item.release_date || "",
        first_air_date: item.first_air_date || "",
      });
    });
    return Array.from(map.values());
  }, []);

  const localResults = useMemo(() => {
    if (!query.trim()) return [];
    return localLibrary
      .filter((item) => fuzzyMatch(item.title || item.name || "", query))
      .slice(0, scope === "library" ? 24 : 6);
  }, [query, localLibrary, scope]);

  // Results are derived, never cleared from inside an effect: an empty query or
  // a library-scoped search simply has no remote results to show.
  const searchable = !!query.trim() && scope === "all";
  const results = useMemo(
    () => (searchable ? fetched.titles : []),
    [searchable, fetched.titles],
  );
  const people = searchable ? fetched.people : [];

  useEffect(() => {
    if (!searchable) return undefined;
    let mounted = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await tmdbFetch(
          `/search/multi?query=${encodeURIComponent(query)}&page=1`,
          apiKey,
        );
        if (mounted) {
          const all = data.results || [];
          // Mixed-entity results: a person is a discovery path, not noise.
          const matchedPeople = all
            .filter((r) => r.media_type === "person" && r.profile_path)
            .slice(0, 6);

          let raw = all.filter((r) => r.media_type !== "person");
          if (selectedGenre) {
            raw = raw.filter((r) =>
              (r.genre_ids || []).includes(parseInt(selectedGenre, 10)),
            );
          }
          if (selectedYear) {
            raw = raw.filter((r) =>
              (r.release_date || r.first_air_date || "").startsWith(
                selectedYear,
              ),
            );
          }
          if (selectedLang) {
            raw = raw.filter((r) => r.original_language === selectedLang);
          }
          if (selectedRating) {
            raw = raw.filter(
              (r) => (r.vote_average || 0) >= parseFloat(selectedRating),
            );
          }
          setFetched({ titles: raw.slice(0, 24), people: matchedPeople });
        }
      } catch {
        if (mounted) setFetched({ titles: [], people: [] });
      }
      if (mounted) setLoading(false);
    }, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [
    query,
    searchable,
    apiKey,
    selectedGenre,
    selectedYear,
    selectedLang,
    selectedRating,
  ]);

  // Related genres turn a dead-end query into a browse path.
  const relatedGenres = useMemo(() => {
    const counts = new Map();
    results.forEach((r) => {
      (r.genre_ids || []).forEach((id) => {
        if (GENRE_NAMES[id]) counts.set(id, (counts.get(id) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => ({ id, name: GENRE_NAMES[id] }));
  }, [results]);

  const commitTerm = useCallback((term) => {
    setHistory((prev) => {
      const next = addTerm(prev, term);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeFromHistory = useCallback((event, term) => {
    event.stopPropagation();
    setHistory((prev) => {
      const next = prev.filter((entry) => entry !== term);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const handleSelect = useCallback(
    (result) => {
      if (query.trim()) commitTerm(query);
      onSelect(result);
    },
    [query, commitTerm, onSelect],
  );

  const cardProps = {
    watched,
    onMarkWatched,
    onMarkUnwatched,
    progress: 0,
  };

  const hasQuery = !!query.trim();
  const showingResults = results.length > 0 || localResults.length > 0;

  return (
    <div className="search-page fade-in">
      <div className="search-page__bar">
        <div className="search-page__input-wrap">
          <SearchIcon />
          <input
            ref={inputRef}
            className="search-page__input"
            placeholder="Search movies, series, and people"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) commitTerm(query);
              if (e.key === "Escape") setQuery("");
            }}
            autoComplete="off"
          />
          {hasQuery && (
            <button
              type="button"
              className="search-page__clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <CloseIcon />
            </button>
          )}
          <button
            type="button"
            className={`btn ${showFilters ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "7px 14px", fontSize: 12 }}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters
          </button>
        </div>

        <div className="search-page__scope">
          <button
            type="button"
            className={`search-scope__btn${scope === "all" ? " search-scope__btn--active" : ""}`}
            onClick={() => setScope("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`search-scope__btn${scope === "library" ? " search-scope__btn--active" : ""}`}
            onClick={() => setScope("library")}
          >
            My Library
          </button>

          {relatedGenres.length > 0 && scope === "all" && (
            <div className="search-page__related">
              <span>Explore titles related to:</span>
              {relatedGenres.map((genre) => (
                <button
                  key={genre.id}
                  type="button"
                  className="search-related__chip"
                  onClick={() => {
                    setSelectedGenre(String(genre.id));
                    setShowFilters(true);
                  }}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {showFilters && (
          <div className="search-page__filters">
            <label>
              <span>GENRE</span>
              <select
                className="library-filter-select"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                <option value="">All Genres</option>
                {GENRES.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>YEAR</span>
              <input
                type="number"
                min="1900"
                max="2030"
                placeholder="e.g. 2024"
                className="library-filter-input"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              />
            </label>
            <label>
              <span>LANGUAGE</span>
              <select
                className="library-filter-select"
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
              >
                <option value="">All Languages</option>
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>MIN RATING</span>
              <select
                className="library-filter-select"
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
              >
                <option value="">All Ratings</option>
                {[9, 8, 7, 6, 5].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}+ Rating
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {offline && (
        <div className="api-status-banner api-status-warn">
          <span>You are offline — search is unavailable.</span>
        </div>
      )}

      {!hasQuery && (
        <>
          {history.length > 0 && (
            <div className="section">
              <div className="section-title">Recent searches</div>
              <div className="search-chips">
                {history.map((term) => (
                  <span key={term} className="search-chip">
                    <button
                      type="button"
                      className="search-chip__term"
                      onClick={() => {
                        setQuery(term);
                        inputRef.current?.focus();
                      }}
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      className="search-chip__remove"
                      onClick={(e) => removeFromHistory(e, term)}
                      aria-label={`Remove ${term}`}
                    >
                      <CloseIcon />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="search-chips__clear"
                  onClick={clearHistory}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {trending.length > 0 && (
            <div className="section">
              <div className="section-title">Top searches this week</div>
              <div className="cards-grid">
                {trending.map((item) => (
                  <MediaCard
                    key={`trend_${item.media_type}_${item.id}`}
                    item={item}
                    onClick={() => handleSelect(item)}
                    {...cardProps}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {hasQuery && (
        <>
          {people.length > 0 && scope === "all" && (
            <div className="section">
              <div className="section-title">People</div>
              <div className="search-people">
                {people.map((person) => (
                  <button
                    key={`person_${person.id}`}
                    type="button"
                    className="search-person"
                    onClick={() => {
                      const known = (person.known_for || []).find(
                        (entry) => entry.media_type !== "person",
                      );
                      if (known) handleSelect(known);
                    }}
                  >
                    <img
                      src={imgUrl(person.profile_path, "w185")}
                      alt=""
                      loading="lazy"
                    />
                    <span>{person.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {localResults.length > 0 && (
            <div className="section">
              <div className="section-title">
                {scope === "library" ? "In your library" : "From your library"}
              </div>
              <div className="cards-grid">
                {localResults.map((item) => (
                  <MediaCard
                    key={`local_${item.media_type}_${item.id}`}
                    item={item}
                    onClick={() => handleSelect(item)}
                    {...cardProps}
                  />
                ))}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="section">
              <div className="section-title">Titles</div>
              <div className="cards-grid">
                {results.map((item) => (
                  <MediaCard
                    key={`result_${item.media_type}_${item.id}`}
                    item={item}
                    onClick={() => handleSelect(item)}
                    {...cardProps}
                  />
                ))}
              </div>
            </div>
          )}

          {loading && !showingResults && (
            <div className="loader">
              <div className="spinner" />
            </div>
          )}

          {!loading && !showingResults && people.length === 0 && (
            <div className="search-empty">
              No results for &ldquo;{query}&rdquo;
              {scope === "library" ? " in your library" : ""}
            </div>
          )}
        </>
      )}
    </div>
  );
}

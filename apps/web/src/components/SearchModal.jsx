import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { tmdbFetch, imgUrl } from "../utils/api";
import { SearchIcon, CloseIcon } from "./Icons";
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
  { id: 10765, name: "Sci-Fi & Fantasy" }
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" }
];

function loadHistory() {
  return storage.get(HISTORY_KEY) || [];
}

function saveHistory(history) {
  storage.set(HISTORY_KEY, history);
}

function fuzzyMatch(text, query) {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  let qIdx = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === q[qIdx]) {
      qIdx++;
      if (qIdx === q.length) return true;
    }
  }
  return false;
}

export default function SearchModal({ apiKey, onSelect, onClose, offline }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [showFilters, setShowFilters] = useState(false);
  const [trending, setTrending] = useState([]);

  // Search filters
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedLang, setSelectedLang] = useState("");
  const [selectedRating, setSelectedRating] = useState("");

  const inputRef = useRef();

  useEffect(() => {
    const tid = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(tid);
  }, []);

  // Fetch trending movies on mount for empty suggestions
  useEffect(() => {
    if (offline) return;
    tmdbFetch("/trending/all/week", apiKey)
      .then((data) => {
        if (data?.results) {
          setTrending(data.results.filter(r => r.media_type !== "person").slice(0, 6));
        }
      })
      .catch(() => {});
  }, [apiKey, offline]);

  // Local Library collection for fuzzy match
  const localLibrary = useMemo(() => {
    const saved = storage.get("saved") || {};
    const hist = storage.get("history") || [];
    const watchHist = storage.get("watchHistory") || {};
    
    const map = new Map();
    Object.values(saved).forEach(item => {
      map.set(`${item.media_type}_${item.id}`, item);
    });
    hist.forEach(item => {
      map.set(`${item.media_type}_${item.id}`, item);
    });
    Object.values(watchHist).forEach(item => {
      map.set(`${item.media_type}_${item.tmdbId}`, {
        id: item.tmdbId,
        title: item.title,
        name: item.title,
        poster_path: item.poster_path,
        media_type: item.media_type,
        release_date: item.release_date || "",
        first_air_date: item.first_air_date || ""
      });
    });
    return Array.from(map.values());
  }, []);

  // Fuzzy matches in local library
  const localResults = useMemo(() => {
    if (!query.trim()) return [];
    return localLibrary.filter(item => {
      const title = item.title || item.name || "";
      return fuzzyMatch(title, query);
    }).slice(0, 5);
  }, [query, localLibrary]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let mounted = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await tmdbFetch(
          `/search/multi?query=${encodeURIComponent(query)}&page=1`,
          apiKey,
        );
        if (mounted) {
          // Client-side filtering based on selected filters
          let raw = data.results || [];
          raw = raw.filter((r) => r.media_type !== "person");

          if (selectedGenre) {
            raw = raw.filter((r) => {
              const ids = r.genre_ids || [];
              return ids.includes(parseInt(selectedGenre));
            });
          }

          if (selectedYear) {
            raw = raw.filter((r) => {
              const date = r.release_date || r.first_air_date || "";
              return date.startsWith(selectedYear);
            });
          }

          if (selectedLang) {
            raw = raw.filter((r) => r.original_language === selectedLang);
          }

          if (selectedRating) {
            raw = raw.filter((r) => (r.vote_average || 0) >= parseFloat(selectedRating));
          }

          setResults(raw.slice(0, 12));
        }
      } catch {}
      if (mounted) setLoading(false);
    }, 380);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query, apiKey, selectedGenre, selectedYear, selectedLang, selectedRating]);

  const addToHistory = useCallback((term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(
        0,
        MAX_HISTORY,
      );
      saveHistory(next);
      return next;
    });
  }, []);

  const removeFromHistory = useCallback((e, term) => {
    e.stopPropagation();
    setHistory((prev) => {
      const next = prev.filter((h) => h !== term);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const handleSelect = (r) => {
    const trimmed = query.trim();
    if (trimmed) {
      const next = [trimmed, ...history.filter((h) => h !== trimmed)].slice(
        0,
        MAX_HISTORY,
      );
      saveHistory(next);
      setHistory(next);
    }
    onSelect(r);
    onClose();
  };

  const handleHistoryClick = useCallback((term) => {
    setQuery(term);
    inputRef.current?.focus();
  }, []);

  const handleKey = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && query.trim()) addToHistory(query);
  };

  const showHistory = !query && history.length > 0;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="search-box">
        <div className="search-input-wrap">
          <SearchIcon />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search movies and series..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <button
            className={`btn ${showFilters ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "6px 12px", fontSize: 12 }}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </button>
          {query ? (
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setQuery("")}
            >
              <CloseIcon />
            </button>
          ) : (
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <CloseIcon />
            </button>
          )}
        </div>

        {showFilters && (
          <div
            style={{
              padding: "16px 20px",
              background: "var(--surface2)",
              borderBottom: "1px solid var(--border)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 12
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>GENRE</label>
              <select
                className="library-filter-select"
                style={{ width: "100%", padding: "6px 10px", fontSize: 12 }}
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                <option value="">All Genres</option>
                {GENRES.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>YEAR</label>
              <input
                type="number"
                min="1900"
                max="2030"
                placeholder="e.g. 2024"
                className="library-filter-input"
                style={{ width: "100%", padding: "6px 10px", fontSize: 12 }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>LANGUAGE</label>
              <select
                className="library-filter-select"
                style={{ width: "100%", padding: "6px 10px", fontSize: 12 }}
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
              >
                <option value="">All Languages</option>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>MIN RATING</label>
              <select
                className="library-filter-select"
                style={{ width: "100%", padding: "6px 10px", fontSize: 12 }}
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
              >
                <option value="">All Ratings</option>
                <option value="9">9+ Rating</option>
                <option value="8">8+ Rating</option>
                <option value="7">7+ Rating</option>
                <option value="6">6+ Rating</option>
                <option value="5">5+ Rating</option>
              </select>
            </div>
          </div>
        )}

        <div className="search-results" style={{ padding: "12px" }}>
          {offline && (
            <div
              style={{
                padding: "12px 20px",
                background: "rgba(255,165,0,0.1)",
                borderBottom: "1px solid var(--border)",
                fontSize: 13,
                color: "#ff9800",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🌐 No internet, search is unavailable offline.
            </div>
          )}

          {/* Local Library Matches (Fuzzy Search) */}
          {localResults.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, paddingLeft: 8 }}>
                From Your Library
              </div>
              {localResults.map((r) => (
                <div
                  key={`local_${r.media_type}_${r.id}`}
                  className="search-result"
                  onClick={() => handleSelect(r)}
                  style={{ borderLeft: "2px solid var(--red)" }}
                >
                  <img
                    src={
                      r.poster_path
                        ? imgUrl(r.poster_path, "w92")
                        : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='58'%3E%3Crect fill='%23222' width='40' height='58'/%3E%3C/svg%3E"
                    }
                    alt=""
                  />
                  <div className="search-result-info">
                    <div className="search-result-title">{r.title || r.name}</div>
                    <div className="search-result-meta">
                      {(r.release_date || r.first_air_date || "").slice(0, 4)}
                      {r.vote_average ? ` · ★ ${r.vote_average.toFixed(1)}` : ""}
                    </div>
                  </div>
                  <span className={`search-result-type ${r.media_type === "tv" ? "type-tv" : "type-movie"}`}>
                    {r.media_type === "tv" ? "Series" : "Movie"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!offline && loading && (
            <div className="loader">
              <div className="spinner" />
            </div>
          )}

          {!loading && query && results.length === 0 && localResults.length === 0 && (
            <div className="search-empty">No results for "{query}"</div>
          )}

          {!loading && results.length > 0 && (
            <div>
              {localResults.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, paddingLeft: 8, marginTop: 12 }}>
                  Online Results
                </div>
              )}
              {results.map((r) => (
                <div
                  key={r.id}
                  className="search-result"
                  onClick={() => handleSelect(r)}
                >
                  <img
                    src={
                      r.poster_path
                        ? imgUrl(r.poster_path, "w92")
                        : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='58'%3E%3Crect fill='%23222' width='40' height='58'/%3E%3C/svg%3E"
                    }
                    alt=""
                  />
                  <div className="search-result-info">
                    <div className="search-result-title">{r.title || r.name}</div>
                    <div className="search-result-meta">
                      {(r.release_date || r.first_air_date || "").slice(0, 4)}
                      {r.vote_average ? ` · ★ ${r.vote_average.toFixed(1)}` : ""}
                    </div>
                  </div>
                  <span
                    className={`search-result-type ${r.media_type === "tv" ? "type-tv" : "type-movie"}`}
                  >
                    {r.media_type === "tv" ? "Series" : "Movie"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {showHistory && (
            <div className="search-history">
              <div className="search-history-header">
                <span className="search-history-label">Recent searches</span>
                <button className="search-history-clear" onClick={clearHistory}>
                  Clear all
                </button>
              </div>
              {history.map((term) => (
                <div
                  key={term}
                  className="search-history-item"
                  onClick={() => handleHistoryClick(term)}
                >
                  <span className="search-history-icon">
                    <SearchIcon />
                  </span>
                  <span className="search-history-term">{term}</span>
                  <button
                    className="search-history-remove"
                    onClick={(e) => removeFromHistory(e, term)}
                    title="Remove"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Trending Suggestions */}
          {!query && history.length === 0 && trending.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, paddingLeft: 8 }}>
                Trending This Week
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {trending.map((r) => (
                  <div
                    key={`trending_${r.id}`}
                    className="search-result"
                    onClick={() => handleSelect(r)}
                    style={{ background: "var(--surface2)", padding: 8 }}
                  >
                    <img
                      src={
                        r.poster_path
                          ? imgUrl(r.poster_path, "w92")
                          : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='58'%3E%3Crect fill='%23222' width='40' height='58'/%3E%3C/svg%3E"
                      }
                      alt=""
                      style={{ width: 34, height: 48 }}
                    />
                    <div className="search-result-info">
                      <div className="search-result-title" style={{ fontSize: 13 }}>{r.title || r.name}</div>
                      <div className="search-result-meta" style={{ fontSize: 11 }}>
                        {(r.release_date || r.first_air_date || "").slice(0, 4)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!query && history.length === 0 && trending.length === 0 && (
            <div className="search-hint">
              Search for movies and series &nbsp;·&nbsp; <kbd>ESC</kbd> to close
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useMemo, useState, useEffect } from "react";
import MediaCard from "../components/MediaCard";
import { imgUrl, isAnimeContent } from "../utils/api";
import { EyeIcon, WatchedIcon } from "../components/Icons";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import { storage, STORAGE_KEYS } from "../utils/storage";
import AsyncBoundary from "../components/AsyncBoundary";

const GENRE_MAP = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

export default function LibraryPage({
  history,
  inProgress,
  saved,
  progress,
  onSelect,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  watchHistory = {}
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedRating, setSelectedRating] = useState("");
  const [sortOption, setSortOption] = useState("recently-watched");

  // Tab switching keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (e.key >= "1" && e.key <= "8") {
        e.preventDefault();
        const tabIdx = parseInt(e.key) - 1;
        const tabKeys = ["all", "movies", "tv", "anime", "watching", "watchlist", "finished", "stats"];
        if (tabKeys[tabIdx]) {
          setActiveTab(tabKeys[tabIdx]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Consolidate all unique items in the library
  const allItemsMap = useMemo(() => {
    const map = new Map();
    // Add saved (watchlist)
    saved.forEach(item => {
      const key = `${item.media_type}_${item.id}`;
      map.set(key, { ...item, status: "watchlist" });
    });
    // Add inProgress (watching)
    inProgress.forEach(item => {
      const key = `${item.media_type}_${item.id}`;
      const existing = map.get(key) || item;
      map.set(key, { ...existing, status: "watching", season: item.season, episode: item.episode });
    });
    // Add history (watched / finished)
    history.forEach(item => {
      const key = `${item.media_type}_${item.id}`;
      const existing = map.get(key) || item;
      const isFinished = watched[key] || watched[`${item.media_type}_${item.id}_s${item.season}e${item.episode}`];
      map.set(key, { ...existing, status: isFinished ? "finished" : (existing.status || "finished") });
    });
    return map;
  }, [saved, inProgress, history, watched]);

  const allItems = useMemo(() => Array.from(allItemsMap.values()), [allItemsMap]);
  const { ratingsMap, ageLimitSetting } = useRatings(allItems);

  const getRating = useCallback(
    (item) => getRatingForItem(item, ratingsMap),
    [ratingsMap],
  );
  const itemRestricted = useCallback(
    (item) => isRestricted(getRating(item).minAge, ageLimitSetting),
    [getRating, ageLimitSetting],
  );

  // Derive unique genres from all items for filter dropdown
  const availableGenres = useMemo(() => {
    const genresSet = new Set();
    allItems.forEach(item => {
      const itemGenres = item.genres || item.genre_ids || [];
      itemGenres.forEach(g => {
        const id = typeof g === "object" ? g.id : g;
        const name = GENRE_MAP[id] || (typeof g === "object" ? g.name : null);
        if (name) genresSet.add(name);
      });
    });
    return Array.from(genresSet).sort();
  }, [allItems]);

  // Tab Filtering
  const tabFilteredItems = useMemo(() => {
    return allItems.filter(item => {
      const isAnime = isAnimeContent(item);
      if (activeTab === "movies") return item.media_type === "movie";
      if (activeTab === "tv") return item.media_type === "tv" && !isAnime;
      if (activeTab === "anime") return isAnime;
      if (activeTab === "watching") return item.status === "watching";
      if (activeTab === "watchlist") return item.status === "watchlist";
      if (activeTab === "finished") return item.status === "finished";
      return true; // "all"
    });
  }, [allItems, activeTab]);

  // Search, Genre, and Rating Filtering
  const filteredItems = useMemo(() => {
    return tabFilteredItems.filter(item => {
      // Search text match
      const title = (item.title || item.name || "").toLowerCase();
      if (searchQuery && !title.includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Genre match
      if (selectedGenre) {
        const itemGenres = (item.genres || item.genre_ids || []).map(g => {
          const id = typeof g === "object" ? g.id : g;
          return GENRE_MAP[id] || (typeof g === "object" ? g.name : "");
        });
        if (!itemGenres.includes(selectedGenre)) return false;
      }

      // Rating match
      if (selectedRating) {
        const rating = item.vote_average || 0;
        if (rating < parseFloat(selectedRating)) return false;
      }

      return true;
    });
  }, [tabFilteredItems, searchQuery, selectedGenre, selectedRating]);

  // Sorting
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    return list.sort((a, b) => {
      if (sortOption === "title") {
        return (a.title || a.name || "").localeCompare(b.title || b.name || "");
      }
      if (sortOption === "rating") {
        return (b.vote_average || 0) - (a.vote_average || 0);
      }
      if (sortOption === "year") {
        const aDate = a.release_date || a.first_air_date || "";
        const bDate = b.release_date || b.first_air_date || "";
        return bDate.localeCompare(aDate);
      }
      if (sortOption === "recently-watched") {
        const aKey = a.media_type === "movie" ? `movie_${a.id}` : `tv_${a.id}_s${a.season}e${a.episode}`;
        const bKey = b.media_type === "movie" ? `movie_${b.id}` : `tv_${b.id}_s${b.season}e${b.episode}`;
        const aTime = watchHistory[aKey]?.lastWatchedAt || 0;
        const bTime = watchHistory[bKey]?.lastWatchedAt || 0;
        return bTime - aTime;
      }
      return 0;
    });
  }, [filteredItems, sortOption, watchHistory]);

  // ── Watch Stats Computations ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const historyList = Object.values(watchHistory);

    // 1. Total Hours Watched
    let totalSeconds = 0;
    historyList.forEach(entry => {
      if (entry.duration > 0) {
        totalSeconds += entry.position;
      } else {
        totalSeconds += entry.media_type === "movie" ? 90 * 60 : 25 * 60;
      }
    });
    const totalHours = (totalSeconds / 3600).toFixed(1);

    // 2. Titles Started
    const titlesStarted = new Set(historyList.map(e => e.tmdbId)).size;

    // 3. Titles Finished
    const finishedKeys = Object.keys(watched);
    const titlesFinished = new Set(finishedKeys.map(k => k.split("_")[1])).size;

    // 4. Watch Streak
    const dates = Array.from(new Set([
      ...historyList.map(e => new Date(e.lastWatchedAt).toDateString()),
      ...history.map(h => new Date(h.watchedAt).toDateString())
    ])).map(d => new Date(d).getTime()).sort((a, b) => a - b);

    let longestStreak = 0;
    let currentStreak = 0;
    let prevTime = null;
    dates.forEach(time => {
      if (prevTime === null) {
        currentStreak = 1;
      } else {
        const diff = time - prevTime;
        if (diff <= ONE_DAY + 2 * 60 * 60 * 1000) {
          currentStreak++;
        } else {
          if (currentStreak > longestStreak) longestStreak = currentStreak;
          currentStreak = 1;
        }
      }
      prevTime = time;
    });
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    // 5. Weekly Hours Distribution (last 12 weeks)
    const weeklyData = [];
    let maxHours = 0.5;
    for (let i = 11; i >= 0; i--) {
      const start = now - (i + 1) * 7 * ONE_DAY;
      const end = now - i * 7 * ONE_DAY;
      let seconds = 0;
      historyList.forEach(entry => {
        if (entry.lastWatchedAt >= start && entry.lastWatchedAt < end) {
          if (entry.duration > 0) {
            seconds += entry.position;
          } else {
            seconds += entry.media_type === "movie" ? 90 * 60 : 25 * 60;
          }
        }
      });
      const hours = parseFloat((seconds / 3600).toFixed(1));
      if (hours > maxHours) maxHours = hours;
      weeklyData.push({
        label: i === 0 ? "This Week" : `${i}w ago`,
        hours
      });
    }

    // 6. Top Genres (by count of items watched)
    const genreCounts = {};
    historyList.forEach(entry => {
      const genres = entry.genres || [];
      genres.forEach(g => {
        const id = typeof g === "object" ? g.id : g;
        const name = GENRE_MAP[id] || (typeof g === "object" ? g.name : null) || "Other";
        genreCounts[name] = (genreCounts[name] || 0) + 1;
      });
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // 7. Forgotten About (started >30d ago, no activity since, and not finished)
    const THIRTY_DAYS = 30 * ONE_DAY;
    const forgotten = historyList.filter(entry => {
      const age = now - entry.lastWatchedAt;
      const pct = entry.duration > 0 ? (entry.position / entry.duration) * 100 : 0;
      const isFinished = watched[entry.key] || pct >= 90;
      return age > THIRTY_DAYS && !isFinished;
    }).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt).slice(0, 5);

    return {
      totalHours,
      titlesStarted,
      titlesFinished,
      longestStreak,
      weeklyData,
      maxHours,
      topGenres,
      forgotten
    };
  }, [watchHistory, history, watched]);

  const libraryState = useMemo(() => {
    if (activeTab !== "stats" && sortedItems.length === 0) {
      return "empty";
    }
    return null;
  }, [sortedItems.length, activeTab]);

  const emptyComponent = (
    <div className="empty-state">
      <EyeIcon />
      <h3>No titles found</h3>
      <p>Try adjusting your search queries or filter categories.</p>
    </div>
  );

  return (
    <div className="fade-in library-container">
      <div className="library-header-row">
        <div>
          <div className="library-title" style={{ fontFamily: "var(--font-display)", fontSize: 32, letterSpacing: 1 }}>My Library</div>
          <div className="library-sub" style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
            Organize, search, and track your streaming collection and watch habits.
          </div>
        </div>

        <div className="library-tabs">
          {[
            { id: "all", label: "All" },
            { id: "movies", label: "Movies" },
            { id: "tv", label: "TV" },
            { id: "anime", label: "Anime" },
            { id: "watching", label: "Watching" },
            { id: "watchlist", label: "Watchlist" },
            { id: "finished", label: "Finished" },
            { id: "stats", label: "Stats" },
          ].map((t) => (
            <button
              key={t.id}
              className={`library-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab !== "stats" && (
        <div className="library-filters-row">
          <input
            type="text"
            className="library-filter-input"
            placeholder="Search title... (Press /)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="library-filter-select"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            <option value="">All Genres</option>
            {availableGenres.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            className="library-filter-select"
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

          <select
            className="library-filter-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="recently-watched">Recently Watched</option>
            <option value="title">A-Z</option>
            <option value="rating">Top Rated</option>
            <option value="year">Newest First</option>
          </select>
        </div>
      )}

      {activeTab === "stats" ? (
        <div className="fade-in">
          {/* Stat Cards */}
          <div className="stats-grid">
            <div className="stats-card">
              <div className="stats-card-val">{stats.totalHours}h</div>
              <div className="stats-card-label">Hours Watched</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-val">{stats.titlesStarted}</div>
              <div className="stats-card-label">Titles Started</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-val">{stats.titlesFinished}</div>
              <div className="stats-card-label">Titles Finished</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-val">{stats.longestStreak} days</div>
              <div className="stats-card-label">Longest Streak</div>
            </div>
          </div>

          <div className="stats-charts-row">
            {/* Hours Weekly Bar Chart */}
            <div className="stats-chart-box">
              <div className="stats-chart-title">Weekly Watch Hours (Last 12 Weeks)</div>
              <div className="stats-bar-chart">
                {stats.weeklyData.map((d, i) => {
                  const pct = Math.max(2, (d.hours / stats.maxHours) * 100);
                  return (
                    <div key={i} className="stats-bar-wrapper">
                      <div className="stats-bar-fill" style={{ height: `${pct}%` }}>
                        <div className="stats-bar-tooltip">{d.hours}h</div>
                      </div>
                      <div className="stats-bar-label">{d.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Genres list */}
            <div className="stats-chart-box">
              <div className="stats-chart-title">Top Genres</div>
              {stats.topGenres.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {stats.topGenres.map((g, i) => {
                    const totalCount = stats.topGenres.reduce((acc, curr) => acc + curr.count, 0);
                    const pct = Math.round((g.count / totalCount) * 100);
                    return (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                          <span>{g.name}</span>
                          <span style={{ color: "var(--text3)" }}>{g.count} views ({pct}%)</span>
                        </div>
                        <div style={{ height: 6, background: "var(--surface3)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "var(--red)", borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: "var(--text3)", textAlign: "center", paddingTop: 40 }}>
                  No genres found
                </div>
              )}
            </div>
          </div>

          {/* Forgotten About Section */}
          <div className="stats-chart-box" style={{ marginBottom: 32 }}>
            <div className="stats-chart-title">Forgotten About (In Progress &gt; 30 Days)</div>
            {stats.forgotten.length > 0 ? (
              <div className="stats-forgotten-list">
                {stats.forgotten.map((item) => {
                  const pct = item.duration > 0 ? Math.round((item.position / item.duration) * 100) : 0;
                  return (
                    <div
                      key={item.key}
                      className="stats-forgotten-item"
                      onClick={() => onSelect({ id: item.tmdbId, media_type: item.media_type, title: item.title, name: item.title, poster_path: item.poster_path })}
                    >
                      {item.poster_path ? (
                        <img className="stats-forgotten-img" src={imgUrl(item.poster_path, "w92")} alt="" />
                      ) : (
                        <div className="stats-forgotten-img" style={{ background: "var(--surface3)" }} />
                      )}
                      <div className="stats-forgotten-info">
                        <div className="stats-forgotten-title">{item.title}</div>
                        <div className="stats-forgotten-meta">
                          {item.media_type === "tv" ? `Season ${item.season} Episode ${item.episode}` : "Movie"} · {pct}% Watched · Last watched {new Date(item.lastWatchedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`search-result-type ${item.media_type === "tv" ? "type-tv" : "type-movie"}`}>
                        {item.media_type === "tv" ? "Series" : "Movie"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: "var(--text3)", textAlign: "center", padding: "24px 0" }}>
                No forgotten items in progress! Outstanding work.
              </div>
            )}
          </div>
        </div>
      ) : (
        <AsyncBoundary state={libraryState} emptyComponent={emptyComponent}>
          <div className="cards-grid" style={{ marginTop: 8 }}>
            {sortedItems.map((item) => {
              const pk =
                item.media_type === "movie"
                  ? `movie_${item.id}`
                  : `tv_${item.id}_s${item.season || 1}e${item.episode || 1}`;
              const r = getRating(item);
              const restr = itemRestricted(item);
              return (
                <MediaCard
                  key={`${item.media_type}_${item.id}`}
                  item={item}
                  onClick={() => onSelect(item)}
                  progress={progress[pk] || 0}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                  ageRating={r.cert}
                  restricted={restr}
                />
              );
            })}
          </div>
        </AsyncBoundary>
      )}
    </div>
  );
}

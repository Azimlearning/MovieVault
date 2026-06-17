import { useState, useMemo, useEffect } from "react";
import { StrawHatIcon } from "../components/Icons";
import { getHighestOriginalEpisode } from "../utils/onepaceMapping";
import { fetchOnePaceCatalog } from "../utils/onepaceApi";

const SAGAS = [
  "All",
  "East Blue",
  "Alabasta",
  "Skypiea",
  "Water 7",
  "Thriller Bark",
  "Summit War",
  "Fishman Island",
  "Dressrosa",
  "Whole Cake Island",
  "Wano",
  "Final Saga"
];

const SAGA_MAP = {
  "romance-dawn": "East Blue",
  "orange-town": "East Blue",
  "syrup-village": "East Blue",
  "gaimon": "East Blue",
  "baratie": "East Blue",
  "arlong-park": "East Blue",
  "the-adventures-of-buggys-crew": "East Blue",
  "loguetown": "East Blue",
  "reverse-mountain": "Alabasta",
  "whisky-peak": "Alabasta",
  "the-trials-of-koby-meppo": "Alabasta",
  "little-garden": "Alabasta",
  "drum-island": "Alabasta",
  "alabasta": "Alabasta",
  "jaya": "Skypiea",
  "skypiea": "Skypiea",
  "long-ring-long-land": "Water 7",
  "water-seven": "Water 7",
  "enies-lobby": "Water 7",
  "post-enies-lobby": "Water 7",
  "thriller-bark": "Thriller Bark",
  "sabaody-archipelago": "Summit War",
  "amazon-lily": "Summit War",
  "impel-down": "Summit War",
  "if-you-could-go-anywhere-the-adventures-of-the-straw-hats": "Summit War",
  "marineford": "Summit War",
  "post-war": "Summit War",
  "return-to-sabaody": "Fishman Island",
  "fishman-island": "Fishman Island",
  "punk-hazard": "Dressrosa",
  "dressrosa": "Dressrosa",
  "zou": "Whole Cake Island",
  "whole-cake-island": "Whole Cake Island",
  "reverie": "Whole Cake Island",
  "wano": "Wano",
  "egghead": "Final Saga",
  "one-piece-fan-letter": "Final Saga",
  "warship-island-01-april-fools-2025": "East Blue"
};

const SAGA_GRADIENTS = {
  "East Blue": "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
  "Alabasta": "linear-gradient(135deg, #e65c00 0%, #F9D423 100%)",
  "Skypiea": "linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)",
  "Water 7": "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  "Thriller Bark": "linear-gradient(135deg, #141e30 0%, #243b55 100%)",
  "Summit War": "linear-gradient(135deg, #eb3030 0%, #4c0000 100%)",
  "Fishman Island": "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)",
  "Dressrosa": "linear-gradient(135deg, #ec008c 0%, #fc6767 100%)",
  "Whole Cake Island": "linear-gradient(135deg, #f857a6 0%, #ff5858 100%)",
  "Wano": "linear-gradient(135deg, #8a2387 0%, #e94057 100%)",
  "Final Saga": "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
};

export default function OnePacePage({ progress = {}, onSelectArc }) {
  const [arcs, setArcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSaga, setSelectedSaga] = useState("All");

  useEffect(() => {
    fetchOnePaceCatalog()
      .then(data => {
        setArcs(data.map(a => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          episodeCount: a.episodeCount,
          status: a.status,
          mangaChaptersStart: a.mangaChaptersStart,
          mangaChaptersEnd: a.mangaChaptersEnd,
        })));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sortedArcs = useMemo(() => {
    return arcs.filter(arc => {
      if (selectedSaga === "All") return true;
      return SAGA_MAP[arc.id] === selectedSaga;
    });
  }, [arcs, selectedSaga]);

  const arcStats = useMemo(() => {
    const stats = {};
    for (const arc of arcs) {
      let watchedCount = 0;
      let progressSum = 0;
      const prefix = `onepace.${arc.id}.`;
      const keys = Object.keys(progress).filter(k => k.startsWith(prefix));
      keys.forEach(k => {
        const val = progress[k];
        if (val >= 90) watchedCount++;
        progressSum += val;
      });
      stats[arc.id] = {
        watchedCount,
        percent: arc.episodeCount > 0 ? Math.min(100, Math.round((progressSum / (arc.episodeCount * 100)) * 100)) : 0
      };
    }
    return stats;
  }, [arcs, progress]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", color: "var(--text3)" }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4, marginBottom: 16 }} />
        <span>Loading One Pace catalog…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "var(--red)" }}>
        ⚠ Failed to load One Pace: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "30px 40px", color: "var(--text)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <StrawHatIcon size={36} color="var(--red)" />
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, fontFamily: "var(--font-title, Outfit)" }}>
            One Pace
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)", margin: "4px 0 0 0" }}>
            Manga-accurate recut of the One Piece anime. Cut filler, save time, enjoy the ride.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 16,
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          scrollbarWidth: "none"
        }}
        className="hide-scrollbar"
      >
        {SAGAS.map(saga => {
          const active = selectedSaga === saga;
          return (
            <button
              key={saga}
              onClick={() => setSelectedSaga(saga)}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                border: active ? "1px solid var(--red)" : "1px solid var(--border)",
                background: active ? "rgba(229,9,20,0.15)" : "var(--surface2)",
                color: active ? "var(--red)" : "var(--text2)",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface3)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--surface2)"; }}
            >
              {saga}
            </button>
          );
        })}
      </div>

      {sortedArcs.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text3)" }}>
          No arcs found for the selected Saga.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
          {sortedArcs.map(arc => {
            const saga = SAGA_MAP[arc.id] || "East Blue";
            const gradient = SAGA_GRADIENTS[saga] || SAGA_GRADIENTS["East Blue"];
            const stats = arcStats[arc.id] || { watchedCount: 0, percent: 0 };
            const highestOriginal = getHighestOriginalEpisode(arc.id);

            return (
              <div
                key={arc.id}
                onClick={() => onSelectArc(arc)}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.3)";
                  e.currentTarget.style.borderColor = "var(--red, #e50914)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                <div
                  style={{
                    background: gradient,
                    height: 120,
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative"
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(0,0,0,0.3)", padding: "3px 8px", borderRadius: 10, width: "fit-content" }}>
                    {saga} Saga
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "var(--font-title, Outfit)", textShadow: "0 2px 4px rgba(0,0,0,0.5)", lineHeight: 1.2 }}>
                    {arc.name}
                  </div>
                  <div style={{ position: "absolute", right: 15, bottom: 10, opacity: 0.15, transform: "scale(2)", pointerEvents: "none" }}>
                    <StrawHatIcon size={40} color="#fff" />
                  </div>
                </div>

                <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)" }}>
                        <span>Manga Chapters:</span>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>
                          {arc.mangaChaptersStart && arc.mangaChaptersEnd
                            ? `${arc.mangaChaptersStart} - ${arc.mangaChaptersEnd}`
                            : "N/A"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)" }}>
                        <span>Original Anime:</span>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>
                          {highestOriginal ? `Episodes 1 - ${highestOriginal}` : "N/A"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
                        {arc.episodeCount} episodes
                      </span>
                      {arc.status === "in_progress" ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                          In Progress
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                          Completed
                        </span>
                      )}
                    </div>
                  </div>

                  {stats.percent > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>
                        <span>Progress</span>
                        <span>{stats.percent}% ({stats.watchedCount}/{arc.episodeCount} ep)</span>
                      </div>
                      <div style={{ background: "var(--surface3)", height: 4, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ background: "var(--red, #e50914)", height: "100%", width: `${stats.percent}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

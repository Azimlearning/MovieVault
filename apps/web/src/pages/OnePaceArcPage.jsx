import { useState, useEffect } from "react";
import { BackIcon, PlayIcon, StrawHatIcon } from "../components/Icons";
import { getHighestOriginalEpisode } from "../utils/onepaceMapping";
import { fetchOnePaceCatalog } from "../utils/onepaceApi";

export default function OnePaceArcPage({ arcHeader, progress = {}, onBack, onPlayEpisode }) {
  const [loading, setLoading] = useState(true);
  const [arcData, setArcData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchOnePaceCatalog()
      .then(arcs => {
        if (!mounted) return;
        const arc = arcs.find(a => a.id === arcHeader.id);
        if (!arc) { setError("Arc not found"); return; }
        setArcData(arc);
      })
      .catch(err => { if (mounted) setError(err.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [arcHeader]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", color: "var(--text3)" }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4, marginBottom: 16 }} />
        <span>Loading episodes…</span>
      </div>
    );
  }

  if (error || !arcData) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: 20 }}>
          <BackIcon /> Back to Arcs
        </button>
        <div style={{ color: "var(--red)", fontSize: 16 }}>⚠ {error || "Arc details unavailable"}</div>
      </div>
    );
  }

  const { episodes } = arcData;
  const highestOriginal = getHighestOriginalEpisode(arcData.id);

  return (
    <div style={{ padding: "30px 40px", color: "var(--text)" }}>
      <button
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "var(--text2)", fontSize: 14, cursor: "pointer", padding: "6px 12px 6px 0", marginBottom: 20, transition: "color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--text2)"}
      >
        <BackIcon size={14} /> Back to Arcs
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 40 }} className="onepace-details-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
              aspectRatio: "2/3",
              borderRadius: 12,
              border: "1px solid var(--border)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div style={{ opacity: 0.1, position: "absolute", transform: "scale(3.5)", pointerEvents: "none" }}>
              <StrawHatIcon size={80} color="#fff" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#63cab7", zIndex: 1, marginBottom: 8 }}>
              One Pace Arc
            </span>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "var(--font-title, Outfit)", zIndex: 1, margin: "0 0 16px 0" }}>
              {arcData.name}
            </h2>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", zIndex: 1 }}>
              {episodes.length} Episodes
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px 0", color: "var(--text)" }}>Arc Details</h3>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text3)" }}>Status:</span>
              <span style={{ fontWeight: 600, color: arcData.status === "in_progress" ? "#f59e0b" : "#10b981" }}>
                {arcData.status === "in_progress" ? "In Progress" : "Completed"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text3)" }}>Manga Chapters:</span>
              <span style={{ fontWeight: 600 }}>
                {arcData.mangaChaptersStart && arcData.mangaChaptersEnd
                  ? `${arcData.mangaChaptersStart} - ${arcData.mangaChaptersEnd}`
                  : "N/A"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text3)" }}>Original Anime:</span>
              <span style={{ fontWeight: 600 }}>
                {highestOriginal ? `Episodes 1 - ${highestOriginal}` : "N/A"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text3)" }}>Default Quality:</span>
              <span style={{ fontWeight: 600 }}>{arcData.resolution ? `${arcData.resolution}p` : "1080p"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text3)" }}>Languages:</span>
              <span style={{ fontWeight: 600, color: "var(--text2)", fontSize: 12 }}>
                {arcData.sub && "Subbed"}{arcData.dub && " / Dubbed"}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 20px 0", fontFamily: "var(--font-title, Outfit)" }}>
            Episodes ({episodes.length})
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {episodes.map(ep => {
              const progressKey = `onepace.${arcData.id}.${ep.episodeNumber}`;
              const pct = progress[progressKey] || 0;
              const isWatched = pct >= 90;
              const hasStarted = pct > 0 && !isWatched;

              let formattedDate = "";
              if (ep.releaseDate) {
                try { formattedDate = new Date(ep.releaseDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
                catch { formattedDate = ep.releaseDate; }
              }

              return (
                <div
                  key={ep.episodeNumber}
                  onClick={() => onPlayEpisode(arcData, ep)}
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", display: "flex", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", transition: "border-color 0.2s, background-color 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red, #e50914)"; e.currentTarget.style.backgroundColor = "var(--surface2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.backgroundColor = "var(--surface)"; }}
                >
                  <div style={{ width: 180, background: "rgba(255,255,255,0.02)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: "var(--text3)", opacity: 0.2 }}>
                      #{ep.episodeNumber}
                    </span>
                    <div
                      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                      className="play-overlay"
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}
                    >
                      <div style={{ background: "var(--red)", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(229,9,20,0.4)" }}>
                        <PlayIcon size={20} color="#fff" />
                      </div>
                    </div>

                    {pct > 0 && (
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.1)" }}>
                        <div style={{ background: isWatched ? "#48c774" : "var(--red, #e50914)", height: "100%", width: `${pct}%` }} />
                      </div>
                    )}
                    {hasStarted && (
                      <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: "var(--red)", color: "#fff", padding: "2px 6px", borderRadius: 3 }}>
                        Resume
                      </span>
                    )}
                    {isWatched && (
                      <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: "#48c774", color: "#fff", padding: "2px 6px", borderRadius: 3 }}>
                        Watched
                      </span>
                    )}
                  </div>

                  <div style={{ padding: 18, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                          Episode {ep.episodeNumber}: {ep.title}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>
                        {ep.mangaChapters && <span>📖 Chapters: <strong style={{ color: "var(--text2)" }}>{ep.mangaChapters}</strong></span>}
                        {formattedDate && <span>📅 Released: {formattedDate}</span>}
                        {ep.durationMin && <span>⏱ {ep.durationMin} mins</span>}
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text2)", margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ep.overview}
                      </p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 6px" }}>
                        {Object.keys(ep.resolutions).join(" / ")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

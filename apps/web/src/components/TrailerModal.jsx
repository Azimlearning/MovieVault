import { useEffect, useState } from "react";
import { CloseIcon, ExternalLinkIcon } from "./Icons";
import { storage } from "../utils/storage";

// Kept for SettingsPage (custom-instance field placeholder/default) and for
// users who explicitly prefer an Invidious instance.
export const DEFAULT_INVIDIOUS_BASE = "https://inv.nadeko.net";

export function getInvidiousBase() {
  return (storage.get("invidiousBase") || DEFAULT_INVIDIOUS_BASE).replace(
    /\/$/,
    "",
  );
}

// A browser <iframe> can't inspect cross-origin content, so the Electron
// approach (probe each Invidious instance, detect anti-bot block pages via
// executeJavaScript, fail over) is impossible on web — a "go-away" Forbidden
// page fires onLoad exactly like a working player, so blind failover can't
// tell them apart. YouTube's own privacy-enhanced embed is the one reliably
// embeddable source (same reasoning as ADR-007, which already uses a YouTube
// iframe for HeroBanner trailers). An Invidious instance is only used when
// the user explicitly set a custom one in Settings.
function getTrailerEmbed(trailerKey) {
  const stored = (storage.get("invidiousBase") || "").replace(/\/$/, "");
  const customized = stored && stored !== DEFAULT_INVIDIOUS_BASE;
  if (customized) {
    return {
      embedUrl: `${stored}/embed/${trailerKey}?autoplay=1&listen=0`,
      watchUrl: `${stored}/watch?v=${trailerKey}`,
    };
  }
  return {
    embedUrl: `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`,
    watchUrl: `https://www.youtube.com/watch?v=${trailerKey}`,
  };
}

export default function TrailerModal({ trailerKey, title, onClose }) {
  const [loading, setLoading] = useState(true);
  const { embedUrl, watchUrl } = getTrailerEmbed(trailerKey);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const openInBrowser = () => {
    if (window.electron?.openExternal) {
      window.electron.openExternal(watchUrl);
    } else {
      window.open(watchUrl, "_blank", "noopener");
    }
  };

  return (
    <div className="trailer-overlay" onClick={onClose}>
      <div className="trailer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trailer-modal-header">
          <span className="trailer-modal-title">
            🎬 {title} — Official Trailer
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={openInBrowser}
              title="Open in browser"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                color: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                fontSize: 12,
                padding: "4px 10px",
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <ExternalLinkIcon size={13} />
              Open in Browser
            </button>
            <button
              className="trailer-close-btn"
              onClick={onClose}
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div
          className="trailer-embed-wrap"
          style={{ background: "#000", position: "relative" }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#000",
                color: "rgba(255,255,255,0.6)",
                fontSize: 14,
                textAlign: "center",
                padding: "0 32px",
                gap: 10,
                pointerEvents: "none",
              }}
            >
              <span style={{ opacity: 0.5 }}>⏳</span>
              <span>Loading trailer…</span>
            </div>
          )}

          <iframe
            src={embedUrl}
            onLoad={() => setLoading(false)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

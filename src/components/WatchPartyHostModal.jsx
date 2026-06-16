import { useState } from "react";
import { GUEST_APP_ORIGIN } from "../utils/partyConfig";

export default function WatchPartyHostModal({ session, onEndParty, onClose, onKickGuest }) {
  const [activeTab, setActiveTab] = useState("qr"); // 'qr' | 'link' | 'code'
  const [copied, setCopied] = useState(false);

  if (!session) return null;

  const joinUrl = `${GUEST_APP_ORIGIN}/join/${session.sessionId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999999,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body, sans-serif)",
        color: "var(--text)"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: 520,
          maxWidth: "90vw",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: "var(--font-title, Outfit)" }}>
              Watch Party Active
            </h2>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              Share this party with friends to watch in sync
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text3)",
              fontSize: 20,
              cursor: "pointer"
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Content layout (Tabs + Guests List) */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", borderBottom: "1px solid var(--border)" }}>
          {/* Share panel */}
          <div style={{ padding: 24, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Tabs selector */}
            <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 8, padding: 3, gap: 2 }}>
              {["qr", "link", "code"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    background: activeTab === tab ? "var(--surface3)" : "transparent",
                    border: "none",
                    borderRadius: 6,
                    color: activeTab === tab ? "#fff" : "var(--text3)",
                    padding: "6px 0",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s"
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              {activeTab === "qr" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ background: "#fff", padding: 10, borderRadius: 8, display: "flex" }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}`}
                      alt="Party Join QR"
                      style={{ width: 180, height: 180 }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>Scan QR Code with phone</span>
                </div>
              )}

              {activeTab === "link" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                  <span style={{ fontSize: 12, color: "var(--text3)", alignSelf: "flex-start" }}>Copy Join Link:</span>
                  <input
                    type="text"
                    value={joinUrl}
                    readOnly
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      color: "var(--text2)",
                      fontSize: 13,
                      outline: "none",
                      width: "100%"
                    }}
                  />
                  <button onClick={copyToClipboard} className="btn btn-primary" style={{ width: "100%", padding: 10 }}>
                    {copied ? "✓ Copied!" : "Copy Link"}
                  </button>
                </div>
              )}

              {activeTab === "code" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>Enter this 6-Character code:</span>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 800,
                      color: "var(--red)",
                      letterSpacing: "0.1em",
                      fontFamily: "var(--font-title, Outfit)",
                      background: "var(--surface2)",
                      padding: "10px 24px",
                      borderRadius: 12,
                      border: "1px solid var(--border)"
                    }}
                  >
                    {session.sessionCode}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                    at {GUEST_APP_ORIGIN.replace("https://", "")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Guest List Panel */}
          <div style={{ padding: 24, display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Guests ({session.guests.length})
            </h3>
            
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: 220 }}>
              {session.guests.length === 0 ? (
                <div style={{ color: "var(--text3)", fontSize: 12, fontStyle: "italic", margin: "auto 0" }}>
                  Waiting for guests to connect...
                </div>
              ) : (
                session.guests.map(g => (
                  <div
                    key={g.displayName}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "8px 12px"
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 10 }}>
                      {g.displayName}
                    </span>
                    <button
                      onClick={() => onKickGuest(g.displayName)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text3)",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: 4,
                        borderRadius: 4
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}
                      title="Kick guest"
                    >
                      Kick
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div style={{ padding: 18, background: "var(--surface2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => {
              if (confirm("End watch party? All connected guests will be disconnected.")) {
                onEndParty();
              }
            }}
            className="btn btn-secondary"
            style={{ padding: "8px 16px", color: "var(--red)", border: "1px solid rgba(229,9,20,0.3)" }}
          >
            End Party
          </button>
          
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ width: "auto", padding: "8px 24px" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

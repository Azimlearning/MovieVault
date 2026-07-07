export default function WatchPartyIndicator({ session, onClick }) {
  if (!session) return null;

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "var(--accent, #ff8a3d)",
        border: "none",
        borderRadius: 16,
        padding: "4px 12px",
        color: "#1a0f05",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(255,138,61,0.3)",
        transition: "transform 0.15s, background-color 0.15s",
        outline: "none"
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "scale(1.05)";
        e.currentTarget.style.backgroundColor = "var(--accent2, #ffaa66)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.backgroundColor = "var(--accent, #ff8a3d)";
      }}
    >
      <span style={{ fontSize: 10 }}>●</span>
      <span>Party: {session.guests.length} guest{session.guests.length !== 1 ? "s" : ""}</span>
    </button>
  );
}

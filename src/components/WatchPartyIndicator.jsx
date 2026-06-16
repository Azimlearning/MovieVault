export default function WatchPartyIndicator({ session, onClick }) {
  if (!session) return null;

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "var(--red, #e50914)",
        border: "none",
        borderRadius: 16,
        padding: "4px 12px",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(229,9,20,0.3)",
        transition: "transform 0.15s, background-color 0.15s",
        outline: "none"
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "scale(1.05)";
        e.currentTarget.style.backgroundColor = "var(--red-hover, #b80710)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.backgroundColor = "var(--red, #e50914)";
      }}
    >
      <span style={{ fontSize: 10 }}>●</span>
      <span>Party: {session.guests.length} guest{session.guests.length !== 1 ? "s" : ""}</span>
    </button>
  );
}

import {
  HomeIcon,
  SearchIcon,
  HistoryIcon,
  SettingsIcon,
  DownloadsQueueIcon,
  HelpIcon,
  StrawHatIcon,
} from "./Icons";

export default function Sidebar({
  page,
  onNavigate,
  onSearch,
  activeDownloads,
  onShowShortcuts,
}) {
  return (
    <div className="sidebar">
      {/* ── Header / wordmark ── */}
      <div className="sidebar-header" onClick={() => onNavigate("home")}>
        <div className="sidebar-logo">
          <img src="/movievault-mark.svg" alt="" aria-hidden="true" />
        </div>
        <span className="sidebar-wordmark">MOVIE<span>VAULT</span></span>
      </div>

      {/* ── Primary nav ── */}
      <NavBtn
        active={page === "home"}
        onClick={() => onNavigate("home")}
        icon={<HomeIcon />}
        label="Home"
        shortcut="H"
      />
      <NavBtn
        active={page === "search"}
        onClick={onSearch}
        icon={<SearchIcon />}
        label="Search"
        shortcut="⌘K"
      />
      <NavBtn
        active={page === "history"}
        onClick={() => onNavigate("history")}
        icon={<HistoryIcon />}
        label="Library"
      />
      <NavBtn
        active={page === "downloads"}
        onClick={() => onNavigate("downloads")}
        icon={<DownloadsQueueIcon />}
        label="Downloads"
        badge={activeDownloads > 0 ? activeDownloads : null}
      />
      <NavBtn
        active={page === "onepace" || page === "onepaceArc" || page === "onepacePlayer"}
        onClick={() => onNavigate("onepace")}
        icon={<StrawHatIcon />}
        label="One Pace"
      />

      {/* ── Bottom actions ── */}
      <div className="sidebar-bottom">
        <NavBtn
          onClick={onShowShortcuts}
          icon={<HelpIcon />}
          label="Help"
        />
        <NavBtn
          active={page === "settings"}
          onClick={() => onNavigate("settings")}
          icon={<SettingsIcon />}
          label="Settings"
        />
      </div>

    </div>
  );
}

function NavBtn({ active, onClick, icon, label, badge, shortcut }) {
  return (
    <button
      className={`nav-btn${active ? " active" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="nav-btn-label">{label}</span>
      {shortcut && (
        <span style={{ fontSize: 11, color: "var(--text3)", flexShrink: 0 }}>{shortcut}</span>
      )}
      {badge && <span className="nav-btn-badge">{badge}</span>}
    </button>
  );
}

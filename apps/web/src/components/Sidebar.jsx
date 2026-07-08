import { useState, useRef, useEffect } from "react";
import { imgUrl } from "../utils/api";
import {
  HomeIcon,
  SearchIcon,
  HistoryIcon,
  FilmIcon,
  SettingsIcon,
  DownloadsQueueIcon,
  HelpIcon,
  StrawHatIcon,
} from "./Icons";

export default function Sidebar({
  page,
  onNavigate,
  onSearch,
  savedList,
  activeDownloads,
  onReorderSaved,
  onRemoveSaved,
  canGoBack,
  onBack,
  onShowShortcuts,
}) {
  const [dragOver, setDragOver] = useState(null);
  const dragItem = useRef(null);
  const dragNode = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, []);

  const handleDragStart = (e, index) => {
    dragItem.current = index;
    dragNode.current = e.currentTarget;
    setTimeout(() => {
      if (dragNode.current) dragNode.current.style.opacity = "0.4";
    }, 0);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    if (dragNode.current) dragNode.current.style.opacity = "1";
    dragItem.current = null;
    dragNode.current = null;
    setDragOver(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const fromIndex = dragItem.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
    const newList = [...savedList];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(dropIndex, 0, moved);
    onReorderSaved(newList.map((item) => `${item.media_type}_${item.id}`));
    setDragOver(null);
  };

  return (
    <div className="sidebar">
      {/* ── Header / wordmark ── */}
      <div className="sidebar-header" onClick={() => onNavigate("home")}>
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="22" height="22" rx="6" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="0.5" />
            <circle cx="12" cy="12" r="8.5" fill="#111" stroke="#0c0c0c" strokeWidth="0.6" />
            <g fill="#1a1a1a">
              <circle cx="12" cy="4.8" r="1.4" />
              <circle cx="12" cy="19.2" r="1.4" />
              <circle cx="4.8" cy="12" r="1.4" />
              <circle cx="19.2" cy="12" r="1.4" />
              <circle cx="7.2" cy="7.2" r="1.4" />
              <circle cx="16.8" cy="16.8" r="1.4" />
            </g>
            <circle cx="12" cy="12" r="2.4" fill="#FF8A3D" />
          </svg>
        </div>
        <span className="sidebar-wordmark">MovieVault</span>
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
        onClick={onSearch}
        icon={<SearchIcon />}
        label="Search"
        shortcut="⌘F"
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

      <div className="sidebar-sep" />

      {/* ── Pinned / saved ── */}
      {savedList.length > 0 && (
        <>
          <div className="sidebar-section-label">Pinned</div>
          <div className="sidebar-saved">
            {savedList.map((item, index) => {
              const key = `${item.media_type}_${item.id}`;
              const title = item.title || item.name;
              return (
                <div
                  key={key}
                  className={`saved-row${dragOver === index ? " drag-over" : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragEnter={() => {
                    if (dragItem.current !== index) setDragOver(index);
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() => onNavigate(item.media_type === "tv" ? "tv" : "movie", item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ item, x: e.clientX, y: e.clientY });
                  }}
                  title={title}
                >
                  <div className="saved-row-thumb">
                    {item.poster_path ? (
                      <img src={imgUrl(item.poster_path, "w200")} alt={title} loading="lazy" />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface3)", color: "var(--text3)" }}>
                        <FilmIcon />
                      </div>
                    )}
                  </div>
                  <span className="saved-row-title">{title}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

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

      {contextMenu && (
        <div
          className="sidebar-context-menu"
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="sidebar-context-menu-item"
            onClick={() => {
              onRemoveSaved?.(contextMenu.item);
              setContextMenu(null);
            }}
          >
            Remove
          </div>
        </div>
      )}
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

import { useState, useRef, useEffect } from "react";
import { imgUrl } from "../utils/api";
import {
  AppLogo,
  HomeIcon,
  SearchIcon,
  HistoryIcon,
  FilmIcon,
  SettingsIcon,
  DownloadsQueueIcon,
  QuitIcon,
  BackIcon,
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
  showOnePace,
}) {
  const [dragOver, setDragOver] = useState(null);
  const dragItem = useRef(null);
  const dragNode = useRef(null);

  const [contextMenu, setContextMenu] = useState(null); // { item, x, y }

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, []);

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ item, x: e.clientX, y: e.clientY });
  };

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

  const handleDragEnter = (e, index) => {
    if (dragItem.current === index) return;
    setDragOver(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const fromIndex = dragItem.current;
    if (fromIndex === null || fromIndex === dropIndex) return;

    const newList = [...savedList];
    const [moved] = newList.splice(fromIndex, 1);
    newList.splice(dropIndex, 0, moved);

    const newOrder = newList.map((item) => `${item.media_type}_${item.id}`);
    onReorderSaved(newOrder);
    setDragOver(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div className="sidebar">
      <div
        className="sidebar-header"
        onClick={() => onNavigate("home")}
        title="MovieVault"
      >
        <div className="sidebar-logo">
          <AppLogo />
        </div>
        <div className="sidebar-wordmark">MovieVault</div>
      </div>

      {canGoBack && (
        <button className="nav-btn nav-btn--back" onClick={onBack}>
          <BackIcon />
          <span className="nav-btn-label">Back</span>
        </button>
      )}

      <div className="sidebar-section-label">Navigate</div>
      <NavBtn
        active={page === "home"}
        onClick={() => onNavigate("home")}
        icon={<HomeIcon />}
        label="Home"
      />
      <NavBtn onClick={onSearch} icon={<SearchIcon />} label="Search" shortcut="⌘F" />
      <NavBtn
        active={page === "history"}
        onClick={() => onNavigate("history")}
        icon={<HistoryIcon />}
        label="Library & History"
      />
      <NavBtn
        active={page === "downloads"}
        onClick={() => onNavigate("downloads")}
        icon={<DownloadsQueueIcon />}
        label="Downloads"
        badge={activeDownloads > 0 ? activeDownloads : null}
      />
      {showOnePace !== false && (
        <NavBtn
          active={page === "onepace" || page === "onepace-arc"}
          onClick={() => onNavigate("onepace")}
          icon={<StrawHatIcon />}
          label="One Pace"
        />
      )}

      {savedList.length > 0 && (
        <>
          <div className="sidebar-sep" />
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
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() =>
                    onNavigate(item.media_type === "tv" ? "tv" : "movie", item)
                  }
                  onContextMenu={(e) => handleContextMenu(e, item)}
                >
                  <div className="saved-row-thumb">
                    {item.poster_path ? (
                      <img src={imgUrl(item.poster_path, "w200")} alt={title} />
                    ) : (
                      <div className="no-img">
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

      {contextMenu && (
        <div
          className="sidebar-context-menu"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="sidebar-context-menu-item"
            onClick={() => {
              onRemoveSaved && onRemoveSaved(contextMenu.item);
              setContextMenu(null);
            }}
          >
            Remove
          </div>
        </div>
      )}

      <div className="sidebar-bottom">
        <NavBtn onClick={onShowShortcuts} icon={<HelpIcon />} label="Help & Shortcuts" shortcut="?" />
        <NavBtn
          active={page === "settings"}
          onClick={() => onNavigate("settings")}
          icon={<SettingsIcon />}
          label="Settings"
        />
        <button
          className="nav-btn nav-btn--danger"
          onClick={() => window.electron?.quitApp?.()}
        >
          <QuitIcon />
          <span className="nav-btn-label">Quit App</span>
        </button>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, badge, shortcut }) {
  return (
    <button className={`nav-btn ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span className="nav-btn-label">{label}</span>
      {shortcut && <span className="nav-btn-shortcut">{shortcut}</span>}
      {badge && <span className="nav-btn-badge">{badge}</span>}
    </button>
  );
}

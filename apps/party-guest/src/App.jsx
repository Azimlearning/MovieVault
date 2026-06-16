import React, { useState, useEffect, useRef } from "react";

// Get relay host dynamically — use secure protocols on non-localhost
const isLocal = window.location.hostname === "localhost";
const RELAY_HOST = isLocal ? "localhost:3000" : "movievault-party.up.railway.app";
const HTTP_URL = `${isLocal ? "http" : "https"}://${RELAY_HOST}`;
const WS_URL   = `${isLocal ? "ws"   : "wss"}://${RELAY_HOST}`;

export default function App() {
  const [sessionId, setSessionId] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [displayName, setDisplayName] = useState(() => localStorage.getItem("party_displayName") || "");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  const [ws, setWs] = useState(null);
  const [guests, setGuests] = useState([]);
  const [chat, setChat] = useState([]); // [{ sender, message, self }]
  const [chatInput, setChatInput] = useState("");
  
  // Playback sync state
  const [titleInfo, setTitleInfo] = useState(null); // { type, tmdbId, season, episode, source, embedUrl, fileUrl }
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [iframeUrl, setIframeUrl] = useState("");
  
  // Floating reactions
  const [floatingEmojis, setFloatingEmojis] = useState([]); // [{ id, emoji }]
  const reactionIdRef = useRef(0);

  // Autoplay overlay for mobile policies
  const [needsClick, setNeedsClick] = useState(true);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [reconnectCountdown, setReconnectCountdown] = useState(60);

  const videoRef = useRef(null); // for native onepace playback
  const chatEndRef = useRef(null);

  // Parse session ID from path: /join/{id}
  useEffect(() => {
    const parts = window.location.pathname.split("/");
    const id = parts[2] || urlParam("session");
    if (id) {
      setSessionId(id);
    }
  }, []);

  const urlParam = (name) => {
    const results = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.href);
    return results ? decodeURIComponent(results[1]) : null;
  };

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // Host disconnect countdown
  useEffect(() => {
    let timer;
    if (hostDisconnected) {
      setReconnectCountdown(60);
      timer = setInterval(() => {
        setReconnectCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setJoined(false);
            setError("Host disconnected permanently.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [hostDisconnected]);

  // Join API request
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !sessionCode.trim() || !sessionId.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    localStorage.setItem("party_displayName", displayName.trim());
    setError("");

    try {
      const res = await fetch(`${HTTP_URL}/session/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionCode: sessionCode.trim().toUpperCase(),
          displayName: displayName.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Join failed");
      }

      const { guestToken } = await res.json();
      connectWebSocket(sessionId, guestToken);
    } catch (err) {
      setError(err.message);
    }
  };

  // Connect WS
  const connectWebSocket = (sessId, token) => {
    const socket = new WebSocket(`${WS_URL}/session/${sessId}?token=${token}`);
    
    socket.onopen = () => {
      console.log("WebSocket connected.");
      setWs(socket);
      setJoined(true);
      setHostDisconnected(false);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WS message:", data);

      switch (data.type) {
        case "STATE_SYNC":
          if (data.current) {
            setTitleInfo(data.current.title);
            setIsPlaying(data.current.playing);
            setCurrentTime(data.current.time);
            updatePlayerSource(data.current.title, data.current.time, data.current.playing);
          }
          break;

        case "GUEST_LIST_UPDATE":
          setGuests(data.guests || []);
          break;

        case "HOST_TITLE_CHANGE":
          setTitleInfo(data.title);
          setIsPlaying(false);
          setCurrentTime(0);
          updatePlayerSource(data.title, 0, false);
          break;

        case "HOST_PLAY":
          setIsPlaying(true);
          syncPlayback(data.time, true);
          break;

        case "HOST_PAUSE":
          setIsPlaying(false);
          syncPlayback(data.time, false);
          break;

        case "HOST_SEEK":
          syncPlayback(data.time, isPlaying);
          break;

        case "HOST_HEARTBEAT":
          syncPlayback(data.time, data.playing);
          break;

        case "HOST_DISCONNECTED":
          setHostDisconnected(true);
          break;

        case "KICKED":
          socket.close();
          setJoined(false);
          setError("You were removed from the party by the host.");
          break;

        case "GUEST_CHAT":
          setChat(prev => [...prev, {
            sender: data.displayName,
            message: data.message,
            self: data.displayName === displayName.trim()
          }]);
          break;

        case "GUEST_REACT":
          spawnReaction(data.emoji);
          break;

        default:
          break;
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected.");
      setWs(null);
    };
  };

  // Build/Reload Player Source
  const updatePlayerSource = (title, time, playing) => {
    if (!title) return;
    
    if (title.type === "onepace") {
      setIframeUrl("");
      // Native video element will load title.fileUrl
      setTimeout(() => {
        const video = videoRef.current;
        if (video) {
          video.currentTime = time;
          if (playing && !needsClick) {
            video.play().catch(() => {});
          }
        }
      }, 100);
    } else {
      // Movie or TV show (iframe webview)
      let url = title.embedUrl || "";
      if (url) {
        // Add timestamp parameter
        const sep = url.includes("?") ? "&" : "?";
        url += `${sep}t=${Math.floor(time)}`;
      }
      setIframeUrl(url);
    }
  };

  // Sync playhead drift
  const syncPlayback = (hostTime, hostPlaying) => {
    setIsPlaying(hostPlaying);
    setCurrentTime(hostTime);

    if (titleInfo?.type === "onepace") {
      const video = videoRef.current;
      if (video) {
        const drift = Math.abs(video.currentTime - hostTime);
        if (drift > 3) {
          video.currentTime = hostTime;
        }
        if (hostPlaying && !needsClick) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    } else {
      // Iframe sync (Movie/TV)
      // Since we cannot observe iframe player currentTime directly, we do timestamp updates 
      // when the host triggers significant seeks/play. We reload/seek the URL with the parameter.
      // To avoid constant loop reloading on minor heartbeats, only sync if it was a SEEK or PLAY/PAUSE change
      if (ws) {
        // Build new URL
        let url = titleInfo?.embedUrl || "";
        if (url) {
          const sep = url.includes("?") ? "&" : "?";
          url += `${sep}t=${Math.floor(hostTime)}`;
          setIframeUrl(url);
        }
      }
    }
  };

  // Send Chat
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !ws) return;

    ws.send(JSON.stringify({
      type: "GUEST_CHAT",
      message: chatInput.trim()
    }));
    setChatInput("");
  };

  // Send Reaction
  const sendReaction = (emoji) => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: "GUEST_REACT",
      emoji
    }));
  };

  // Send Hand Raise
  const sendHandRaise = () => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: "GUEST_HAND_RAISE"
    }));
    showLocalToast("Raised Hand! ✋");
  };

  // Local Reaction Animation
  const spawnReaction = (emoji) => {
    const id = reactionIdRef.current++;
    setFloatingEmojis(prev => [...prev, { id, emoji }]);
    
    // Remove after animation finishes
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2200);
  };

  const showLocalToast = (msg) => {
    // Add local fake message in chat or toast
    setChat(prev => [...prev, {
      sender: "System",
      message: msg,
      self: false,
      system: true
    }]);
  };

  const startAutoplayPlayback = () => {
    setNeedsClick(false);
    const video = videoRef.current;
    if (video) {
      video.currentTime = currentTime;
      if (isPlaying) {
        video.play().catch(() => {});
      }
    }
  };

  if (!joined) {
    return (
      <div className="join-container">
        <form className="join-card" onSubmit={handleJoin}>
          <div style={{ color: "var(--red)", fontSize: 40, marginBottom: 14 }}>🍿</div>
          <h1 className="join-title">Join Watch Party</h1>
          <p className="join-subtitle">Enter your name and join the group stream</p>

          {error && (
            <div style={{ color: "var(--red)", fontSize: 13, background: "rgba(229,9,20,0.1)", border: "1px solid rgba(229,9,20,0.2)", padding: 10, borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              type="text"
              placeholder="e.g. Luffy"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Session ID</label>
            <input
              type="text"
              placeholder="UUID from host link"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">6-Char Code</label>
            <input
              type="text"
              placeholder="e.g. A4G9KP"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
              className="form-input"
              maxLength={6}
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            Join Party
          </button>
        </form>
      </div>
    );
  }

  const isOnePace = titleInfo?.type === "onepace";

  return (
    <div className="app-layout">
      {/* Left Column: Player Area */}
      <div className="player-area">
        {/* Host Disconnected Overlay */}
        {hostDisconnected && (
          <div className="connection-overlay">
            <div style={{ fontSize: 40 }}>📡</div>
            <h2 style={{ margin: 0 }}>Host Disconnected</h2>
            <p style={{ margin: 0, color: "var(--text3)", fontSize: 14 }}>
              Waiting for host to reconnect... Disconnecting in {reconnectCountdown}s
            </p>
          </div>
        )}

        {/* Click to start autoplay overlay */}
        {needsClick && isOnePace && (
          <div className="autoplay-overlay">
            <div style={{ fontSize: 32 }}>🔊</div>
            <h2 style={{ margin: 0 }}>Watch Party Synced</h2>
            <p style={{ margin: 0, color: "var(--text3)", fontSize: 13 }}>
              Browser policy requires user interaction before autoplaying video with sound.
            </p>
            <button onClick={startAutoplayPlayback} className="btn-primary" style={{ width: "auto", padding: "10px 24px" }}>
              Start Sync Playback
            </button>
          </div>
        )}

        {/* Render video based on type */}
        {isOnePace ? (
          <video
            ref={videoRef}
            src={titleInfo.fileUrl}
            className="party-video"
            controls
            style={{ width: "100%", height: "100%" }}
          />
        ) : iframeUrl ? (
          <iframe
            src={iframeUrl}
            className="party-video"
            allowFullScreen
            allow="autoplay; encrypted-media"
          />
        ) : (
          <div style={{ color: "var(--text3)", fontSize: 14 }}>
            Waiting for host to select a title...
          </div>
        )}

        {/* Floating Emojis Track */}
        <div className="emoji-floating-track">
          {floatingEmojis.map((e) => (
            <div key={e.id} className="floating-emoji">
              {e.emoji}
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Chat/Sidebar */}
      <div className="sidebar-panel">
        <div className="sidebar-header">
          <div>
            <h2 className="sidebar-title">
              {titleInfo ? (isOnePace ? `${titleInfo.arcName} - One Pace` : titleInfo.title) : "Waiting..."}
            </h2>
            <p className="sidebar-subtitle">
              {titleInfo?.type === "tv" && `S${titleInfo.season}E${titleInfo.episode} · `}
              {guests.length} guest{guests.length !== 1 && "s"} watching
            </p>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="chat-container">
          {chat.map((c, i) => {
            if (c.system) {
              return (
                <div key={i} style={{ textAlign: "center", fontSize: 11, color: "#f59e0b", padding: "4px 0" }}>
                  {c.message}
                </div>
              );
            }
            return (
              <div key={i} className={`chat-bubble ${c.self ? "self" : ""}`}>
                {!c.self && <span className="chat-sender">{c.sender}</span>}
                <div className="chat-text">{c.message}</div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Footer & input */}
        <div className="chat-footer">
          {/* Reaction presets */}
          <div className="reactions-row">
            {["❤️", "😂", "😱", "🔥", "🤯", "👏"].map(emoji => (
              <button key={emoji} onClick={() => sendReaction(emoji)} className="react-btn">
                {emoji}
              </button>
            ))}
            <button onClick={sendHandRaise} className="hand-btn" title="Raise Hand">
              ✋
            </button>
          </div>

          <form onSubmit={sendChat} className="chat-input-row">
            <input
              type="text"
              placeholder="Send message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="chat-input"
              maxLength={200}
            />
            <button type="submit" className="chat-send-btn">
              ➔
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

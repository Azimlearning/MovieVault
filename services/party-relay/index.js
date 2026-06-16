const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const SESSION_TTL = (parseInt(process.env.SESSION_TTL_HOURS, 10) || 6) * 60 * 60 * 1000;
const MAX_GUESTS = parseInt(process.env.MAX_GUESTS_PER_SESSION, 10) || 20;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : null; // null = allow all (dev mode)

// Sessions database in memory
// Map of sessionId -> { sessionId, sessionCode, hostToken, title, time, playing, hostSocket, guests: Map }
const sessions = new Map();

// Helper to generate secure random strings
function generateToken() {
  return crypto.randomBytes(16).toString("hex");
}

// Helper to generate 6-character session codes excluding ambiguous letters
function generateSessionCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/l
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Clean up expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL) {
      console.log(`[relay] Session ${id} expired.`);
      // Close all sockets
      if (session.hostSocket) session.hostSocket.close();
      for (const guest of session.guests.values()) {
        guest.socket.close();
      }
      sessions.delete(id);
    }
  }
}, 60000); // Check every minute

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  const allowed = !ALLOWED_ORIGINS || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*");
  res.setHeader("Access-Control-Allow-Origin", allowed ? origin || "*" : "null");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

const server = http.createServer((req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlParts = req.url.split("/");
  
  // POST /session -> Create a session
  if (req.method === "POST" && req.url === "/session") {
    const sessionId = crypto.randomUUID();
    const sessionCode = generateSessionCode();
    const hostToken = generateToken();

    sessions.set(sessionId, {
      sessionId,
      sessionCode,
      hostToken,
      title: null,
      time: 0,
      playing: false,
      hostSocket: null,
      guests: new Map(), // guestToken -> { displayName, socket }
      createdAt: Date.now()
    });

    console.log(`[relay] Created session: ${sessionCode} (${sessionId})`);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ sessionId, sessionCode, hostToken }));
    return;
  }

  // POST /session/:sessionId/join -> Join a session
  if (req.method === "POST" && urlParts[1] === "session" && urlParts[3] === "join") {
    const sessionId = urlParts[2];
    const session = sessions.get(sessionId);

    if (!session) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found or expired" }));
      return;
    }

    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const { sessionCode, displayName } = JSON.parse(body);

        if (session.sessionCode !== sessionCode) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid session code" }));
          return;
        }

        if (session.guests.size >= MAX_GUESTS) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Watch party is full (max 20 guests)" }));
          return;
        }

        const guestToken = generateToken();
        session.guests.set(guestToken, {
          displayName,
          socket: null
        });

        console.log(`[relay] Guest '${displayName}' pre-joined session ${session.sessionCode}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ guestToken }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
    return;
  }

  // Fallback 404
  res.writeHead(404);
  res.end();
});

// Configure WebSockets
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const urlParts = url.pathname.split("/");
  const sessionId = urlParts[2];
  const token = url.searchParams.get("token");

  const session = sessions.get(sessionId);
  if (!session || !token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const isHost = session.hostToken === token;
  const isGuest = session.guests.has(token);

  if (!isHost && !isGuest) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, session, token, isHost);
  });
});

wss.on("connection", (ws, request, session, token, isHost) => {
  if (isHost) {
    session.hostSocket = ws;
    console.log(`[relay] Host connected to session ${session.sessionCode}`);
  } else {
    const guest = session.guests.get(token);
    guest.socket = ws;
    console.log(`[relay] Guest '${guest.displayName}' socket established for session ${session.sessionCode}`);

    // Notify newly connected guest of current playback state
    ws.send(JSON.stringify({
      type: "STATE_SYNC",
      current: {
        title: session.title,
        time: session.time,
        playing: session.playing
      },
      guests: Array.from(session.guests.values()).filter(g => g.socket).map(g => ({ displayName: g.displayName }))
    }));

    // Broadcast updated guest list to host and all guests
    broadcast(session, {
      type: "GUEST_LIST_UPDATE",
      guests: Array.from(session.guests.values()).filter(g => g.socket).map(g => ({ displayName: g.displayName }))
    });
  }

  ws.on("message", (messageData) => {
    try {
      const msg = JSON.parse(messageData);
      
      if (isHost) {
        // Host controls sync playback
        if (msg.type === "HOST_PLAY" || msg.type === "HOST_PAUSE" || msg.type === "HOST_SEEK" || msg.type === "HOST_HEARTBEAT") {
          session.time = msg.time;
          session.playing = msg.type === "HOST_PLAY" || (msg.type === "HOST_HEARTBEAT" && msg.playing);
          broadcastGuests(session, msg);
        } else if (msg.type === "HOST_TITLE_CHANGE") {
          session.title = msg.title;
          session.time = 0;
          session.playing = false;
          broadcastGuests(session, msg);
        } else if (msg.type === "HOST_KICK") {
          // Find guest by displayName
          for (const [gToken, guest] of session.guests.entries()) {
            if (guest.displayName === msg.displayName) {
              if (guest.socket) {
                guest.socket.send(JSON.stringify({ type: "KICKED" }));
                guest.socket.close();
              }
              session.guests.delete(gToken);
              break;
            }
          }
          broadcast(session, {
            type: "GUEST_LIST_UPDATE",
            guests: Array.from(session.guests.values()).filter(g => g.socket).map(g => ({ displayName: g.displayName }))
          });
        }
      } else {
        // Guest actions (chat, react, hand raise)
        const guest = session.guests.get(token);
        if (!guest) return;

        if (msg.type === "GUEST_CHAT" || msg.type === "GUEST_REACT" || msg.type === "GUEST_HAND_RAISE") {
          msg.displayName = guest.displayName;
          broadcast(session, msg);
        }
      }
    } catch (e) {
      console.error("[relay] WS message error:", e);
    }
  });

  ws.on("close", () => {
    if (isHost) {
      console.log(`[relay] Host disconnected from session ${session.sessionCode}`);
      session.hostSocket = null;
      // Notify guests
      broadcastGuests(session, { type: "HOST_DISCONNECTED" });
    } else {
      const guest = session.guests.get(token);
      if (guest) {
        console.log(`[relay] Guest '${guest.displayName}' disconnected`);
        session.guests.delete(token);
        broadcast(session, {
          type: "GUEST_LIST_UPDATE",
          guests: Array.from(session.guests.values()).filter(g => g.socket).map(g => ({ displayName: g.displayName }))
        });
      }
    }
  });
});

// Broadcast to everyone (host and guests)
function broadcast(session, data) {
  const payload = JSON.stringify(data);
  if (session.hostSocket && session.hostSocket.readyState === 1) {
    session.hostSocket.send(payload);
  }
  for (const guest of session.guests.values()) {
    if (guest.socket && guest.socket.readyState === 1) {
      guest.socket.send(payload);
    }
  }
}

// Broadcast to guests only
function broadcastGuests(session, data) {
  const payload = JSON.stringify(data);
  for (const guest of session.guests.values()) {
    if (guest.socket && guest.socket.readyState === 1) {
      guest.socket.send(payload);
    }
  }
}

server.listen(PORT, () => {
  console.log(`[relay] WebSocket server listening on port ${PORT}`);
});

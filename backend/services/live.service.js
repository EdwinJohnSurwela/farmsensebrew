/**
 * FarmSense Brew — Live push (server-sent events)
 * File: backend/services/live.service.js
 *
 * Every open dashboard keeps one GET /api/live connection. The Pi pushes:
 *   node_live    a node's newest values (every 2 s per node, values included)
 *   node_status  a node went online or offline
 *   reading      a reading was saved to history (screens re-fetch)
 *   alert, device
 * The open connection also shows that the signed-in device is still in use,
 * and it is closed once that session has ended (signed out or replaced).
 */
const sessions = require("./session.service");

const clients = new Set();
const PING_MS = 25000; // keeps idle connections from being dropped

function subscribe(req, res) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 5000\n\n"); // browser reconnects after 5 s if the Pi restarts
  const client = { res };
  clients.add(client);
  const user = req.user;
  const ping = setInterval(async () => {
    res.write(": ping\n\n");
    if (!user) return;
    try {
      if ((user.sv ?? 0) !== await sessions.currentVersion(user.id)) {
        res.end(); // session ended; the browser's next request shows "signed out"
        return;
      }
      sessions.touch(user.id);
    } catch { /* database busy: try again next ping */ }
  }, PING_MS);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(client);
  });
}

/** Push an event to every open dashboard. */
function broadcast(event, data = {}) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    try {
      c.res.write(msg);
    } catch {
      clients.delete(c);
    }
  }
}

module.exports = { subscribe, broadcast, clientCount: () => clients.size };

/**
 * FarmSense Brew — Backend API Server
 * File: backend/server.js
 *
 * Express.js REST API that serves the Grafana dashboard and
 * handles authentication, sensor data queries, and alert management.
 *
 * TEAM INSTRUCTIONS:
 * - Run: npm install, then node server.js (or npm run dev with nodemon)
 * - Copy .env.example to .env and fill in your actual credentials
 * - This runs on the Raspberry Pi or a separate server
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const authRoutes = require("./routes/auth.routes");
const sensorRoutes = require("./routes/sensor.routes");
const alertRoutes = require("./routes/alert.routes");
const recommendRoutes = require("./routes/recommendation.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const calibrationRoutes = require("./routes/calibration.routes");
const irrigationRoutes = require("./routes/irrigation.routes");
const adminRoutes = require("./routes/admin.routes");
const mlRoutes = require("./routes/ml.routes");
const schedulerService = require("./services/scheduler.service");
const { authenticateToken } = require("./middleware/auth.middleware");
const {
  requireGrafanaAuth,
  verifyGrafanaUserFromUpgradeReq,
  toSafeGrafanaBrowserPath
} = require("./middleware/grafana-auth.middleware");
const { browserPolicy } = require("./middleware/browser-policy.middleware");
const { grafanaLegacy } = require("./middleware/grafana-legacy.middleware");

const app = express();
const PORT = process.env.PORT || 3001;
const GRAFANA_TARGET = process.env.GRAFANA_INTERNAL_URL || "http://127.0.0.1:3000";

// --- MIDDLEWARE ---------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: false, // set per path below (Grafana needs its own)
  xFrameOptions: { action: "sameorigin" }, // only our own pages may frame the app (clickjacking)
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  // OpenStreetMap blocks map tiles requested without a Referer (403 "Access
  // blocked"); helmet's default no-referrer stripped it. This sends only the
  // site origin to other sites, the browser's own default.
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({
  // Same-origin only unless CORS_ORIGIN lists other sites (comma separated).
  // The web app is served by this server and the ESP32 boxes are not
  // browsers, so neither needs CORS; reflecting every origin was unnecessary.
  origin: corsOrigin ? corsOrigin.split(",").map((s) => s.trim()) : false,
  credentials: true
}));
// Live samples arrive every 2 s per box: log only the failed ones.
morgan.token("safe-url", (req) => (req.originalUrl || req.url).replace(/([?&]token=)[^&]*/gi, "$1[hidden]"));
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
  { skip: (req, res) => req.path === "/api/sensors/live" && res.statusCode < 400 }));
// Content-Security-Policy for the web app and API (not /grafana): scripts only
// from this server, no plugins, no framing by other sites.
const appCsp = helmet.contentSecurityPolicy({
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    mediaSrc: ["'self'", "blob:"],
    frameSrc: ["'self'"],
    frameAncestors: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
});
app.use((req, res, next) => (req.path.startsWith("/grafana") ? next() : appCsp(req, res, next)));
// Old browsers and operating systems are turned away before anything else
app.use(browserPolicy);
app.use(cookieParser());

// --- GRAFANA (auth proxy - single sign-on) -----------------------------------
// MOUNTED BEFORE express.json(): the body parser consumes the request
// stream, so if it ran first, proxied POSTs (Grafana panel data queries)
// would never reach Grafana and every panel would load forever.
const grafanaProxy = createProxyMiddleware({
  target: GRAFANA_TARGET,
  changeOrigin: true,
  ws: true,
  autoRewrite: true,
  // Express strips the /grafana mount prefix, but Grafana runs with
  // serve_from_sub_path=true and expects it — re-add it or Grafana
  // 301-redirects "/" back to "/grafana/" forever.
  pathRewrite: (path) => "/grafana" + path,
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.grafanaUser && req.grafanaUser.username) {
        proxyReq.setHeader("X-WEBAUTH-USER", req.grafanaUser.username);
      }
      // Strip the 'token' query param before forwarding - it's only for Express auth
      const url = new URL(proxyReq.path, "http://localhost");
      if (url.searchParams.has("token")) {
        url.searchParams.delete("token");
        proxyReq.path = url.pathname + (url.search || "");
      }
    },
    proxyRes: (proxyRes) => {
      // Force Grafana to be embeddable even if grafana.ini isn't fully configured
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['content-security-policy'];
    },
    error: (err, req, res) => {
      console.error("[Grafana Proxy] Connection error:", err.message);
      // WebSocket upgrade errors pass a raw socket here, not an Express
      // response — calling res.status() on it crashes the whole server.
      if (!res || typeof res.status !== "function") {
        try { res?.destroy?.(); } catch { /* already gone */ }
        return;
      }
      if (res.headersSent) return;
      res.status(502).json({
        error: "Grafana unavailable",
        message: "The Grafana dashboard server is not responding. Make sure Grafana is running.",
        target: GRAFANA_TARGET
      });
    }
  }
});

// Role → dashboard access map. Users can only open their own role's
// dashboard even if they escape kiosk mode (ESC) and browse Grafana.
const ROLE_DASHBOARD_ACCESS = {
  agronomist: ["farmsense-agro-001"],
  farm_owner: ["farmsense-owner-001"],
  field_staff: ["farmsense-staff-001"],
  admin: ["farmsense-agro-001", "farmsense-owner-001", "farmsense-staff-001", "farmsense-scaleup-001"],
};

function enforceGrafanaRole(req, res, next) {
  // Matches dashboard page loads (/d/<uid>/...) and dashboard API fetches
  const m = req.path.match(/^\/(?:d|api\/dashboards\/uid)\/([^/?]+)/);
  if (!m) return next();
  const uid = m[1];
  const role = req.grafanaUser && req.grafanaUser.role;
  const allowed = ROLE_DASHBOARD_ACCESS[role] || [];
  if (allowed.includes(uid)) return next();
  console.warn(`[Grafana] ${req.grafanaUser?.username} (${role}) blocked from dashboard ${uid}`);
  if (req.path.startsWith("/api/")) {
    return res.status(403).json({ message: "This dashboard belongs to a different role" });
  }
  // Browsers get bounced back to their own dashboard
  return res.redirect(302, `/grafana/d/${allowed[0] || ""}/?kiosk`);
}

// The web app's Analytics page asks Grafana for refresh=5s (the 27 Oct build,
// also cached on phones). Dashboards refresh every 2 s, like the Overview.
app.use("/grafana/d/", (req, res, next) => {
  if (req.method === "GET" && req.query.refresh === "5s") {
    return res.redirect(302, req.originalUrl.replace(/([?&])refresh=5s/, "$1refresh=2s"));
  }
  next();
});
app.use("/grafana", requireGrafanaAuth, enforceGrafanaRole, grafanaLegacy(GRAFANA_TARGET), grafanaProxy);

// Grafana sometimes redirects to /login at the site root — always send
// the browser to the web app portal, never the legacy landing page.
app.get("/login", (req, res) => res.redirect(302, "/app/"));

app.use(express.json());

// --- HEALTH CHECK (no auth required) -----------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "FarmSense Brew API", timestamp: new Date() });
});

// --- DEVICE ENDPOINTS (no JWT - ESP32 nodes can't carry tokens) --------------
// Inline handler for ESP32 sensor data POST (bypasses router to avoid auth)
const sensorService = require("./services/sensor.service");
const devices = require("./services/device.service");
app.use("/api/devices", require("./routes/device.routes"));   // boxes sign on here

const presence = require("./services/presence.service");

// Which node a sensor box posts for. Registered boxes: the Pi decides from the
// box's hardware ID, and the key proves the data really comes from that box.
// Returns { nodeId } or { status, body } to send back.
const FIRMWARE_DIR = process.env.FIRMWARE_DIR || path.join(__dirname, "data", "firmware");
async function resolveNode(req) {
  const { node_id, device_id } = req.body;
  if (device_id) {
    const dev = await devices.authenticate(device_id, req.get("X-Device-Token"));
    if (!dev) {
      return { status: 401, body: { code: "DEVICE_KEY", error: "Unknown sensor box or wrong key. The box signs on again by itself." } };
    }
    if (dev.kind !== "node" || !dev.node_id) {
      return { status: 409, body: { code: "NO_NODE", error: "This box has no node number. Check Admin, Sensor Boxes." } };
    }
    devices.touch(dev.device_id, req.ip);
    // One-time "check for firmware now": a file named after the box in
    // data/firmware/check-now/ makes the Pi ask it to sign on again (409),
    // and a box that signs on checks for new firmware at once instead of
    // waiting up to 6 hours. The file is used up by that one answer.
    const flag = path.join(FIRMWARE_DIR, "check-now", dev.device_id);
    if (fs.existsSync(flag)) {
      try { fs.unlinkSync(flag); } catch (_) { /* already gone */ }
      console.log(`[Devices] asked ${dev.device_id} (${dev.node_id}) to sign on again and check for firmware`);
      return { status: 409, body: { code: "CHECK_FIRMWARE", error: "Sign on again and check for new firmware." } };
    }
    return { nodeId: dev.node_id };
  }
  // Older sketch without registration: only accepted until the first box registers,
  // otherwise anyone on the WiFi could post readings for any node.
  if (await devices.hasRegistered("node")) {
    return { status: 401, body: { code: "REGISTRATION_REQUIRED", error: "This Pi only accepts registered sensor boxes. Upload the latest esp32_field_node sketch." } };
  }
  if (node_id == null) return { status: 400, body: { error: "Missing node_id" } };
  // ESP32 sends node_id as a number (1). Normalize to the canonical
  // "NODE_01" format so live readings merge with the seeded node rows.
  const nodeNum = parseInt(String(node_id).replace(/\D/g, ""), 10);
  return { nodeId: nodeNum ? `NODE_${String(nodeNum).padStart(2, "0")}` : String(node_id) };
}

// Calibration for the new capacitive v2.0 probe (bench-tested 2026-07-13):
// open air (bone dry) ≈ 3000 raw; wet ≈ 1200 (PROVISIONAL — confirm with a
// stable fully-submerged reading).
// Validity floor (12 Oct 2026): in about 65,000 farm readings since 27 Sept the
// wettest real value was about 1,050, so a raw value at or below 700 cannot come
// from a working probe in soil. It means no signal reaches GPIO 34 (unpowered,
// unplugged or faulty probe; the floating pin drifts around 100 to 300). Such a
// value is a soil-sensor fault ("no value"), never 100 % wet.
const SOIL_RAW_AIR = 3000, SOIL_RAW_WATER = 1200, SOIL_RAW_FAULT_FLOOR = 700;
// Per-probe calibration (30 Oct 2026): each node's dry (in air) and wet (in water) raw
// values from calibration_params; nodes without a valid row keep the defaults above.
const soilCal = {};
async function loadSoilCal() {
  try {
    const [rows] = await require("./services/db.service").query("SELECT node_id, dry_raw, wet_raw FROM calibration_params");
    for (const k of Object.keys(soilCal)) delete soilCal[k];
    for (const r of rows) {
      const dry = Number(r.dry_raw), wet = Number(r.wet_raw);
      if (Number.isFinite(dry) && Number.isFinite(wet) && dry - wet >= 300) soilCal[r.node_id] = { dry, wet };
    }
  } catch (e) { console.error("[soil-cal] load failed:", e.message); }
}
loadSoilCal();
setInterval(loadSoilCal, 60000);
function soilPercent(soilRaw, nodeId) {
  const c = soilCal[nodeId] || { dry: SOIL_RAW_AIR, wet: SOIL_RAW_WATER };
  return soilRaw <= SOIL_RAW_FAULT_FLOOR
    ? 0
    : Math.round(Math.max(0, Math.min(100, ((c.dry - soilRaw) / (c.dry - c.wet)) * 100)));
}

const isNum = (v) => v !== null && v !== "" && Number.isFinite(Number(v));
// Outside what the air sensors can measure (SHT31/DHT22: -40 to 80 °C,
// 0 to 100 %RH) is a bad read or a forged value: stored as "no value".
const plausibleT = (v) => isNum(v) && Number(v) >= -40 && Number(v) <= 80;
const plausibleH = (v) => isNum(v) && Number(v) >= 0 && Number(v) <= 100;
const plausibleRaw = (v) => isNum(v) && Number(v) >= 0 && Number(v) <= 4095;

// Older firmware: one reading every 5 minutes, saved straight to history.
app.post("/api/sensors/reading", async (req, res) => {
  try {
    const { temperature, humidity, soil_moisture } = req.body;
    if (temperature == null || humidity == null || soil_moisture == null) {
      return res.status(400).json({ error: "Missing required fields: temperature, humidity, soil_moisture" });
    }
    if (!plausibleT(temperature) || !plausibleH(humidity) || !plausibleRaw(soil_moisture)) {
      return res.status(400).json({ error: "Reading outside the sensor range" });
    }
    const who = await resolveNode(req);
    if (!who.nodeId) return res.status(who.status).json(who.body);
    const nodeId = who.nodeId;
    const soilRaw = Number(soil_moisture);
    const soilPct = soilPercent(soilRaw, nodeId);
    presence.seen(nodeId, null, null, null, { legacy: true });
    await sensorService.insertReading(nodeId, temperature, humidity, soilPct, soilRaw);
    console.log(`[ESP32] ${nodeId}: temp=${temperature}, hum=${humidity}, soil=${soilPct}% (raw=${soilRaw})`);
    res.json({ success: true, node_id: nodeId, soil_pct: soilPct });
  } catch (err) {
    console.error("[Sensor POST] Error:", err.message);
    res.status(500).json({ error: "Failed to save reading" });
  }
});

// Live firmware: a sample every 2 s. It is also the box's heartbeat, so it is
// accepted even when the DHT22 failed this time (temperature/humidity null).
app.post("/api/sensors/live", async (req, res) => {
  try {
    const who = await resolveNode(req);
    if (!who.nodeId) return res.status(who.status).json(who.body);
    const { temperature, humidity, soil_moisture } = req.body;
    const t = plausibleT(temperature) ? Number(temperature) : null;
    const h = plausibleH(humidity) ? Number(humidity) : null;
    const soilRaw = plausibleRaw(soil_moisture) ? Number(soil_moisture) : null;
    // Raw at or below the fault floor = probe dead or unwired: no value, not 0 %.
    const soilOk = soilRaw != null && soilRaw > SOIL_RAW_FAULT_FLOOR;
    const { saved, values: v } = await sensorService.receiveSample(
      who.nodeId, t, h, soilOk ? soilPercent(soilRaw, who.nodeId) : null, soilOk ? soilRaw : null);
    if (saved) console.log(`[ESP32] ${who.nodeId}: saved temp=${v.temperature}, hum=${v.humidity}, soil=${v.soil_pct}% (raw=${v.soil_raw})`);
    res.json({ ok: true, node_id: who.nodeId });
  } catch (err) {
    console.error("[Sensor live] Error:", err.message);
    res.status(500).json({ error: "Failed to take the sample" });
  }
});
// --- LIVE PUSH (server-sent events): dashboards refresh the moment a reading lands.
// Signed-in users only; the browser sends the sign-in cookie with the request.
app.get("/api/live", authenticateToken, require("./services/live.service").subscribe);
// Valve box polling: needs the valve box's key once a valve box has registered.
app.get("/api/irrigation/relay/:nodeId", async (req, res) => {
  try {
    const devId = req.get("X-Device-Id");
    if (devId) {
      const dev = await devices.authenticate(devId, req.get("X-Device-Token"));
      if (!dev || dev.kind !== "valve") {
        return res.status(401).json({ code: "DEVICE_KEY", error: "Unknown valve box or wrong key" });
      }
      devices.touch(dev.device_id, req.ip);
    } else if (await devices.hasRegistered("valve")) {
      return res.status(401).json({ code: "REGISTRATION_REQUIRED", error: "Only the registered valve box may poll" });
    }
    const relay = require("./services/relay.service");
    relay.noteValvePoll();
    res.json({ state: relay.getState(parseInt(req.params.nodeId, 10)) || false });
  } catch (err) {
    res.status(500).json({ error: "Relay state unavailable" });   // valve box closes valves after 60 s
  }
});
// Everything else about irrigation (switching valves, schedules, rules) needs a signed-in user.
app.use("/api/irrigation", authenticateToken, irrigationRoutes);

// --- ROUTES (JWT-protected - Flutter app / web dashboard) --------------------
app.use("/api/auth", authRoutes);
app.use("/api/sensors", authenticateToken, sensorRoutes);
app.use("/api/alerts", authenticateToken, alertRoutes);
app.use("/api/recommendations", authenticateToken, recommendRoutes);
app.use("/api/dashboard", authenticateToken, dashboardRoutes);
app.use("/api/calibration", authenticateToken, calibrationRoutes);
app.use("/api/admin", authenticateToken, adminRoutes);
app.use("/api/ml", authenticateToken, mlRoutes);
app.use("/api/export", require("./routes/export.routes")); // auth inside (accepts ?token= for downloads)

// Keep old bookmarks working after retiring the legacy pages.
app.get(["/dashboard", "/dashboard.html", "/index.html"], (req, res) => res.redirect(302, "/app/"));

// The bare address (http://jpcf.local, http://192.168.1.151:3001) opens the web app.
app.get("/", (req, res) => res.redirect(302, "/app/"));

// --- SERVE FRONTEND (Tier 1 - Presentation Layer) ----------------------------
const builtAssets = path.join(__dirname, "..", "frontend", "app", "assets");
// Precompressed build files only; API responses and event streams are unaffected.
app.use("/app/assets", (req, res, next) => {
  res.vary("Accept-Encoding");
  if (!["GET", "HEAD"].includes(req.method) || !/^\/[\w.-]+\.(js|css)$/.test(req.path) || !req.acceptsEncodings("gzip")) return next();
  const file = path.join(builtAssets, path.basename(req.path) + ".gz");
  if (!fs.existsSync(file)) return next();
  res.type(req.path.endsWith(".js") ? "application/javascript" : "text/css");
  res.set("Content-Encoding", "gzip");
  res.sendFile(file, { maxAge: "1y", immutable: true }, (err) => { if (err) next(err); });
});
app.use("/app/assets", express.static(builtAssets, { maxAge: "1y", immutable: true }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

// --- 404 HANDLER -------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// --- GLOBAL ERROR HANDLER ----------------------------------------------------
app.use((err, req, res, next) => {
  const status = Number(err.status || err.statusCode);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: status === 413 ? "Request too large" : "Bad request" });
  }
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// --- START SERVER ------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`FarmSense Brew API running on port ${PORT}`);
  console.log(`Grafana reverse proxy: /grafana -> ${GRAFANA_TARGET}`);
  // Start the irrigation scheduler in background
  schedulerService.start().catch(err => console.warn('[Scheduler] startup failed:', err.message));
  // Automatic watering: the system's own logic, one decision per valve.
  require("./services/auto-irrigation.service").start();
  // Alerts: close calm MODERATE alerts, remind about HIGH alerts with no action.
  require("./services/alert.service").start();
  require("./services/sensor-fault.service").start();
  // Live values for Grafana, the same ones the web app shows (node_live).
  require("./services/live-table.service").start();

  // Offline buffer flusher (FB-55): replay SQLite-buffered readings into
  // MySQL every 15s once it's reachable again; prune rows older than 24h.
  const offlineBuffer = require("./services/offline-buffer.service");
  const db = require("./services/db.service");
  setInterval(async () => {
    try {
      if (offlineBuffer.pendingCount() === 0) return;
      const flushed = await offlineBuffer.flush(async (row) => {
        await db.query(
          `INSERT INTO sensor_readings (node_id, temperature, humidity, soil_pct, clr_risk, confidence_pct, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [row.node_id, row.temperature, row.humidity, row.soil_pct,
           row.clr_risk, row.confidence_pct, row.recorded_at]
        );
      });
      if (flushed > 0) {
        console.log(`[OfflineBuffer] Replayed ${flushed} buffered reading(s) into MySQL (${offlineBuffer.pendingCount()} left)`);
      }
      offlineBuffer.prune();
    } catch (err) {
      console.warn("[OfflineBuffer] flush cycle failed:", err.message);
    }
  }, 15000);
});

server.on("upgrade", (req, socket, head) => {
  if (!req.url || !req.url.startsWith("/grafana")) {
    socket.destroy();
    return;
  }
  const user = verifyGrafanaUserFromUpgradeReq(req);
  if (!user) {
    socket.destroy();
    return;
  }
  req.headers["x-webauth-user"] = user.username;
  // Grafana serves from the /grafana sub-path — keep the prefix as-is
  grafanaProxy.upgrade(req, socket, head);
});

module.exports = app;

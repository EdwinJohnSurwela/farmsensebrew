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

const path       = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const cookieParser = require("cookie-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");

const authRoutes       = require("./routes/auth.routes");
const sensorRoutes     = require("./routes/sensor.routes");
const alertRoutes      = require("./routes/alert.routes");
const recommendRoutes  = require("./routes/recommendation.routes");
const dashboardRoutes  = require("./routes/dashboard.routes");
const { authenticateToken } = require("./middleware/auth.middleware");
const {
  requireGrafanaAuth,
  verifyGrafanaUserFromUpgradeReq,
  toSafeGrafanaBrowserPath
} = require("./middleware/grafana-auth.middleware");

const app  = express();
const PORT = process.env.PORT || 3001;
const GRAFANA_TARGET = process.env.GRAFANA_INTERNAL_URL || "http://127.0.0.1:3000";

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false  // Allow inline scripts/styles for the frontend
}));
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({
  origin: corsOrigin === "*" || !corsOrigin ? true : corsOrigin,
  credentials: true
}));
app.use(morgan("combined"));
app.use(express.json());
app.use(cookieParser());

// ─── HEALTH CHECK (no auth required) ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "FarmSense Brew API", timestamp: new Date() });
});

// Grafana sometimes redirects to /login at site root — break the loop by sending to portal.
app.get("/login", (req, res) => {
  const token = req.cookies && req.cookies.farmsense_token;
  if (token) {
    try {
      require("jsonwebtoken").verify(token, process.env.JWT_SECRET);
      // Authenticated but hit /login — Grafana auth proxy may be misconfigured.
      // Send to portal (NOT /grafana — that would loop).
      return res.redirect(302, "/?from=grafana");
    } catch { /* token invalid — continue to portal login */ }
  }
  const safe = toSafeGrafanaBrowserPath(req.query.redirectTo);
  if (!safe) {
    return res.redirect(302, "/");
  }
  const qs = new URLSearchParams({ afterLogin: safe });
  return res.redirect(302, "/?" + qs.toString());
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api/auth",            authRoutes);
app.use("/api/sensors",         authenticateToken, sensorRoutes);
app.use("/api/alerts",          authenticateToken, alertRoutes);
app.use("/api/recommendations", authenticateToken, recommendRoutes);
app.use("/api/dashboard",       authenticateToken, dashboardRoutes);

// ─── GRAFANA (auth proxy — single sign-on) ───────────────────────────────────
// Browser uses http://<app-host>:<port>/grafana/...  Grafana must set root_url to match.
const grafanaProxy = createProxyMiddleware({
  target: GRAFANA_TARGET,
  changeOrigin: true,
  ws: true,
  autoRewrite: true,
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.grafanaUser && req.grafanaUser.username) {
        proxyReq.setHeader("X-WEBAUTH-USER", req.grafanaUser.username);
      }
    },
    error: (err, req, res) => {
      console.error("[Grafana Proxy] Connection error:", err.message);
      if (res.headersSent) return;
      res.status(502).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Grafana Unavailable</title>
        <style>body{font-family:'Inter',system-ui,sans-serif;background:#0a0f0d;color:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}
        .card{background:rgba(22,34,28,.6);border:1px solid rgba(74,222,128,.12);border-radius:16px;padding:2.5rem;max-width:480px}
        h1{font-size:1.3rem;margin-bottom:.75rem}p{color:#a7c4b8;font-size:.9rem;line-height:1.6;margin-bottom:1rem}
        a{color:#4ade80;text-decoration:none;padding:.5rem 1.25rem;border:1px solid rgba(74,222,128,.25);border-radius:8px;font-weight:600;display:inline-block}a:hover{background:rgba(74,222,128,.1)}</style></head>
        <body><div class="card">
          <h1>⚠️ Grafana Service Unavailable</h1>
          <p>The Grafana dashboard server at <strong>${GRAFANA_TARGET}</strong> is not responding.<br>Make sure Grafana is running and configured per <code>config/grafana-auth-proxy.example.ini</code>.</p>
          <a href="/dashboard.html">← Use Built-in Dashboard</a>
        </div></body></html>
      `);
    }
  }
});

app.use("/grafana", requireGrafanaAuth, grafanaProxy);

// ─── BUILT-IN DASHBOARD (redirect /dashboard → dashboard.html) ───────────────
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "dashboard.html"));
});

// ─── SERVE FRONTEND (Tier 1 — Presentation Layer) ────────────────────────────
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ─── 404 HANDLER ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`FarmSense Brew API running on port ${PORT}`);
  console.log(`Grafana reverse proxy: /grafana → ${GRAFANA_TARGET}`);
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
  // Upgrades skip Express mount — strip prefix so upstream matches HTTP proxy paths
  req.url = req.url.replace(/^\/grafana/, "") || "/";
  grafanaProxy.upgrade(req, socket, head);
});

module.exports = app;

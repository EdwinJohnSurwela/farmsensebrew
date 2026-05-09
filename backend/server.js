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

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");

const authRoutes       = require("./routes/auth.routes");
const sensorRoutes     = require("./routes/sensor.routes");
const alertRoutes      = require("./routes/alert.routes");
const recommendRoutes  = require("./routes/recommendation.routes");
const { authenticateToken } = require("./middleware/auth.middleware");

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet());                          // Security headers
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(morgan("combined"));               // Request logging
app.use(express.json());

// ─── HEALTH CHECK (no auth required) ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "FarmSense Brew API", timestamp: new Date() });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api/auth",            authRoutes);                        // Login, token refresh
app.use("/api/sensors",         authenticateToken, sensorRoutes);   // Sensor data queries
app.use("/api/alerts",          authenticateToken, alertRoutes);    // Alert management
app.use("/api/recommendations", authenticateToken, recommendRoutes); // Gemini recommendations

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
app.listen(PORT, () => {
  console.log(`FarmSense Brew API running on port ${PORT}`);
});

module.exports = app;

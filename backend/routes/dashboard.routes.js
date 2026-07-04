/**
 * FarmSense Brew — Dashboard Data Routes
 * File: backend/routes/dashboard.routes.js
 *
 * Endpoints that replicate the Grafana dashboard SQL queries,
 * serving the exact same data the Grafana panels display.
 * Used by the built-in frontend dashboards.
 */

const express = require("express");
const db      = require("../services/db.service");
const router  = express.Router();

// ─── SHARED: KPI Summary (1-hour window) ─────────────────────────────────────
router.get("/kpi", async (req, res) => {
  try {
    const [summary] = await db.query(`
      SELECT ROUND(AVG(temperature),1) AS avg_temperature,
             ROUND(AVG(humidity),1)    AS avg_humidity,
             ROUND(AVG(soil_pct),0)    AS avg_soil_pct,
             AVG(CASE WHEN clr_risk='HIGH' THEN 75
                      WHEN clr_risk='MODERATE' THEN 50
                      ELSE 25 END) AS clr_risk_score,
             COUNT(DISTINCT node_id) AS active_nodes,
             COUNT(*) AS reading_count,
             MAX(recorded_at) AS latest_reading
      FROM sensor_readings
      WHERE recorded_at >= NOW() - INTERVAL 1 HOUR
    `);
    res.json(summary[0] || {});
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch KPI data" });
  }
});

// ─── SHARED: Latest reading per node (full table) ─────────────────────────────
router.get("/nodes", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sr.node_id, sn.position, sn.description,
             sr.temperature, sr.humidity, sr.soil_pct,
             sr.clr_risk, sr.confidence_pct,
             CASE WHEN sr.soil_pct < 35 AND sr.clr_risk != 'HIGH' THEN 'ACTIVE'
                  WHEN sr.clr_risk = 'HIGH' THEN 'WITHHELD'
                  ELSE 'STANDBY' END AS irrigation_status,
             sr.recorded_at
      FROM sensor_readings sr
      INNER JOIN (
        SELECT node_id, MAX(recorded_at) AS latest
        FROM sensor_readings GROUP BY node_id
      ) l ON sr.node_id = l.node_id AND sr.recorded_at = l.latest
      LEFT JOIN sensor_nodes sn ON sr.node_id = sn.node_id
      ORDER BY sr.node_id
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch node data" });
  }
});

// ─── SHARED: 24h Hourly trends (temp, humidity, soil, clr) ───────────────────
router.get("/trends", async (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  try {
    const [rows] = await db.query(`
      SELECT
        MIN(recorded_at)              AS time,
        ROUND(AVG(temperature),1)     AS avg_temperature,
        ROUND(AVG(humidity),1)        AS avg_humidity,
        ROUND(AVG(soil_pct),0)        AS avg_soil_pct,
        ROUND(AVG(confidence_pct),1)  AS avg_clr_score
      FROM sensor_readings
      WHERE recorded_at >= NOW() - INTERVAL ? HOUR
      GROUP BY FLOOR(UNIX_TIMESTAMP(recorded_at)/3600)
      ORDER BY time
    `, [hours]);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

// ─── AGRONOMIST: CLR Risk Factor Analysis ─────────────────────────────────────
router.get("/risk-factors", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        'Temperature Risk' AS factor,
        CASE WHEN AVG(temperature) BETWEEN 21 AND 25 THEN 70
             WHEN AVG(temperature) BETWEEN 25 AND 28 THEN 50
             WHEN AVG(temperature) BETWEEN 18 AND 21 THEN 40
             ELSE 20 END AS value
      FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL 1 HOUR
      UNION ALL
      SELECT 'Humidity Risk',
        CASE WHEN AVG(humidity) >= 85 THEN 85
             WHEN AVG(humidity) >= 80 THEN 70
             WHEN AVG(humidity) >= 70 THEN 45
             ELSE 25 END
      FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL 1 HOUR
      UNION ALL
      SELECT 'Soil Moisture',
        CASE WHEN AVG(soil_pct) < 30 THEN 30
             WHEN AVG(soil_pct) < 35 THEN 40
             WHEN AVG(soil_pct) >= 50 THEN 50
             ELSE 35 END
      FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL 1 HOUR
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch risk factors" });
  }
});

// ─── AGRONOMIST: Irrigation count (nodes needing water) ──────────────────────
router.get("/irrigation-count", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COUNT(DISTINCT sr.node_id) AS count
      FROM sensor_readings sr
      INNER JOIN (
        SELECT node_id, MAX(recorded_at) AS latest
        FROM sensor_readings GROUP BY node_id
      ) l ON sr.node_id = l.node_id AND sr.recorded_at = l.latest
      WHERE sr.soil_pct < 35 AND sr.clr_risk != 'HIGH'
    `);
    res.json(rows[0] || { count: 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch irrigation count" });
  }
});

// ─── FARM OWNER: Business KPIs (static demo values + live CLR) ───────────────
router.get("/business", async (req, res) => {
  try {
    const [clr] = await db.query(`
      SELECT AVG(CASE WHEN clr_risk='HIGH' THEN 75
                      WHEN clr_risk='MODERATE' THEN 50
                      ELSE 25 END) AS clr_risk_score
      FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL 1 HOUR
    `);
    const [highRisk] = await db.query(`
      SELECT COUNT(DISTINCT sr.node_id) AS count
      FROM sensor_readings sr
      INNER JOIN (SELECT node_id, MAX(recorded_at) AS latest FROM sensor_readings GROUP BY node_id) l
        ON sr.node_id = l.node_id AND sr.recorded_at = l.latest
      WHERE sr.confidence_pct >= 60
    `);
    const [plotSize] = await db.query(`
      SELECT CONCAT(COUNT(*) * 10, ' sqm') AS value FROM sensor_nodes WHERE is_active = 1
    `);
    res.json({
      revenue: "₱81,000",
      yield: "162 kg",
      clr_risk_score: clr[0]?.clr_risk_score || 25,
      high_risk_zones: highRisk[0]?.count || 0,
      plot_size: plotSize[0]?.value || "50 sqm",
      water_usage: "2,850 L",
      uptime: "99.8%"
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch business data" });
  }
});

// ─── FARM OWNER: Per-node bar chart data (CLR vs Soil) ───────────────────────
router.get("/node-comparison", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sn.position, sr.node_id,
             sr.confidence_pct AS clr_risk_pct,
             sr.soil_pct
      FROM sensor_readings sr
      INNER JOIN (SELECT node_id, MAX(recorded_at) AS latest FROM sensor_readings GROUP BY node_id) l
        ON sr.node_id = l.node_id AND sr.recorded_at = l.latest
      LEFT JOIN sensor_nodes sn ON sr.node_id = sn.node_id
      ORDER BY sr.node_id
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch node comparison" });
  }
});

// ─── FIELD STAFF: Simple action cards per node ───────────────────────────────
router.get("/field-actions", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sr.node_id, sn.position,
             sr.clr_risk, sr.soil_pct,
             CASE
               WHEN sr.clr_risk = 'HIGH' AND sr.soil_pct < 35
                 THEN 'URGENT: DO NOT WATER this zone. Disease risk is HIGH. Check leaf undersides for yellow-orange spots. Report any findings to supervisor immediately.'
               WHEN sr.clr_risk = 'HIGH'
                 THEN 'URGENT: Disease risk HIGH. Walk through zone and look for yellow spots on leaves. Take photos of suspicious leaves. Do NOT water.'
               WHEN sr.soil_pct < 30
                 THEN 'ACTION: Drip irrigation is ON. Soil is very dry. Check drip lines for clogs. Monitor for 2 hours then report.'
               WHEN sr.soil_pct < 35
                 THEN 'ACTION: Prepare to water. If soil gets drier, irrigation will start automatically. Check weather — if rain expected, wait.'
               WHEN sr.clr_risk = 'MODERATE'
                 THEN 'WATCH: Conditions may worsen. Walk through zone during next check. Look for any unusual leaf spots. Report anything unusual.'
               ELSE 'ALL GOOD: Continue regular monitoring. Check plants for pests. Remove fallen leaves from ground. Next check in 4 hours.'
             END AS action_text,
             CASE
               WHEN sr.clr_risk = 'HIGH' THEN 'CRITICAL'
               WHEN sr.soil_pct < 30 THEN 'WATERING'
               WHEN sr.clr_risk = 'MODERATE' THEN 'WATCH'
               ELSE 'GOOD'
             END AS status,
             CASE
               WHEN sr.soil_pct < 35 AND sr.clr_risk != 'HIGH' THEN 'ON'
               WHEN sr.clr_risk = 'HIGH' THEN 'STOPPED'
               ELSE 'OFF'
             END AS valve_status,
             sr.recorded_at
      FROM sensor_readings sr
      INNER JOIN (SELECT node_id, MAX(recorded_at) AS latest FROM sensor_readings GROUP BY node_id) l
        ON sr.node_id = l.node_id AND sr.recorded_at = l.latest
      LEFT JOIN sensor_nodes sn ON sr.node_id = sn.node_id
      ORDER BY FIELD(sr.clr_risk, 'HIGH', 'MODERATE', 'LOW'), sr.node_id
    `);

    // Urgent count
    const urgent = rows.filter(r => r.status === 'CRITICAL' || r.status === 'WATERING').length;

    res.json({ data: rows, urgent_count: urgent });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch field actions" });
  }
});

// ─── SHARED: Scale-up / node registration ────────────────────────────────────
router.get("/scale-up", async (req, res) => {
  try {
    const [nodes] = await db.query(`
      SELECT sn.node_id, sn.position, sn.description,
             CASE WHEN sn.is_active = 1 THEN 'ACTIVE' ELSE 'OFFLINE' END AS status,
             sn.installed_at, sn.latitude, sn.longitude
      FROM sensor_nodes sn ORDER BY sn.node_id
    `);
    const total = nodes.length;
    const active = nodes.filter(n => n.status === 'ACTIVE').length;
    res.json({
      total_nodes: total,
      active_nodes: active,
      total_coverage: (total * 10) + " sqm",
      capacity: "Unlimited",
      nodes: nodes
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scale-up data" });
  }
});

module.exports = router;

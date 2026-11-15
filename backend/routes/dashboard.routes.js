/**
 * FarmSense Brew — Dashboard Data Routes
 * File: backend/routes/dashboard.routes.js
 *
 * Endpoints that replicate the Grafana dashboard SQL queries,
 * serving the exact same data the Grafana panels display.
 * Used by the built-in frontend dashboards.
 */

const express = require("express");
const clr = require("../services/clr-risk");
const db      = require("../services/db.service");
const router  = express.Router();

// ─── SHARED: KPI Summary (1-hour window) ─────────────────────────────────────
router.get("/kpi", async (req, res) => {
  try {
    const [summary] = await db.query(`
      SELECT ROUND(AVG(temperature),1) AS avg_temperature,
             ROUND(AVG(humidity),1)    AS avg_humidity,
             ROUND(AVG(soil_pct),0)    AS avg_soil_pct,
             ROUND(AVG(confidence_pct),0) AS clr_risk_score,
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
             CASE WHEN sr.soil_pct < 35 AND sr.clr_risk NOT IN ('HIGH','CRITICAL') THEN 'ACTIVE'
                  WHEN sr.clr_risk IN ('HIGH','CRITICAL') THEN 'WITHHELD'
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
    // Dedupe: the MAX(recorded_at) join returns several rows per node
    // when readings tie on the same timestamp (batch-seeded data)
    const seen = new Set();
    res.json({ data: rows.filter(r => !seen.has(r.node_id) && seen.add(r.node_id)) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch node data" });
  }
});

// ─── SHARED: 24h Hourly trends (temp, humidity, soil, clr) ───────────────────
router.get("/trends", async (req, res) => {
  // Accepts ?minutes=15 for short windows or ?hours=24 (default).
  // Bucket size scales with the window: <=30min raw readings,
  // <=6h per-minute averages, otherwise per-hour averages.
  const minutes = parseInt(req.query.minutes) || 0;
  const hours = parseInt(req.query.hours) || 24;
  const windowMinutes = minutes > 0 ? minutes : hours * 60;
  const bucketSeconds = windowMinutes <= 30 ? 1 : (windowMinutes <= 360 ? 60 : 3600);
  try {
    const [rows] = await db.query(`
      SELECT
        MIN(recorded_at)              AS time,
        ROUND(AVG(temperature),1)     AS avg_temperature,
        ROUND(AVG(humidity),1)        AS avg_humidity,
        ROUND(AVG(soil_pct),0)        AS avg_soil_pct,
        ROUND(AVG(confidence_pct),1)  AS avg_clr_score
      FROM sensor_readings
      WHERE recorded_at >= NOW() - INTERVAL ? MINUTE
      GROUP BY FLOOR(UNIX_TIMESTAMP(recorded_at)/?)
      ORDER BY time
    `, [windowMinutes, bucketSeconds]);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

// ─── AGRONOMIST: CLR Risk Factor Analysis ─────────────────────────────────────
// HAVING COUNT(*) > 0: with no readings in the hour there are no factors,
// instead of the ELSE values standing in for data that does not exist.
// The three scored parts of the CLR rule over the last hour, each as a percent of
// its own maximum (temperature 35, humidity 25, leaf wetness estimate 40 points).
router.get("/risk-factors", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT temperature, humidity FROM sensor_readings
      WHERE recorded_at >= NOW() - INTERVAL 1 HOUR AND temperature IS NOT NULL AND humidity IS NOT NULL`);
    if (!rows.length) return res.json({ data: [] });
    const sum = { temperature: 0, humidity: 0, leaf_wetness: 0 };
    for (const r of rows) {
      const { parts } = clr.computeClrRisk(Number(r.temperature), Number(r.humidity));
      for (const k of Object.keys(sum)) sum[k] += parts[k];
    }
    const pct = (k, max) => Math.round((sum[k] / rows.length / max) * 100);
    res.json({ data: [
      { factor: "Temperature", value: pct("temperature", 35), weight: 35 },
      { factor: "Humidity", value: pct("humidity", 25), weight: 25 },
      { factor: "Leaf wetness (est.)", value: pct("leaf_wetness", 40), weight: 40 },
    ] });
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
      WHERE sr.soil_pct < 35 AND sr.clr_risk NOT IN ('HIGH','CRITICAL')
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
      SELECT ROUND(AVG(confidence_pct),0) AS clr_risk_score
      FROM sensor_readings WHERE recorded_at >= NOW() - INTERVAL 1 HOUR
    `);
    const [highRisk] = await db.query(`
      SELECT COUNT(DISTINCT sr.node_id) AS count
      FROM sensor_readings sr
      INNER JOIN (SELECT node_id, MAX(recorded_at) AS latest FROM sensor_readings GROUP BY node_id) l
        ON sr.node_id = l.node_id AND sr.recorded_at = l.latest
      WHERE sr.confidence_pct > 60
    `);
    const [plotSize] = await db.query(`
      SELECT CONCAT(CEIL(COUNT(*) / 5) * 50, ' sqm') AS value FROM sensor_nodes WHERE is_active = 1
    `);
    res.json({
      revenue: "₱81,000",
      yield: "162 kg",
      clr_risk_score: clr[0]?.clr_risk_score ?? null,
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
    const seen = new Set();
    res.json({ data: rows.filter(r => !seen.has(r.node_id) && seen.add(r.node_id)) });
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
               WHEN sr.clr_risk IN ('HIGH','CRITICAL') AND sr.soil_pct < 35
                 THEN 'URGENT: DO NOT WATER this zone. Disease risk is HIGH or CRITICAL. Check leaf undersides for yellow-orange spots. Report any findings to the agronomist or the Farm Owner right away.'
               WHEN sr.clr_risk IN ('HIGH','CRITICAL')
                 THEN 'URGENT: Disease risk HIGH or CRITICAL. Walk through zone and look for yellow spots on leaves. Take photos of suspicious leaves. Do NOT water.'
               WHEN sr.soil_pct < 30
                 THEN 'ACTION: Drip irrigation is ON. Soil is very dry. Check drip lines for clogs. Monitor for 2 hours then report.'
               WHEN sr.soil_pct < 35
                 THEN 'ACTION: Prepare to water. If soil gets drier, irrigation will start automatically. Check the weather: if rain is expected, wait.'
               WHEN sr.clr_risk = 'MODERATE'
                 THEN 'WATCH: Conditions may worsen. Walk through zone during next check. Look for any unusual leaf spots. Report anything unusual.'
               ELSE 'ALL GOOD: Continue regular monitoring. Check plants for pests. Remove fallen leaves from ground. Next check in 4 hours.'
             END AS action_text,
             CASE
               WHEN sr.clr_risk IN ('HIGH','CRITICAL') THEN 'CRITICAL'
               WHEN sr.soil_pct < 30 THEN 'WATERING'
               WHEN sr.clr_risk = 'MODERATE' THEN 'WATCH'
               ELSE 'GOOD'
             END AS status,
             CASE
               WHEN sr.soil_pct < 35 AND sr.clr_risk NOT IN ('HIGH','CRITICAL') THEN 'ON'
               WHEN sr.clr_risk IN ('HIGH','CRITICAL') THEN 'STOPPED'
               ELSE 'OFF'
             END AS valve_status,
             sr.recorded_at
      FROM sensor_readings sr
      INNER JOIN (SELECT node_id, MAX(recorded_at) AS latest FROM sensor_readings GROUP BY node_id) l
        ON sr.node_id = l.node_id AND sr.recorded_at = l.latest
      LEFT JOIN sensor_nodes sn ON sr.node_id = sn.node_id
      ORDER BY FIELD(sr.clr_risk, 'CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'MINIMAL'), sr.node_id
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
      total_coverage: (Math.ceil(total / 5) * 50) + " sqm",   // one 50 sqm plot per 5 nodes
      capacity: "Unlimited",
      nodes: nodes
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scale-up data" });
  }
});
// ─── SHARED: Scale-up / node registration (POST — register new zone) ────────
router.post("/scale-up", async (req, res) => {
  const { zone_name } = req.body;

  // Expanding the farm is the owner's decision.
  if (!req.user || req.user.role !== "farm_owner") {
    return res.status(403).json({ error: "Only the farm owner can add sensor nodes" });
  }

  if (!zone_name) {
    return res.status(400).json({ error: "zone_name is required" });
  }

  try {
    // Next node id = the lowest NODE_xx number not currently in use, so
    // numbering tracks the nodes that actually exist. With NODE_01 + NODE_02
    // present the next zone is NODE_03 — and a deleted number is refilled
    // rather than skipped (previously we counted the max ever created, incl.
    // the audit-log history, which made numbering climb to NODE_13+ even
    // after every test/demo node had been removed). The audit log still
    // records each creation with its timestamp, so history is preserved.
    const [existing] = await db.query("SELECT node_id FROM sensor_nodes");
    const used = new Set();
    for (const r of existing) {
      const m = /^NODE_(\d+)$/.exec(r.node_id || "");
      if (m) used.add(parseInt(m[1], 10));
    }
    let nextNum = 1;
    while (used.has(nextNum)) nextNum++;
    const nodeId = `NODE_${String(nextNum).padStart(2, "0")}`;
    const position = zone_name.toUpperCase().replace(/\s+/g, "_");

    // Insert new sensor node
    await db.query(
      `INSERT INTO sensor_nodes (node_id, position, description, is_active)
       VALUES (?, ?, ?, 1)`,
      [nodeId, position, `${zone_name}, added via Scale Up`]
    );
    // Durable record so node numbering never reuses this id
    require("../services/audit.service").record(
      "NODE_CREATED", req.user?.username || "system", nodeId, `${zone_name} registered`
    );

    // No starting reading is stored: the new node stays offline (grey) until
    // its own sensor box posts. Typed-in values are not sensor data.

    // Return updated node list
    const [nodes] = await db.query(
      `SELECT node_id, position, description,
              CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'OFFLINE' END AS status
       FROM sensor_nodes ORDER BY node_id`
    );

    res.json({
      message: `${zone_name} registered as ${nodeId}`,
      node_id: nodeId,
      total_nodes: nodes.length,
      nodes: nodes
    });
  } catch (err) {
    console.error("[Scale-Up] Registration error:", err.message);
    res.status(500).json({ error: "Failed to register new zone" });
  }
});

// ─── SHARED: Update a node's map position (drag on Farm Map) ─────────────────
router.patch("/node-position", async (req, res) => {
  const { node_id, latitude, longitude } = req.body;
  if (!node_id || latitude == null || longitude == null) {
    return res.status(400).json({ error: "node_id, latitude and longitude are required" });
  }
  try {
    await db.query(
      "UPDATE sensor_nodes SET latitude = ?, longitude = ? WHERE node_id = ?",
      [latitude, longitude, node_id]
    );
    res.json({ success: true, node_id, latitude, longitude });
  } catch (err) {
    console.error("[Node position] update failed:", err.message);
    res.status(500).json({ error: "Failed to update node position" });
  }
});

// Removing a node: DELETE /api/admin/nodes/:nodeId (admins only, and never
// a node with saved readings). The old route here, open to every role and
// erasing a node's readings and alerts, was removed on 2 Oct 2026.

module.exports = router;

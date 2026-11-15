/**
 * FarmSense Brew — Sensor Calibration Routes
 * File: backend/routes/calibration.routes.js
 *
 * GET  /api/calibration/:node_id   → get calibration params for a node
 * POST /api/calibration/:node_id   → update calibration params (dry_raw, wet_raw)
 * GET  /api/calibration/all        → list all node calibration data
 */

const express = require("express");
const db      = require("../services/db.service");
const router  = express.Router();

// GET /api/calibration/all — all nodes with calibration data
router.get("/all", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT cp.node_id, cp.dry_raw, cp.wet_raw, cp.offset_pct,
             cp.calibrated_at, cp.notes,
             sn.position, sn.description
      FROM calibration_params cp
      LEFT JOIN sensor_nodes sn ON cp.node_id = sn.node_id
      ORDER BY cp.node_id
    `);
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    // Table may not exist yet — return empty
    res.json({ data: [], count: 0, note: "calibration_params table may not exist yet" });
  }
});

// GET /api/calibration/:node_id — calibration params + latest raw vs calibrated
router.get("/:node_id", async (req, res) => {
  const { node_id } = req.params;

  try {
    // Get calibration params
    const [params] = await db.query(
      "SELECT * FROM calibration_params WHERE node_id = ?",
      [node_id]
    );

    // Get latest raw reading for comparison
    const [readings] = await db.query(`
      SELECT soil_pct, soil_raw, recorded_at
      FROM sensor_readings
      WHERE node_id = ?
      ORDER BY recorded_at DESC
      LIMIT 5
    `, [node_id]);

    const calibration = params[0] || null;
    const latestReadings = readings || [];

    // Calculate calibrated value if params exist
    let calibratedSoilPct = null;
    if (calibration && latestReadings.length > 0 && latestReadings[0].soil_raw) {
      const raw = latestReadings[0].soil_raw;
      const dryRaw = calibration.dry_raw;
      const wetRaw = calibration.wet_raw;
      const offset = calibration.offset_pct || 0;

      if (dryRaw !== wetRaw) {
        calibratedSoilPct = Math.round(
          ((raw - dryRaw) / (wetRaw - dryRaw)) * 100 + offset
        );
        calibratedSoilPct = Math.max(0, Math.min(100, calibratedSoilPct));
      }
    }

    res.json({
      node_id,
      calibration,
      latest_readings: latestReadings,
      calibrated_soil_pct: calibratedSoilPct
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch calibration data" });
  }
});

// POST /api/calibration/:node_id — set or update calibration parameters
router.post("/:node_id", async (req, res) => {
  // Calibration changes the soil % that automatic watering acts on (security
  // test 17 Oct 2026: any signed-in role could change it).
  if (!["agronomist", "admin"].includes(req.user && req.user.role)) {
    return res.status(403).json({ error: "Only the agronomist or the System Admin can change calibration" });
  }
  const { node_id } = req.params;
  const { dry_raw, wet_raw, offset_pct, notes } = req.body;

  if (dry_raw == null || wet_raw == null) {
    return res.status(400).json({
      error: "dry_raw and wet_raw are required",
      help: "dry_raw = ADC value in completely dry soil, wet_raw = ADC value in saturated soil"
    });
  }

  if (dry_raw === wet_raw) {
    return res.status(400).json({ error: "dry_raw and wet_raw must be different values" });
  }

  try {
    // Verify node exists
    const [node] = await db.query(
      "SELECT node_id FROM sensor_nodes WHERE node_id = ?",
      [node_id]
    );
    if (node.length === 0) {
      return res.status(404).json({ error: `Node ${node_id} not found` });
    }

    // Upsert calibration params
    await db.query(`
      INSERT INTO calibration_params (node_id, dry_raw, wet_raw, offset_pct, notes, calibrated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        dry_raw = VALUES(dry_raw),
        wet_raw = VALUES(wet_raw),
        offset_pct = VALUES(offset_pct),
        notes = VALUES(notes),
        calibrated_at = NOW()
    `, [node_id, dry_raw, wet_raw, offset_pct || 0, notes || null]);

    res.json({
      message: `Calibration updated for ${node_id}`,
      node_id,
      dry_raw,
      wet_raw,
      offset_pct: offset_pct || 0
    });
  } catch (err) {
    console.error("[Calibration] Error:", err.message);
    res.status(500).json({ error: "Failed to update calibration" });
  }
});

module.exports = router;

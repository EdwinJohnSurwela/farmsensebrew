/**
 * FarmSense Brew — Alert Routes
 * File: backend/routes/alert.routes.js
 *
 * GET   /api/alerts           → list all unresolved alerts
 * GET   /api/alerts/history   → all alerts (resolved + unresolved)
 * PATCH /api/alerts/:id/resolve → mark alert as resolved
 */

const express = require("express");
const db      = require("../services/db.service");
const router  = express.Router();

// GET /api/alerts — unresolved alerts (shown on dashboard warning panel)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, node_id, risk_level, temperature, humidity, soil_pct,
             alert_message, created_at
      FROM clr_alerts
      WHERE is_resolved = 0
      ORDER BY created_at DESC
    `);
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET /api/alerts/history
router.get("/history", async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  try {
    const [rows] = await db.query(
      "SELECT * FROM clr_alerts ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alert history" });
  }
});

// PATCH /api/alerts/:id/resolve — agronomist marks alert as resolved
router.patch("/:id/resolve", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      "UPDATE clr_alerts SET is_resolved = 1, resolved_at = NOW() WHERE id = ?",
      [id]
    );
    res.json({ message: `Alert ${id} marked as resolved` });
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

module.exports = router;

/**
 * FarmSense Brew — Alert Routes
 * File: backend/routes/alert.routes.js
 *
 * GET  /api/alerts                     -> open alerts (at most one per node)
 * GET  /api/alerts/history?limit=100   -> closed alerts with the action that closed them
 * GET  /api/alerts/actions?limit=10&node_id=NODE_01 -> recent field actions
 * GET  /api/alerts/action-types        -> what can be recorded, and each quiet period
 * POST /api/alerts/node/:nodeId/action -> record what was done { action, note }
 *                                         (agronomist, field staff); closes the node's alert
 */
const express = require("express");
const db = require("../services/db.service");
const alerts = require("../services/alert.service");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    await alerts.ensureSchema();
    const [rows] = await db.query(`
      SELECT id, node_id, risk_level, temperature, humidity, soil_pct, alert_message,
             created_at, last_seen_at, peak_humidity, reminded_at
      FROM clr_alerts WHERE is_resolved = 0
      ORDER BY FIELD(risk_level, 'CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'MINIMAL'), created_at DESC`);
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.get("/history", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
  try {
    await alerts.ensureSchema();
    const [rows] = await db.query(`
      SELECT c.id, c.node_id, c.risk_level, c.temperature, c.humidity, c.soil_pct, c.alert_message,
             c.created_at, c.last_seen_at, c.peak_humidity, c.resolved_at, c.closed_reason, c.merged_into,
             c.resolved_by, a.action, a.note, a.done_by, a.role AS done_by_role, a.quiet_until
      FROM clr_alerts c LEFT JOIN alert_actions a ON a.alert_id = c.id
      WHERE c.is_resolved = 1
      ORDER BY COALESCE(c.resolved_at, c.created_at) DESC LIMIT ?`, [limit]);
    const labels = Object.fromEntries(alerts.actionTypes().map((t) => [t.key, t.label]));
    res.json({ data: rows.map((r) => ({ ...r, action_label: r.action ? labels[r.action] || r.action : null })), count: rows.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alert history" });
  }
});

router.get("/actions", async (req, res) => {
  try {
    const node = /^NODE_\d{2}$/.test(req.query.node_id || "") ? req.query.node_id : null;
    const data = await alerts.recentActions({ limit: Math.min(parseInt(req.query.limit, 10) || 10, 200), node_id: node });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch field actions" });
  }
});

router.get("/action-types", (req, res) => {
  res.json({ data: alerts.actionTypes().filter((t) => !t.retired) });
});

router.post("/node/:nodeId/action", async (req, res) => {
  try {
    const node = /^NODE_\d{2}$/.test(req.params.nodeId) ? req.params.nodeId : null;
    if (!node) return res.status(400).json({ error: "Unknown node" });
    const saved = await alerts.recordAction(node, req.body || {}, req.user);
    res.json({ success: true, action: saved });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to record the action" });
  }
});

module.exports = router;

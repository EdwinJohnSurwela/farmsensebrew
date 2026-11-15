/**
 * FarmSense Brew — Irrigation Relay Routes
 * File: backend/routes/irrigation.routes.js
 *
 * Handles relay state for ESP32 nodes (on/off toggle from the Flutter app)
 * and relay polling from the ESP32 firmware.
 *
 * In-memory state for prototype — swap for a DB table for persistence
 * across server restarts if needed later.
 */
const express = require("express");
const router  = express.Router();
const relay   = require('../services/relay.service');
const db = require('../services/db.service');
const scheduler = require('../services/scheduler.service');
// nodeMode remains per-node mode (manual/auto)
const nodeMode   = { 1: 'manual', 2: 'manual', 3: 'manual', 4: 'manual', 5: 'manual' };

/**
 * GET /status — Flutter app's Irrigation screen fetches all node states.
 * Returns all relay states at once.
 */
router.get('/status', async (req, res) => {
  try {
    // Prefer returning registered sensor nodes (if table exists). If none, return empty list.
    const [rows] = await db.query('SELECT node_id FROM sensor_nodes');
    if (!rows || rows.length === 0) return res.json({ data: [] });
    const nodes = rows.map(r => {
      const nodeIdRaw = r.node_id || r.nodeId || r.node;
      const idNum = parseInt(String(nodeIdRaw).replace(/\D/g, ''), 10) || null;
      return { node_id: nodeIdRaw, relay_on: relay.getState(idNum || nodeIdRaw), mode: nodeMode[idNum] || 'manual' };
    });
    return res.json({ data: nodes, valve_box: relay.valveBox() });
  } catch (err) {
    // If DB/table not available, fall back to default relay list
    const nodes = relay.getAll().map(n => ({ ...n, mode: nodeMode[n.node_id] || 'manual' }));
    return res.json({ data: nodes, valve_box: relay.valveBox() });
  }
});

/**
 * POST /control — Flutter app calls this when the user taps the toggle.
 * Body: { "node_id": "1", "mode": "manual", "relay_on": true }
 */
router.post("/control", (req, res) => {
  const { node_id, mode, relay_on, schedule_time, duration_minutes } = req.body;

  const id = parseInt(node_id) || parseInt(String(node_id).replace(/\D/g, ''));

  if (!id || id < 1 || id > 5) {
    return res.status(400).json({ error: "Invalid node_id" });
  }

  if (mode) nodeMode[id] = mode;
  if (relay_on !== undefined && relay_on !== null) {
    relay.setState(id, !!relay_on);
  }

  console.log(`[Irrigation] Node ${id} -> mode=${nodeMode[id]}, relay=${relay.getState(id) ? 'ON' : 'OFF'}`);
  res.json({ success: true, node_id: id, mode: nodeMode[id], relay_on: relay.getState(id) });
});

/**
 * GET /relay/:nodeId — ESP32 polls this every 2 seconds to know relay state.
 * No auth required (device endpoint).
 * Returns: { "state": true } or { "state": false }
 */
router.get('/relay/:nodeId', (req, res) => {
  const nodeId = parseInt(req.params.nodeId);
  res.json({ state: relay.getState(nodeId) || false });
});

/**
 * POST /relay/:nodeId — Direct relay control (alternative endpoint).
 * Body: { "state": true } or { "state": false }
 */
router.post('/relay/:nodeId', (req, res) => {
  const nodeId = parseInt(req.params.nodeId);
  const { state } = req.body;
  if (state === undefined || state === null) return res.status(400).json({ error: "Missing 'state' in request body" });
  relay.setState(nodeId, !!state);
  console.log(`[Irrigation] Node ${nodeId} relay -> ${relay.getState(nodeId) ? 'ON' : 'OFF'}`);
  res.json({ success: true, nodeId, state: relay.getState(nodeId) });
});

/**
 * GET /schedule — Placeholder for schedule list.
 */
router.get('/schedule', (req, res) => {
  const data = scheduler.listSchedules();
  res.json({ data });
});

// ── Automatic watering: the system's own logic, one decision per valve ──
const autoWater = require('../services/auto-irrigation.service');
const canChangeAuto = (req) => ['agronomist', 'farm_owner'].includes(req.user && req.user.role);

// GET /auto — settings, the numbers they give, and what each valve is doing now.
router.get('/auto', (req, res) => {
  res.json({ ...autoWater.status(), canEdit: canChangeAuto(req) });
});

// PUT /auto — switch it on/off or change the numbers (agronomist, farm owner).
router.put('/auto', async (req, res) => {
  if (!canChangeAuto(req)) return res.status(403).json({ error: 'Only the agronomist or farm owner can change automatic watering' });
  try {
    const status = await autoWater.update(req.body || {}, req.user.username);
    res.json({ ...status, canEdit: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /auto/reset — back to the research defaults (On/Off stays as it is).
router.post('/auto/reset', async (req, res) => {
  if (!canChangeAuto(req)) return res.status(403).json({ error: 'Only the agronomist or farm owner can change automatic watering' });
  try {
    const status = await autoWater.resetToDefaults(req.user.username);
    res.json({ ...status, canEdit: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /schedule — Placeholder for creating schedules.
 */
router.post('/schedule', async (req, res) => {
  try {
    const s = await scheduler.createSchedule(req.body);
    res.json({ success: true, schedule: s });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/schedule/:id', async (req, res) => {
  try {
    const s = await scheduler.updateSchedule(req.params.id, req.body);
    res.json({ success: true, schedule: s });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/schedule/:id', async (req, res) => {
  try {
    await scheduler.deleteSchedule(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

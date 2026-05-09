/**
 * FarmSense Brew — Sensor Data Routes (Presentation Tier)
 * No DB queries here — all data access is via sensor.service.js
 */
const express       = require("express");
const sensorService = require("../services/sensor.service");
const router        = express.Router();

router.get("/latest", async (req, res) => {
  try {
    const data = await sensorService.getLatestReadings();
    res.json({ data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch latest readings" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const data = await sensorService.getHistory(
      parseInt(req.query.hours) || 24,
      req.query.node_id || null
    );
    res.json({ data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sensor history" });
  }
});

router.get("/node/:node_id", async (req, res) => {
  try {
    const data = await sensorService.getNodeReadings(
      req.params.node_id,
      parseInt(req.query.limit) || 100
    );
    res.json({ data, node_id: req.params.node_id, count: data.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch node data" });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const summary = await sensorService.getSummary();
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

module.exports = router;
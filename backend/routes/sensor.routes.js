/**
 * FarmSense Brew — Sensor Data Routes (Presentation Tier)
 * No DB queries here — all data access is via sensor.service.js
 */
const express       = require("express");
const sensorService = require("../services/sensor.service");
const presence      = require("../services/presence.service");
const router        = express.Router();

// Latest reading of each node, with the Pi's own online/offline state. An
// online live node shows its newest 2-second values instead of the last
// saved minute. Screens use `online` rather than comparing clocks.
router.get("/latest", async (req, res) => {
  try {
    const rows = await sensorService.getLatestReadings();
    const byId = new Map(rows.map((r) => [r.node_id, { ...r, online: false, live: false, last_seen: r.recorded_at }]));
    for (const p of presence.snapshot()) {
      const r = byId.get(p.node_id) || { node_id: p.node_id, recorded_at: null };
      r.online = p.online;
      r.live = p.live;
      r.last_seen = p.last_seen;
      r.air_ok = p.air_ok;
      r.soil_ok = p.soil_ok;
      if (p.online) {
        // Each sensor's newest value, or none when that sensor is not reading
        // (never an old value shown as if it were current).
        const v = p.values || {};
        r.temperature = v.temperature ?? null;
        r.humidity = v.humidity ?? null;
        r.soil_pct = v.soil_pct ?? null;
        r.clr_risk = v.clr_risk ?? null;
        r.confidence_pct = v.confidence_pct ?? null;
        r.values_at = v.at ?? null;
      }
      byId.set(p.node_id, r);
    }
    const data = [...byId.values()].sort((a, b) => String(a.node_id).localeCompare(String(b.node_id)));
    res.json({ data, count: data.length, server_time: new Date().toISOString() });
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

/**
 * POST /reading — receives sensor data from ESP32 nodes.
 * No JWT auth required (ESP32 nodes don't carry tokens).
 * The raw soil ADC value (0–4095) is converted to a 0–100% scale.
 */
router.post("/reading", async (req, res) => {
  try {
    const { node_id, temperature, humidity, soil_moisture } = req.body;

    if (node_id == null || temperature == null || humidity == null || soil_moisture == null) {
      return res.status(400).json({ error: "Missing required fields: node_id, temperature, humidity, soil_moisture" });
    }

    // Calibration for the new capacitive v2.0 probe on Node 1, from bench
    // testing on 2026-07-13: open air (bone dry) ≈ 3000 raw; wet ≈ 1200
    // (PROVISIONAL — confirm with a stable fully-submerged reading).
    const SOIL_RAW_AIR = 3000;      // → 0 %
    const SOIL_RAW_WATER = 1200;    // → 100 %
    // Real probes never read below about 1,050 in the field (12 Oct 2026 check),
    // so a raw value at or below 700 means no signal from the probe (fault).
    const SOIL_RAW_FAULT_FLOOR = 700;

    const raw = Number(soil_moisture);
    const soilPct = raw <= SOIL_RAW_FAULT_FLOOR
      ? 0
      : Math.round(Math.max(0, Math.min(100,
          ((SOIL_RAW_AIR - raw) / (SOIL_RAW_AIR - SOIL_RAW_WATER)) * 100)));

    await sensorService.insertReading(node_id, temperature, humidity, soilPct, raw);
    res.json({ success: true, node_id, soil_pct: soilPct });
  } catch (err) {
    console.error("[Sensor POST] Error:", err.message);
    res.status(500).json({ error: "Failed to save reading" });
  }
});

module.exports = router;
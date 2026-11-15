/**
 * FarmSense Brew — Sensor fault log
 * File: backend/services/sensor-fault.service.js
 *
 * A box can stay online while one of its sensors stops giving good values
 * (a DHT22 that sends nothing or bad frames, a soil probe that reads a dead
 * 0). When a sensor of an online box goes FAULT_AFTER_MS without a good
 * value, a fault is opened in node_sensor_faults (started_at = its last good
 * value). It closes when a good value comes back; a sensor that never comes
 * back stays open, so the record shows that too. Opening and closing are also
 * written to the audit log. An offline box does not open or close anything:
 * that is the box being off, not a sensor fault.
 */
const db = require("./db.service");
const audit = require("./audit.service");
const presence = require("./presence.service");

const FAULT_AFTER_MS = presence.SENSOR_FRESH_MS; // 1 minute, same as the screens
const CHECK_EVERY_MS = 5000;
const SENSORS = {
  air: "DHT22 (temperature and humidity sensor)",
  soil: "capacitive soil moisture sensor",
};

const open = new Map(); // "NODE_03:air" -> fault id
let loaded = false;

async function loadOpen() {
  const [rows] = await db.query("SELECT id, node_id, sensor FROM node_sensor_faults WHERE ended_at IS NULL");
  for (const r of rows) open.set(`${r.node_id}:${r.sensor}`, r.id);
  loaded = true;
}

const nodeName = (id) => `Node ${parseInt(String(id).replace(/\D/g, ""), 10) || id}`;

async function check() {
  if (!loaded) await loadOpen();
  for (const { node_id, online } of presence.snapshot()) {
    if (!online) continue;
    const silence = presence.sensorSilence(node_id);
    if (!silence) continue;
    for (const sensor of Object.keys(SENSORS)) {
      const key = `${node_id}:${sensor}`;
      const ms = silence[sensor];
      if (ms >= FAULT_AFTER_MS && !open.has(key)) {
        const detail = `${SENSORS[sensor]} gave no good value for 1 minute`;
        const [r] = await db.query(
          "INSERT INTO node_sensor_faults (node_id, sensor, started_at, detail) VALUES (?, ?, NOW() - INTERVAL ? SECOND, ?)",
          [node_id, sensor, Math.round(ms / 1000), detail]);
        open.set(key, r.insertId);
        console.warn(`[SensorFault] ${node_id} ${sensor}: ${detail}`);
        audit.record("SENSOR_FAULT", "system", nodeName(node_id), `${SENSORS[sensor]} stopped giving good values`);
      } else if (ms < FAULT_AFTER_MS && silence[`${sensor}Seen`] && open.has(key)) {
        // Closed only by a good value actually received, never by a restart.
        const id = open.get(key);
        await db.query("UPDATE node_sensor_faults SET ended_at = NOW() WHERE id = ?", [id]);
        open.delete(key);
        const [[f]] = await db.query(
          "SELECT TIMESTAMPDIFF(MINUTE, started_at, ended_at) AS mins FROM node_sensor_faults WHERE id = ?", [id]);
        console.log(`[SensorFault] ${node_id} ${sensor}: back after ${f ? f.mins : "?"} min`);
        audit.record("SENSOR_RECOVERED", "system", nodeName(node_id),
          `${SENSORS[sensor]} is giving good values again${f ? ` after ${f.mins} min` : ""}`);
      }
    }
  }
}

/** Open faults (for the screens): [{ node_id, sensor, started_at }]. */
async function listOpen() {
  const [rows] = await db.query(
    "SELECT node_id, sensor, started_at, detail FROM node_sensor_faults WHERE ended_at IS NULL ORDER BY node_id, sensor");
  return rows;
}

let busy = false;
function start() {
  setInterval(() => {
    if (busy) return;
    busy = true;
    check().catch((e) => console.warn("[SensorFault] check failed:", e.message)).finally(() => { busy = false; });
  }, CHECK_EVERY_MS).unref();
}

module.exports = { start, listOpen, FAULT_AFTER_MS };

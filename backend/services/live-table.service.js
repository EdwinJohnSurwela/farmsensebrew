/**
 * FarmSense Brew — Live values for Grafana
 * File: backend/services/live-table.service.js
 *
 * The web app shows each node's newest 2-second values (presence.service.js),
 * while the database keeps one reading per minute. Grafana can only read the
 * database, so its "now" panels used to show the last saved minute and could
 * disagree with the Overview (a different risk level while humidity was
 * changing). This copies the same live state into `node_live` once a second,
 * so both screens read the same numbers.
 *
 * `node_live` is an in-memory table (ENGINE=MEMORY): nothing is written to the
 * SD card and it is empty after a database restart, like presence itself.
 * Grafana treats a row older than 15 s as offline (the api has stopped).
 */
const db = require("./db.service");
const presence = require("./presence.service");

const WRITE_EVERY_MS = 1000;
let ready = false;
let busy = false;

async function ensureTable() {
  const [c] = await db.query(
    "SELECT COLLATION_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sensor_nodes' AND COLUMN_NAME = 'node_id'");
  const coll = c[0] && c[0].c ? ` COLLATE ${c[0].c}` : "";
  await db.query(`CREATE TABLE IF NOT EXISTS node_live (
    node_id VARCHAR(20)${coll} NOT NULL PRIMARY KEY,
    online TINYINT NOT NULL,
    air_ok TINYINT NOT NULL,
    soil_ok TINYINT NOT NULL,
    temperature DECIMAL(5,2) NULL,
    humidity DECIMAL(5,2) NULL,
    soil_pct INT NULL,
    clr_risk VARCHAR(10) NULL,
    confidence_pct INT NULL,
    values_at DATETIME(3) NULL,
    last_seen DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL
  ) ENGINE=MEMORY`);
  ready = true;
}

async function write() {
  if (busy) return;
  busy = true;
  try {
    if (!ready) await ensureTable();
    const snap = presence.snapshot();
    if (!snap.length) return;
    const rows = snap.map((p) => {
      const v = p.values || {};
      return [p.node_id, p.online ? 1 : 0, p.air_ok ? 1 : 0, p.soil_ok ? 1 : 0,
        v.temperature ?? null, v.humidity ?? null, v.soil_pct ?? null, v.clr_risk ?? null, v.confidence_pct ?? null,
        v.at ? new Date(v.at) : null, new Date(p.last_seen)];
    });
    const marks = rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))").join(", ");
    await db.query(`REPLACE INTO node_live (node_id, online, air_ok, soil_ok, temperature, humidity, soil_pct,
      clr_risk, confidence_pct, values_at, last_seen, updated_at) VALUES ${marks}`, rows.flat());
    write.warned = false;
  } catch (e) {
    ready = false;
    if (!write.warned) console.warn("[LiveTable] update failed:", e.message);
    write.warned = true;
  } finally {
    busy = false;
  }
}

function start() {
  setInterval(write, WRITE_EVERY_MS).unref();
}

module.exports = { start };

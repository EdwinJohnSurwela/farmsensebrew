/**
 * FarmSense Brew — Sensor Data Service
 * All DB queries for sensor data live here (Data Access Layer)
 */
const db = require("./db.service");
const offlineBuffer = require('./offline-buffer.service');
const riskState = require('./risk-state.service');
const live = require('./live.service');
const alerts = require('./alert.service');
const presence = require('./presence.service');

// Live boxes send a sample every 2 s; one sample per node per minute is saved
// to history (sensor_readings), the rest only update the screens.
const SAVE_EVERY_MS = 60 * 1000;
const lastSavedAt = new Map(); // node_id -> ms

/**
 * Latest saved reading of each node. Real rows only: with no readings the list
 * is empty. onlineOnly keeps only the nodes the Pi currently hears from
 * (presence.service), for anything that describes conditions right now.
 */
async function getLatestReadings({ onlineOnly = false } = {}) {
  const [rows] = await db.query(`
    SELECT sr.node_id, sr.position, sr.temperature, sr.humidity,
           sr.soil_pct, sr.clr_risk, sr.confidence_pct, sr.recorded_at
    FROM sensor_readings sr
    INNER JOIN (
      SELECT node_id, MAX(recorded_at) AS max_ts
      FROM sensor_readings
      GROUP BY node_id
    ) latest ON sr.node_id = latest.node_id AND sr.recorded_at = latest.max_ts
    ORDER BY sr.node_id
  `);
    // The MAX(recorded_at) join returns multiple rows per node when
    // readings tie on the same timestamp (batch-seeded data). Keep one.
    const seen = new Set();
    return rows.filter(r => {
      if (seen.has(r.node_id)) return false;
      seen.add(r.node_id);
      return !onlineOnly || presence.isOnline(r.node_id);
    });
}

async function getHistory(hours = 24, node_id = null) {
  let query = `SELECT node_id, position, temperature, humidity, soil_pct,
               clr_risk, confidence_pct, recorded_at
               FROM sensor_readings
               WHERE recorded_at >= NOW() - INTERVAL ? HOUR`;
  const params = [hours];
  if (node_id) { query += " AND node_id = ?"; params.push(node_id); }
  query += " ORDER BY recorded_at DESC LIMIT 5000";
  const [rows] = await db.query(query, params);
  return rows;
}

async function getNodeReadings(node_id, limit = 100) {
  const [rows] = await db.query(
    `SELECT * FROM sensor_readings WHERE node_id = ?
     ORDER BY recorded_at DESC LIMIT ?`,
    [node_id, limit]
  );
  return rows;
}

async function getSummary() {
  const [rows] = await db.query(`
    SELECT ROUND(AVG(temperature),1) AS avg_temperature,
           ROUND(AVG(humidity),1)    AS avg_humidity,
           ROUND(AVG(soil_pct),1)    AS avg_soil_pct,
           MAX(clr_risk)             AS worst_clr_risk,
           COUNT(*)                  AS reading_count,
           MAX(recorded_at)          AS latest_reading
    FROM sensor_readings
    WHERE recorded_at >= NOW() - INTERVAL 1 HOUR
  `);
  return rows[0];
}

// The Coffee Leaf Rust rule (five bands, leaf wetness estimated) lives in clr-risk.js.
const { computeClrRisk } = require('./clr-risk');

// Alerts are episodes, one open alert per node (services/alert.service.js):
//   HIGH, CRITICAL -> act now; stay open until someone records what they did
//   MODERATE       -> early warning; closes by itself after 2 h of calm
//   MINIMAL, LOW   -> shown on dashboards (Healthy, Watch), never an alert.
function maybeCreateHighAlert(node_id, risk, temperature, humidity, soil_pct) {
  alerts.handleRisk(node_id, risk.level, { temperature, humidity, soil_pct })
    .catch((e) => console.warn('[Alerts] failed to update alerts:', e.message));
}

/**
 * Insert a new sensor reading from an ESP32 node.
 * Called by POST /api/sensors/reading (no auth — device endpoint).
 * CLR risk is computed from the live values so real nodes get a
 * real risk level instead of the seeded default.
 */
async function insertReading(node_id, temperature, humidity, soil_pct, soil_raw = null, { alertLevel } = {}) {
  // A reading may carry only one sensor's values (the other one is not
  // reading): no temperature/humidity means no risk level for that minute.
  const hasAir = temperature != null && humidity != null;
  const risk = hasAir ? computeClrRisk(temperature, humidity, soil_pct) : { level: null, score: null };
  // Safety registry: automation consults this before opening a valve
  // (null = risk unknown because the air sensor is not reading).
  riskState.setRisk(node_id, risk.level);
  // Live boxes pass the level that held for the whole minute; older boxes
  // (one reading every 5 minutes) use this reading's own level.
  const alertRisk = !hasAir ? null
    : alertLevel === undefined ? risk : alertLevel && { level: alertLevel, score: risk.score };
  lastSavedAt.set(node_id, Date.now());
  try {
    await db.query(
      `INSERT INTO sensor_readings (node_id, temperature, humidity, soil_pct, soil_raw, clr_risk, confidence_pct, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [node_id, temperature, humidity, soil_pct, soil_raw, risk.level, risk.score]
    );
    if (alertRisk) maybeCreateHighAlert(node_id, alertRisk, temperature, humidity, soil_pct);
    live.broadcast('reading', { node_id });
  } catch (err) {
    // MySQL unreachable → buffer to SQLite instead of losing the reading
    // (FB-55). The flusher in server.js replays it once MySQL is back.
    if (offlineBuffer.isConnectionError(err)) {
      offlineBuffer.bufferReading(
        node_id, temperature, humidity, soil_pct, risk.level, risk.score
      );
      console.warn(
        `[OfflineBuffer] MySQL down — buffered reading from ${node_id} (${offlineBuffer.pendingCount()} pending)`
      );
      return { buffered: true };
    }
    // If insert failed due to missing foreign key (node not registered),
    // attempt to create a placeholder node record and retry once.
    const msg = err && err.message ? err.message.toLowerCase() : "";
    if (msg.includes('foreign key') || msg.includes('cannot add or update a child row')) {
      try {
        // Try to create a minimal sensor_nodes entry. Use INSERT IGNORE
        // so this is safe if the row already exists. Insert only the
        // `node_id` column because some installations don't have a
        // `created_at` column in the `sensor_nodes` table.
        await db.query(`INSERT IGNORE INTO sensor_nodes (node_id) VALUES (?)`, [node_id]);
        // Retry the original insert
        await db.query(
          `INSERT INTO sensor_readings (node_id, temperature, humidity, soil_pct, soil_raw, clr_risk, confidence_pct, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [node_id, temperature, humidity, soil_pct, soil_raw, risk.level, risk.score]
        );
        live.broadcast('reading', { node_id });
        return;
      } catch (err2) {
        console.error('[Sensor POST] Retry after creating node failed:', err2.message);
        throw err2;
      }
    }
    throw err;
  }
}

// A DHT22 can also flip bits and send a believable but wrong pair (11 °C,
// 49 % in the middle of rain). Real air does not move that fast: a sample
// that jumps more than this from the same node's last accepted one within
// JUMP_WINDOW_MS is a missed read (a bad frame can repeat for 2 minutes).
// After JUMP_WINDOW_MS without an accepted sample the next one is taken as it
// is, so a sensor coming back after a fault is never blocked.
const JUMP_T = 4, JUMP_H = 20, JUMP_WINDOW_MS = 3 * 60000;
const lastAir = new Map(); // node_id -> { t, h, at }

function airJumped(node_id, t, h) {
  if (t == null || h == null) return false;
  const prev = lastAir.get(node_id);
  const now = Date.now();
  if (prev && now - prev.at <= JUMP_WINDOW_MS &&
      (Math.abs(t - prev.t) > JUMP_T || Math.abs(h - prev.h) > JUMP_H)) return true;
  lastAir.set(node_id, { t, h, at: now });
  return false;
}

// What was thrown away and why, at most once a minute per node, so a sensor
// problem can be told apart from a filter that is too strict.
const lastRejectLog = new Map();
function logRejected(node_id, what) {
  const now = Date.now();
  if (now - (lastRejectLog.get(node_id) || 0) < 60000) return;
  lastRejectLog.set(node_id, now);
  console.warn(`[Air] ${node_id}: DHT22 sample not used (${what})`);
}

// The nodes stand a few metres apart on one plot, so their air is nearly the
// same: in full sun they differed by up to 6 °C and 15 RH points. A sample far
// outside that from what at least two other nodes read right now is a bad
// frame (11 °C / 49 % while the rest read 22 °C / 98 %). This also covers the
// first sample after a fault, which the jump check cannot compare.
const NEAR_T = 8, NEAR_H = 35;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function farFromNeighbours(node_id, t, h) {
  if (t == null || h == null) return false;
  const others = presence.othersAir(node_id);
  if (others.length < 2) return false;
  return Math.abs(t - median(others.map((o) => Number(o.temperature)))) > NEAR_T
    || Math.abs(h - median(others.map((o) => Number(o.humidity)))) > NEAR_H;
}

/** False for a DHT22 frame that cannot be a real outdoor reading. */
function airPlausible(t, h) {
  if (t == null || h == null) return true; // missing is handled as missing
  if (t === 0 && h === 0) return false;
  return t > -10 && t < 60 && h > 0 && h <= 100;
}

/**
 * A live sample from a sensor box (every 2 s). Updates presence and the open
 * screens at once; saves one reading per node per minute to history.
 * temperature/humidity are null when the DHT22 missed a read; soil_pct is
 * null when the soil sensor gave no good value. Each sensor is used on its
 * own, so a node whose DHT22 stopped still records its soil moisture.
 */
async function receiveSample(node_id, temperature, humidity, soil_pct, soil_raw) {
  // A DHT22 whose data line drops mid-read can send an all-zero frame
  // (0 °C, 0 %) that still passes its checksum. Outdoors that is impossible,
  // so it counts as a missed read, never as a value.
  const bad = !airPlausible(temperature, humidity) ? "impossible value"
    : farFromNeighbours(node_id, temperature, humidity) ? "far from the other nodes"
    : airJumped(node_id, temperature, humidity) ? "sudden jump" : null;
  if (bad) {
    logRejected(node_id, `${bad}: ${temperature} °C, ${humidity} %`);
    temperature = null; humidity = null;
  }
  const air = temperature != null && humidity != null ? { temperature, humidity } : null;
  const soil = soil_pct != null ? { soil_pct, soil_raw } : null;
  const risk = air ? computeClrRisk(temperature, humidity, soil_pct) : null;
  presence.seen(node_id, air, soil, risk);

  const since = Date.now() - (lastSavedAt.get(node_id) || 0);
  if (since < SAVE_EVERY_MS) return { saved: false };
  const v = presence.freshValues(node_id);
  if (!v || (!v.air_ok && !v.soil_ok)) return { saved: false };       // nothing to record
  // Prefer a sample that has its own air reading; a DHT22 that misses one
  // read in a few should not leave its value a minute old.
  if (v.air_ok && !air && since < SAVE_EVERY_MS * 1.5) return { saved: false };
  await insertReading(node_id, v.temperature, v.humidity, v.soil_pct, v.soil_raw,
    { alertLevel: v.air_ok ? presence.takeSustainedLevel(node_id) : null });
  return { saved: true, values: v };
}

module.exports = { getLatestReadings, getHistory, getNodeReadings, getSummary, insertReading, receiveSample, computeClrRisk };
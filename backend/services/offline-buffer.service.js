/**
 * FarmSense Brew — SQLite offline buffer (FB-55)
 *
 * When MySQL is unreachable, incoming sensor readings are written to a
 * local SQLite file instead of being lost. A background flusher replays
 * them into MySQL (oldest first, original timestamps preserved) once the
 * database is back, and rows older than 24 hours are pruned.
 *
 * Uses Node's built-in node:sqlite (Node >= 23 / 24) — no native deps.
 */
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const BUFFER_PATH =
  process.env.OFFLINE_BUFFER_PATH ||
  path.join(__dirname, "..", "data", "offline-buffer.db");
const RETENTION_HOURS = parseInt(process.env.OFFLINE_BUFFER_HOURS) || 24;

let db = null;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(BUFFER_PATH), { recursive: true });
    db = new DatabaseSync(BUFFER_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS buffered_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        temperature REAL,
        humidity REAL,
        soil_pct REAL,
        clr_risk TEXT,
        confidence_pct REAL,
        recorded_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
  }
  return db;
}

/** True when a MySQL error means "server unreachable", not "bad query". */
function isConnectionError(err) {
  const code = err && err.code;
  return [
    "ECONNREFUSED",
    "PROTOCOL_CONNECTION_LOST",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "ER_SERVER_SHUTDOWN",
  ].includes(code) || (err && err.fatal === true);
}

function bufferReading(nodeId, temperature, humidity, soilPct, clrRisk, confidencePct) {
  const stmt = getDb().prepare(`
    INSERT INTO buffered_readings (node_id, temperature, humidity, soil_pct, clr_risk, confidence_pct)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(nodeId, temperature, humidity, soilPct, clrRisk, confidencePct);
}

function pendingCount() {
  const row = getDb().prepare("SELECT COUNT(*) AS c FROM buffered_readings").get();
  return row ? Number(row.c) : 0;
}

/**
 * Replay buffered rows into MySQL via insertFn(row) — oldest first.
 * Stops at the first failure (MySQL presumably still down).
 * Returns how many rows were flushed.
 */
async function flush(insertFn, batchSize = 500) {
  const d = getDb();
  const rows = d
    .prepare("SELECT * FROM buffered_readings ORDER BY id ASC LIMIT ?")
    .all(batchSize);
  let flushed = 0;
  for (const row of rows) {
    try {
      await insertFn(row);
      d.prepare("DELETE FROM buffered_readings WHERE id = ?").run(row.id);
      flushed++;
    } catch (err) {
      if (isConnectionError(err)) break; // still down — retry next cycle
      // Poison row (bad data) — drop it so it can't block the queue
      console.warn("[OfflineBuffer] Dropping unflushable row:", err.message);
      d.prepare("DELETE FROM buffered_readings WHERE id = ?").run(row.id);
    }
  }
  return flushed;
}

/** Remove rows older than the retention window (default 24h). */
function prune() {
  getDb()
    .prepare(
      `DELETE FROM buffered_readings
       WHERE recorded_at < datetime('now','localtime', ?)`
    )
    .run(`-${RETENTION_HOURS} hours`);
}

module.exports = { bufferReading, pendingCount, flush, prune, isConnectionError };

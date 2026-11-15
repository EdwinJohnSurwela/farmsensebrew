/**
 * Settings Service — small named settings kept in MySQL so they survive a
 * restart or reboot (automatic watering settings, custom irrigation rules).
 * Table is auto-created on first use. Values are stored as JSON text.
 */
const db = require("./db.service");

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      name VARCHAR(60) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by VARCHAR(60) DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  tableReady = true;
}

/** The saved value, or `fallback` when nothing is saved (or the DB is not reachable). */
async function get(name, fallback = null) {
  try {
    await ensureTable();
    const [rows] = await db.query("SELECT value FROM app_settings WHERE name = ?", [name]);
    return rows.length ? JSON.parse(rows[0].value) : fallback;
  } catch (err) {
    console.warn(`[Settings] could not read ${name}:`, err.message);
    return fallback;
  }
}

/** Like get(), but throws when the database cannot be read, so callers can retry. */
async function getStrict(name, fallback = null) {
  await ensureTable();
  const [rows] = await db.query("SELECT value FROM app_settings WHERE name = ?", [name]);
  return rows.length ? JSON.parse(rows[0].value) : fallback;
}

/** Calls getStrict every 5 s until the database answers, then hands the value to onLoad. */
function loadWhenReady(name, fallback, onLoad) {
  getStrict(name, fallback).then(onLoad, (err) => {
    console.warn(`[Settings] ${name} not loaded yet (${err.message}); retrying in 5 s`);
    setTimeout(() => loadWhenReady(name, fallback, onLoad), 5000).unref();
  });
}

async function set(name, value, actor = null) {
  await ensureTable();
  await db.query(
    `INSERT INTO app_settings (name, value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
    [name, JSON.stringify(value), actor]
  );
}

module.exports = { get, getStrict, loadWhenReady, set };

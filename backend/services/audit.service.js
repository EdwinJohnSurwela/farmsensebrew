/**
 * Audit Service — records account/user management events for the
 * admin Audit Log screen. Table is auto-created on first use.
 */
const db = require("./db.service");

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action VARCHAR(40) NOT NULL,
      actor VARCHAR(60) DEFAULT NULL,
      target VARCHAR(80) DEFAULT NULL,
      details VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableReady = true;
}

/**
 * Record an audit event. Never throws — auditing must not break the action.
 * @param {string} action e.g. USER_CREATED, USER_UPDATED, USER_DELETED,
 *                        PASSWORD_CHANGED, PASSWORD_RESET, ACCESS_GRANTED,
 *                        ACCESS_REVOKED, LOGIN
 * @param {string} actor  username performing the action
 * @param {string} target username/entity affected
 * @param {string} details free text
 */
async function record(action, actor, target, details) {
  try {
    await ensureTable();
    await db.query(
      "INSERT INTO audit_log (action, actor, target, details) VALUES (?, ?, ?, ?)",
      [action, actor || null, target || null, details || null]
    );
  } catch (err) {
    console.warn("[Audit] failed to record:", err.message);
  }
}

async function list(limit = 100) {
  await ensureTable();
  const [rows] = await db.query(
    "SELECT id, action, actor, target, details, created_at FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?",
    [limit]
  );
  return rows;
}

module.exports = { record, list };

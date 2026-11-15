/**
 * Password Reset Request Service — admin-approved password changes.
 *
 * Flow: a user who forgot their password submits a request using their username. The admin sees pending requests in the Admin Dashboard and
 * approves or rejects. Once approved, the user can set a new password
 * from the login screen; the request is then marked completed (single use).
 *
 * Table is auto-created on first use (same pattern as audit.service).
 */
const db = require("./db.service");
const bcrypt = require("bcrypt");

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      status ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME DEFAULT NULL,
      decided_by VARCHAR(60) DEFAULT NULL,
      INDEX idx_prr_user (user_id),
      CONSTRAINT fk_prr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  tableReady = true;
}

/** Find an active user by username only. Returns row or null. */
async function findUser(identifier) {
  const [rows] = await db.query(
    "SELECT id, username, email, full_name, role FROM users WHERE username = ? AND is_active = 1",
    [identifier]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Create a pending request for the user behind `identifier`.
 * Returns { created } — or { existing } when a pending/approved request
 * is already open so we don't stack duplicates. Null when no such user.
 */
async function createRequest(identifier) {
  await ensureTable();
  const user = await findUser(identifier);
  if (!user) return null;
  const [open] = await db.query(
    "SELECT id, status FROM password_reset_requests WHERE user_id = ? AND status IN ('pending','approved') ORDER BY id DESC LIMIT 1",
    [user.id]
  );
  if (open.length > 0) return { existing: true, status: open[0].status, user };
  await db.query(
    "INSERT INTO password_reset_requests (user_id) VALUES (?)",
    [user.id]
  );
  return { created: true, user };
}

/** Latest request status for the account behind `identifier`. */
async function statusFor(identifier) {
  await ensureTable();
  const user = await findUser(identifier);
  if (!user) return { status: "none" };
  const [rows] = await db.query(
    "SELECT status, requested_at, decided_at FROM password_reset_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [user.id]
  );
  if (rows.length === 0) return { status: "none" };
  return { status: rows[0].status, requested_at: rows[0].requested_at, decided_at: rows[0].decided_at };
}

/**
 * Set the new password — only valid while an APPROVED request is open.
 * Marks the request completed (single use). Returns the username on
 * success, throws with a user-facing message otherwise.
 */
async function complete(identifier, newPassword) {
  await ensureTable();
  const user = await findUser(identifier);
  if (!user) throw new Error("No approved reset request for that account");
  const [rows] = await db.query(
    "SELECT id FROM password_reset_requests WHERE user_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 1",
    [user.id]
  );
  if (rows.length === 0) throw new Error("No approved reset request for that account");
  const hash = await bcrypt.hash(newPassword, 10);
  await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, user.id]);
  await db.query(
    "UPDATE password_reset_requests SET status = 'completed' WHERE id = ?",
    [rows[0].id]
  );
  return user.username;
}

/** Admin list — newest first, joined with account details. */
async function listForAdmin(limit = 50) {
  await ensureTable();
  const [rows] = await db.query(
    `SELECT r.id, r.status, r.requested_at, r.decided_at, r.decided_by,
            u.username, u.full_name, u.email, u.role
     FROM password_reset_requests r
     JOIN users u ON u.id = r.user_id
     ORDER BY r.status = 'pending' DESC, r.id DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

/** Admin decision. Returns the affected username, or null when not pending. */
async function decide(requestId, approve, adminUsername) {
  await ensureTable();
  const [rows] = await db.query(
    `SELECT r.id, r.status, u.username
     FROM password_reset_requests r JOIN users u ON u.id = r.user_id
     WHERE r.id = ?`,
    [requestId]
  );
  if (rows.length === 0) return null;
  if (rows[0].status !== "pending") return null;
  await db.query(
    "UPDATE password_reset_requests SET status = ?, decided_at = NOW(), decided_by = ? WHERE id = ?",
    [approve ? "approved" : "rejected", adminUsername, requestId]
  );
  return rows[0].username;
}

module.exports = { createRequest, statusFor, complete, listForAdmin, decide };

/**
 * FarmSense Brew — Sign-in sessions
 * File: backend/services/session.service.js
 *
 * One active session per account. users.session_version is copied into each
 * token (sv); raising it ends every older token at once. users.active_session_at
 * is the last time the signed-in device was seen, so a closed tab stops
 * blocking a new sign-in after SESSION_IDLE_MS.
 */
const db = require("./db.service");

// A session counts as "in use" only if its device was seen this recently.
// An open web app tab is seen at least every 30 s through its live connection.
const SESSION_IDLE_MS = 2 * 60 * 1000;
const TOUCH_EVERY_MS = 30 * 1000;
const SV_CACHE_MS = 5000;

const svCache = new Map();   // userId -> { sv, at }
const lastTouch = new Map(); // userId -> ms

async function currentVersion(userId) {
  const hit = svCache.get(userId);
  if (hit && Date.now() - hit.at < SV_CACHE_MS) return hit.sv;
  const [rows] = await db.query("SELECT session_version FROM users WHERE id = ?", [userId]);
  const sv = rows.length > 0 ? (rows[0].session_version || 0) : 0;
  svCache.set(userId, { sv, at: Date.now() });
  return sv;
}

/** Ends every existing token of this account. Returns the new version. */
async function bumpVersion(userId) {
  await db.query("UPDATE users SET session_version = COALESCE(session_version, 0) + 1 WHERE id = ?", [userId]);
  svCache.delete(userId);
  lastTouch.delete(userId);
  return currentVersion(userId);
}

/** The signed-in device was just seen (at most one write per 30 s). */
function touch(userId) {
  const now = Date.now();
  if (now - (lastTouch.get(userId) || 0) < TOUCH_EVERY_MS) return;
  lastTouch.set(userId, now);
  db.query("UPDATE users SET active_session_at = NOW() WHERE id = ?", [userId]).catch(() => {});
}

/** Session released: the next sign-in on any device is not blocked. */
async function release(userId) {
  lastTouch.delete(userId);
  await db.query("UPDATE users SET active_session_at = NULL WHERE id = ?", [userId]);
}

/** Milliseconds since the account's device was last seen, or null if none. */
function idleMs(activeSessionAt) {
  if (!activeSessionAt) return null;
  const t = new Date(activeSessionAt).getTime();
  return Number.isFinite(t) ? Math.max(0, Date.now() - t) : null;
}

const isInUse = (activeSessionAt) => {
  const idle = idleMs(activeSessionAt);
  return idle != null && idle < SESSION_IDLE_MS;
};

module.exports = { SESSION_IDLE_MS, currentVersion, bumpVersion, touch, release, idleMs, isInUse };

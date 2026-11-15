/**
 * CLR alerts as episodes, and the actions people record to close them.
 *
 * One open alert per node. While a node stays at risk, that alert is updated
 * (last seen, peak humidity) instead of a new one every hour. Levels follow the
 * five CLR bands (clr-risk.js): MINIMAL and LOW never alert; MODERATE, HIGH and
 * CRITICAL do. An alert that gets worse (MODERATE -> HIGH -> CRITICAL) is raised
 * and notifies again. MODERATE alerts close by themselves after 2 hours of the
 * node reporting below MODERATE; HIGH and CRITICAL alerts stay open until someone
 * records what they did (an infection may have started even if the weather
 * improved), with one reminder after 12 hours.
 *
 * Recording an action closes the node's open alert and starts a quiet period
 * whose length depends on the action. During it the node raises no new alert
 * at the same or a lower level; a worse level (for example HIGH -> CRITICAL) still alerts.
 * Dashboards keep showing the live risk the whole time: only alerts pause.
 */
const db = require("./db.service");
const live = require("./live.service");
const audit = require("./audit.service");
const presence = require("./presence.service");
const clr = require("./clr-risk");

const LEVEL = Object.fromEntries(clr.LEVELS.map((l, i) => [l, i]));   // MINIMAL 0 .. CRITICAL 4
const needsAction = (level) => clr.rank(level) >= clr.ACTION_FROM;    // HIGH, CRITICAL
const MODERATE_CLEARS_AFTER_MS = 2 * 3600000;
const HIGH_REMINDER_AFTER_MS = 12 * 3600000;
const SWEEP_EVERY_MS = 5 * 60000;

// What people can record, and how long each keeps the node quiet.
// Starting values (not from the manuscript); one line each to change.
const ACTIONS = {
  inspected_none: { label: "Inspected, no rust found", quietHours: 24 },
  removed_leaves: { label: "Found rust, removed infected leaves", quietHours: 72 },
  // Retired 17 Oct 2026: the farm uses no non-organic sprays. Kept only so older
  // records still show their label; it can no longer be chosen or recorded.
  fungicide: { label: "Applied fungicide (copper)", quietHours: 168, retired: true },
  pruned: { label: "Pruned or cleared for air flow", quietHours: 168 },
  false_alarm: { label: "False alarm / sensor problem", quietHours: 24, roles: ["agronomist"] },
  other: { label: "Other", quietHours: 24 },
};
const RESOLVER_ROLES = ["agronomist", "field_staff"];

function message(level, node_id, temperature, humidity) {
  if (level === "CRITICAL")
    return `CLR risk CRITICAL at ${node_id}: ${temperature}°C and ${humidity}% humidity, leaves likely wet. Inspect leaf undersides now, withhold irrigation and tell the agronomist.`;
  if (level === "HIGH")
    return `CLR risk HIGH at ${node_id}: ${temperature}°C and ${humidity}% humidity favor leaf rust and leaves may be damp. Inspect leaf undersides and withhold irrigation.`;
  return `CLR risk MODERATE at ${node_id}: ${temperature}°C and ${humidity}% humidity are nearing the rust-favorable range. Re-check within 4 hours.`;
}

let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(`ALTER TABLE clr_alerts
        ADD COLUMN IF NOT EXISTS last_seen_at DATETIME NULL,
        ADD COLUMN IF NOT EXISTS peak_humidity DECIMAL(5,2) NULL,
        ADD COLUMN IF NOT EXISTS closed_reason VARCHAR(20) NULL,
        ADD COLUMN IF NOT EXISTS merged_into INT NULL,
        ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(60) NULL,
        ADD COLUMN IF NOT EXISTS reminded_at DATETIME NULL`);
      await db.query(`CREATE TABLE IF NOT EXISTS alert_actions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        node_id VARCHAR(20) NOT NULL,
        alert_id INT NULL,
        risk_level VARCHAR(10) NULL,
        action VARCHAR(30) NOT NULL,
        note TEXT NOT NULL,
        done_by VARCHAR(60) NOT NULL,
        role VARCHAR(20) NULL,
        temperature DECIMAL(5,2) NULL,
        humidity DECIMAL(5,2) NULL,
        soil_pct INT NULL,
        alert_started_at DATETIME NULL,
        quiet_until DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_node_time (node_id, created_at)
      )`);
    })().catch((err) => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

async function openAlert(node_id) {
  const [rows] = await db.query(
    `SELECT * FROM clr_alerts WHERE node_id = ? AND is_resolved = 0
     ORDER BY FIELD(risk_level, 'CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'MINIMAL'), id DESC LIMIT 1`, [node_id]);
  return rows[0] || null;
}

async function activeQuiet(node_id) {
  const [rows] = await db.query(
    "SELECT * FROM alert_actions WHERE node_id = ? AND quiet_until > ? ORDER BY id DESC LIMIT 1",
    [node_id, new Date()]);
  return rows[0] || null;
}

/** Called for every saved reading with the level that held for the whole minute. */
async function handleRisk(node_id, level, { temperature, humidity, soil_pct }) {
  const lv = LEVEL[level] ?? 0;
  if (lv < clr.ALERT_FROM) return;            // MINIMAL, LOW: no alert; clearing needs 2 h of calm, see sweep()
  await ensureSchema();
  const now = new Date();
  const open = await openAlert(node_id);
  if (open) {
    if (lv > LEVEL[open.risk_level]) {         // got worse: raise the same alert and notify
      await db.query(
        `UPDATE clr_alerts SET risk_level = ?, alert_message = ?, temperature = ?, humidity = ?, soil_pct = ?,
           last_seen_at = ?, peak_humidity = GREATEST(COALESCE(peak_humidity, 0), ?), reminded_at = NULL
         WHERE id = ?`,
        [level, message(level, node_id, temperature, humidity), temperature, humidity, soil_pct, now, humidity, open.id]);
      console.log(`[Alerts] ${node_id} raised to ${level} (alert ${open.id})`);
      live.broadcast("alert", { node_id, level, kind: "raised" });
    } else {
      await db.query(
        "UPDATE clr_alerts SET last_seen_at = ?, peak_humidity = GREATEST(COALESCE(peak_humidity, 0), ?) WHERE id = ?",
        [now, humidity, open.id]);
    }
    return;
  }
  const quiet = await activeQuiet(node_id);
  if (quiet && lv <= (LEVEL[quiet.risk_level] ?? LEVEL.CRITICAL)) return;   // quiet period after an action
  const [res] = await db.query(
    `INSERT INTO clr_alerts (node_id, risk_level, temperature, humidity, soil_pct, alert_message, is_resolved,
       created_at, last_seen_at, peak_humidity)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [node_id, level, temperature, humidity, soil_pct, message(level, node_id, temperature, humidity), now, now, humidity]);
  console.log(`[Alerts] ${level} CLR alert ${res.insertId} opened for ${node_id}`);
  live.broadcast("alert", { node_id, level, kind: "new" });
}

/** Every 5 minutes: close calm MODERATE alerts, remind about HIGH and CRITICAL alerts nobody acted on. */
async function sweep() {
  await ensureSchema();
  const now = Date.now();
  const [open] = await db.query("SELECT * FROM clr_alerts WHERE is_resolved = 0");
  for (const a of open) {
    const lastSeen = new Date(a.last_seen_at || a.created_at).getTime();
    if (a.risk_level === "MODERATE" && now - lastSeen >= MODERATE_CLEARS_AFTER_MS && presence.isOnline(a.node_id)) {
      await db.query(
        "UPDATE clr_alerts SET is_resolved = 1, resolved_at = ?, closed_reason = 'cleared' WHERE id = ?", [new Date(), a.id]);
      console.log(`[Alerts] MODERATE alert ${a.id} for ${a.node_id} cleared on its own`);
      live.broadcast("alert", { node_id: a.node_id, kind: "cleared" });
    } else if (needsAction(a.risk_level) && !a.reminded_at && now - new Date(a.created_at).getTime() >= HIGH_REMINDER_AFTER_MS) {
      await db.query("UPDATE clr_alerts SET reminded_at = ? WHERE id = ?", [new Date(), a.id]);
      console.log(`[Alerts] reminder: ${a.risk_level} alert ${a.id} for ${a.node_id} has no action after 12 h`);
      live.broadcast("alert", { node_id: a.node_id, level: a.risk_level, kind: "reminder" });
    }
  }
}

/**
 * Someone records what they did about a node's open alert. Closes the node's
 * open alert(s) and starts that action's quiet period. Returns the action row.
 */
async function recordAction(node_id, { action, note }, user) {
  await ensureSchema();
  const def = ACTIONS[action];
  const fail = (status, msg) => Object.assign(new Error(msg), { status });
  if (!RESOLVER_ROLES.includes(user.role)) throw fail(403, "Only the agronomist or field staff record actions");
  if (!def || def.retired) throw fail(400, "Pick what was done");
  if (def.roles && !def.roles.includes(user.role)) throw fail(403, "Only the agronomist can record a false alarm");
  const text = String(note || "").trim();
  if (text.length < 5) throw fail(400, "Write a short note about what you did or saw");
  if (text.length > 500) throw fail(400, "Keep the note under 500 characters");
  const open = await openAlert(node_id);
  if (!open) throw fail(409, "This node has no open alert");

  const now = new Date();
  const quietUntil = new Date(now.getTime() + def.quietHours * 3600000);
  const [res] = await db.query(
    `INSERT INTO alert_actions (node_id, alert_id, risk_level, action, note, done_by, role, temperature, humidity,
       soil_pct, alert_started_at, quiet_until, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [node_id, open.id, open.risk_level, action, text, user.username, user.role, open.temperature, open.humidity,
     open.soil_pct, open.created_at, quietUntil, now]);
  await db.query(
    `UPDATE clr_alerts SET is_resolved = 1, resolved_at = ?, closed_reason = 'action', resolved_by = ?
     WHERE node_id = ? AND is_resolved = 0`, [now, user.username, node_id]);
  audit.record("ALERT_ACTION", user.username, node_id, `${def.label}: ${text}`.slice(0, 250));
  live.broadcast("alert", { node_id, kind: "resolved" });
  return { id: res.insertId, node_id, action, label: def.label, note: text, quiet_until: quietUntil };
}

const actionTypes = () => Object.entries(ACTIONS).map(([key, a]) => ({
  key, label: a.label, quietHours: a.quietHours, roles: a.roles || RESOLVER_ROLES, retired: !!a.retired,
}));

async function recentActions({ limit = 10, node_id = null } = {}) {
  await ensureSchema();
  const [rows] = await db.query(
    `SELECT * FROM alert_actions ${node_id ? "WHERE node_id = ?" : ""} ORDER BY id DESC LIMIT ?`,
    node_id ? [node_id, limit] : [limit]);
  return rows.map((r) => ({ ...r, label: (ACTIONS[r.action] || {}).label || r.action }));
}

function start() {
  const run = () => sweep().catch((err) => console.warn("[Alerts] sweep failed:", err.message));
  setInterval(run, SWEEP_EVERY_MS).unref();
  setTimeout(run, 30000).unref();
}

module.exports = { handleRisk, recordAction, actionTypes, recentActions, ensureSchema, start, ACTIONS };

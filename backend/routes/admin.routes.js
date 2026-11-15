/**
 * FarmSense Brew — Admin Routes (user management + audit log)
 * Mounted at /api/admin behind authenticateToken + admin-role check.
 *
 * GET    /users          → all users
 * POST   /users          → create user { username, password, role, full_name, email }
 * PUT    /users/:id      → update fields; { password } changes the password
 * DELETE /users/:id      → remove user
 * GET    /audit-log      → recent audit events
 */
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../services/db.service");
const audit = require("../services/audit.service");
const devices = require("../services/device.service");
const router = express.Router();

const VALID_ROLES = ["admin", "agronomist", "farm_owner", "field_staff"];

// All routes here require the admin role
router.use((req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
});

// ---- Shut the server down (so it can be unplugged safely) or restart it ----
// The api runs in a rootless container and cannot power the Pi off itself.
// It writes a request file into its data volume; farmsense-shutdown.path on
// the Pi (deploy/pi/) watches for it, deletes it and runs `systemctl poweroff`
// (or `systemctl reboot` when the request says "action":"restart").
// Requests older than 2 minutes are ignored there, so a leftover file can
// never switch the Pi off again at the next boot.
const fs = require("fs");
const path = require("path");
const CONTROL_DIR = process.env.CONTROL_DIR || path.join(__dirname, "..", "data", "control");
// What the Pi's watcher did with the last request: { at, result, reason } or null.
const readShutdownResult = () => {
  try { return JSON.parse(fs.readFileSync(path.join(CONTROL_DIR, "shutdown.result"), "utf8")); }
  catch (_) { return null; }
};

// The container shares the Pi's kernel, so these are the Pi's own figures.
router.get("/server/status", (req, res) => {
  const os = require("os");
  let tempC = null;
  try {
    tempC = Math.round(parseInt(fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8"), 10) / 100) / 10;
  } catch (_) { /* not readable inside this container */ }
  res.json({
    model: "Raspberry Pi 4 Model B",
    uptime_seconds: Math.round(os.uptime()),
    load: os.loadavg().map((x) => Math.round(x * 100) / 100),
    cpus: os.cpus().length,
    memory_total_mb: Math.round(os.totalmem() / 1048576),
    memory_free_mb: Math.round(os.freemem() / 1048576),
    temperature_c: tempC,
    shutdown_result: readShutdownResult(),
  });
});

// Shut down and Restart share the one request file and watcher, so the two can
// never race; "action" tells farmsense-shutdown.sh which one to run.
const POWER = {
  shutdown: { audit: "SERVER_SHUTDOWN", detail: "Shut down from the Admin dashboard",
              done: "The server is shutting down.", fail: "The server could not start the shutdown" },
  restart: { audit: "SERVER_RESTART", detail: "Restarted from the Admin dashboard",
             done: "The server is restarting.", fail: "The server could not start the restart" },
  funnel: { audit: "SERVER_FUNNEL_RESTART", detail: "Public link (Tailscale Funnel) restarted from the Admin dashboard",
            done: "The public link is restarting.", fail: "The server could not restart the public link" },
};
const powerRequest = (action) => async (req, res) => {
  const p = POWER[action];
  try {
    fs.mkdirSync(CONTROL_DIR, { recursive: true });
    const prev = readShutdownResult();
    await audit.record(p.audit, req.user.username, "Raspberry Pi", p.detail);
    fs.writeFileSync(path.join(CONTROL_DIR, "shutdown.request"),
      JSON.stringify({ action, by: req.user.username, at: new Date().toISOString() }) + "\n");
    console.log(`[Admin] ${action} requested by ${req.user.username}`);
    res.status(202).json({ success: true, message: p.done, previous_result_at: prev ? prev.at : null });
  } catch (err) {
    console.error(`[Admin] ${action} request failed:`, err.message);
    res.status(500).json({ error: p.fail });
  }
};
router.post("/server/shutdown", powerRequest("shutdown"));
router.post("/server/restart", powerRequest("restart"));
router.post("/server/restart-funnel", powerRequest("funnel"));

// ---- Remove a node (admins only) ----
// Only a node that never collected data can be removed: no sensor box and no
// saved readings or alerts (for example one added by mistake with Scale Up).
// Readings are study data, so this route never deletes any.
router.delete("/nodes/:nodeId", async (req, res) => {
  const nodeId = String(req.params.nodeId || "").toUpperCase();
  if (!/^NODE_\d{2,}$/.test(nodeId)) return res.status(400).json({ error: "Not a node ID" });
  try {
    const [[node]] = await db.query("SELECT node_id FROM sensor_nodes WHERE node_id = ?", [nodeId]);
    if (!node) return res.status(404).json({ error: `${nodeId} does not exist` });
    const [[use]] = await db.query(`
      SELECT (SELECT COUNT(*) FROM node_devices WHERE node_id = ?) AS boxes,
             (SELECT COUNT(*) FROM sensor_readings WHERE node_id = ?) AS readings,
             (SELECT COUNT(*) FROM clr_alerts WHERE node_id = ?) AS alerts`, [nodeId, nodeId, nodeId]);
    if (Number(use.boxes)) {
      return res.status(409).json({ error: `${nodeId} has a sensor box. Release the box first.` });
    }
    if (Number(use.readings) || Number(use.alerts)) {
      return res.status(409).json({
        error: `${nodeId} has ${Number(use.readings)} saved readings and ${Number(use.alerts)} alerts. They are study data, so this node is kept.`,
      });
    }
    await db.query("DELETE FROM node_sensor_faults WHERE node_id = ?", [nodeId]).catch(() => {});
    await db.query("DELETE FROM calibration_params WHERE node_id = ?", [nodeId]).catch(() => {});
    await db.query("DELETE FROM sensor_nodes WHERE node_id = ?", [nodeId]);
    audit.record("NODE_DELETED", req.user.username, nodeId, "Removed in Admin, Sensor Boxes (no box, no readings)");
    console.log(`[Nodes] ${req.user.username} removed ${nodeId}`);
    res.json({ success: true, node_id: nodeId });
  } catch (err) {
    console.error("[Nodes] remove failed:", err.message);
    res.status(500).json({ error: "Failed to remove the node" });
  }
});

// ---- Sensor boxes (ESP32s registered by hardware ID) ----
router.get("/devices", async (req, res) => {
  try {
    res.json(await devices.list());
  } catch (err) {
    res.status(500).json({ error: "Failed to load sensor boxes" });
  }
});

router.post("/devices/:id/release", async (req, res) => {
  try {
    const r = await devices.release(req.params.id);
    if (!r) return res.status(404).json({ error: "Box not found" });
    audit.record("SENSOR_BOX_RELEASED", req.user.username, devices.prettyId(devices.normalizeId(req.params.id)),
      r.kind === "valve" ? "Valve box released" : `Released from ${r.node_id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to release the box" });
  }
});

router.post("/devices/:id/assign", async (req, res) => {
  try {
    const r = await devices.assign(req.params.id, req.body && req.body.node_id);
    audit.record("SENSOR_BOX_MOVED", req.user.username, devices.prettyId(devices.normalizeId(req.params.id)),
      `Moved from ${r.from} to ${r.to}`);
    res.json({ success: true, ...r });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to move the box" });
  }
});

router.post("/devices/:id/new-key", async (req, res) => {
  try {
    const ok = await devices.newKey(req.params.id);
    if (!ok) return res.status(404).json({ error: "Box not found" });
    audit.record("SENSOR_BOX_NEW_KEY", req.user.username, devices.prettyId(devices.normalizeId(req.params.id)),
      "Box gets a new key when it next signs on");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset the key" });
  }
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, username, role, full_name, email, last_login, created_at, is_active
       FROM users ORDER BY FIELD(role,'admin','agronomist','farm_owner','field_staff'), full_name`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/admin/users
router.post("/users", async (req, res) => {
  const { username, password, role, full_name, email } = req.body;
  if (!username || !password || !role || !full_name) {
    return res.status(400).json({ error: "username, password, role and full_name are required" });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  try {
    const [existing] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users (username, password_hash, role, full_name, email, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW())`,
      [username, hash, role, full_name, email || null]
    );
    audit.record("USER_CREATED", req.user.username, username, `Created ${role} account for ${full_name}`);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("[Admin] create user failed:", err.message);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /api/admin/users/:id
router.put("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { username, full_name, email, role, password, is_active } = req.body;
  try {
    const [rows] = await db.query("SELECT username, role, is_active FROM users WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    const before = rows[0];

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
    }
    if (username && username !== before.username) {
      const [dupe] = await db.query("SELECT id FROM users WHERE username = ? AND id != ?", [username, id]);
      if (dupe.length > 0) return res.status(409).json({ error: "Username already taken" });
    }

    const updates = [];
    const params = [];
    if (username) { updates.push("username = ?"); params.push(username); }
    if (full_name) { updates.push("full_name = ?"); params.push(full_name); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email || null); }
    if (role) { updates.push("role = ?"); params.push(role); }
    if (is_active !== undefined) { updates.push("is_active = ?"); params.push(is_active ? 1 : 0); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      updates.push("password_hash = ?");
      params.push(await bcrypt.hash(password, 10));
    }
    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });

    params.push(id);
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    const target = username || before.username;
    if (password) {
      audit.record("PASSWORD_CHANGED", req.user.username, target, "Password changed by admin");
    }
    if (is_active !== undefined && !!is_active !== !!before.is_active) {
      audit.record(is_active ? "ACCESS_GRANTED" : "ACCESS_REVOKED", req.user.username, target,
        is_active ? "Account activated" : "Account deactivated");
    }
    const fieldChanges = [];
    if (username && username !== before.username) fieldChanges.push(`username ${before.username} -> ${username}`);
    if (role && role !== before.role) fieldChanges.push(`role ${before.role} -> ${role}`);
    if (full_name) fieldChanges.push("name/details updated");
    if (fieldChanges.length > 0) {
      audit.record("USER_UPDATED", req.user.username, target, fieldChanges.join("; "));
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[Admin] update user failed:", err.message);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  try {
    const [rows] = await db.query("SELECT username, full_name FROM users WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    await db.query("DELETE FROM users WHERE id = ?", [id]);
    audit.record("USER_DELETED", req.user.username, rows[0].username, `Deleted account of ${rows[0].full_name}`);
    res.json({ success: true });
  } catch (err) {
    console.error("[Admin] delete user failed:", err.message);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ─── PASSWORD RESET REQUESTS (admin approval) ─────────────────────
const resetRequests = require("../services/reset-request.service");

// GET /api/admin/reset-requests
router.get("/reset-requests", async (req, res) => {
  try {
    const rows = await resetRequests.listForAdmin(parseInt(req.query.limit) || 50);
    res.json({ data: rows });
  } catch (err) {
    console.error("[Admin] list reset-requests failed:", err.message);
    res.status(500).json({ error: "Failed to fetch reset requests" });
  }
});

// POST /api/admin/reset-requests/:id/approve | /reject
router.post("/reset-requests/:id/:decision", async (req, res) => {
  const { id, decision } = req.params;
  if (decision !== "approve" && decision !== "reject") {
    return res.status(400).json({ error: "Decision must be approve or reject" });
  }
  try {
    const username = await resetRequests.decide(parseInt(id), decision === "approve", req.user.username);
    if (!username) return res.status(404).json({ error: "Request not found or already decided" });
    audit.record(
      decision === "approve" ? "RESET_APPROVED" : "RESET_REJECTED",
      req.user.username, username,
      decision === "approve"
        ? "Password change request approved. The user can now set a new password."
        : "Password change request rejected"
    );
    res.json({ success: true, username });
  } catch (err) {
    console.error("[Admin] decide reset-request failed:", err.message);
    res.status(500).json({ error: "Failed to update request" });
  }
});

// GET /api/admin/audit-log
router.get("/audit-log", async (req, res) => {
  try {
    const rows = await audit.list(parseInt(req.query.limit) || 100);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

module.exports = router;

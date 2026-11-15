/**
 * FarmSense Brew — Sensor box registry
 * File: backend/services/device.service.js
 *
 * Every ESP32 is known by its hardware ID (the MAC burned into its chip), so
 * the same sketch can go on every board:
 *   - a new sensor box gets the lowest free node number (NODE_01, NODE_02, ...)
 *     and keeps it every time it reconnects;
 *   - the first time, the Pi also gives the box a secret key, which the box
 *     sends with every request, so another device cannot pretend to be it;
 *   - new boxes are only accepted while a node number is free; once every node
 *     has a box, an admin must release one first (Admin > Sensor Boxes);
 *   - the valve box registers the same way, as the one "valve" device.
 * Table is auto-created on first use.
 */
const crypto = require("crypto");
const db = require("./db.service");
const live = require("./live.service");
const presence = require("./presence.service");

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  // Match sensor_nodes.node_id's character set and collation, or joins on
  // node_id fail ("Illegal mix of collations") on databases whose default differs.
  const [c] = await db.query(`
    SELECT CHARACTER_SET_NAME AS cs, COLLATION_NAME AS coll FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sensor_nodes' AND COLUMN_NAME = 'node_id'
  `);
  const safe = (s, dflt) => (/^[A-Za-z0-9_]+$/.test(s || "") ? s : dflt);
  const cs = safe(c[0] && c[0].cs, "utf8mb4");
  const coll = safe(c[0] && c[0].coll, "utf8mb4_unicode_ci");
  await db.query(`
    CREATE TABLE IF NOT EXISTS node_devices (
      device_id  VARCHAR(16) NOT NULL PRIMARY KEY,
      kind       VARCHAR(10) NOT NULL DEFAULT 'node',
      node_id    VARCHAR(20) NULL UNIQUE,
      token_hash CHAR(64)    NULL,
      rekey      TINYINT(1)  NOT NULL DEFAULT 0,
      firmware   VARCHAR(40) NULL,
      last_ip    VARCHAR(45) NULL,
      first_seen DATETIME    DEFAULT CURRENT_TIMESTAMP,
      last_seen  DATETIME    NULL
    ) DEFAULT CHARSET=${cs} COLLATE=${coll}
  `);
  tableReady = true;
}

const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const makeToken = () => crypto.randomBytes(24).toString("hex");
const normalizeId = (x) => {
  const id = String(x || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  return id.length === 12 ? id : null;
};
const prettyId = (id) => (id || "").match(/.{2}/g)?.join(":") || id;
const nodeNum = (nodeId) => parseInt(String(nodeId || "").replace(/\D/g, ""), 10) || 0;
const nodeKey = (n) => `NODE_${String(n).padStart(2, "0")}`;

// Short-lived cache so relay polls (several per second) don't hit MySQL each time.
const CACHE_MS = 30000;
const cache = new Map();       // device_id -> row + at
const lastTouch = new Map();   // device_id -> ms
let countCache = { at: 0, node: 0, valve: 0 };
function forget(id) {
  cache.delete(id);
  countCache.at = 0;
}

/** Active node numbers that no box has claimed yet, lowest first. */
async function freeNodes() {
  await ensureTable();
  const [rows] = await db.query(`
    SELECT sn.node_id FROM sensor_nodes sn
    LEFT JOIN node_devices d ON d.node_id = sn.node_id
    WHERE sn.is_active = 1 AND d.device_id IS NULL
  `);
  return rows.map((r) => r.node_id).sort((a, b) => nodeNum(a) - nodeNum(b));
}

/** Record the last contact, at most once a minute per box. */
function touch(id, ip, firmware) {
  const now = Date.now();
  if (now - (lastTouch.get(id) || 0) < 60000) return;
  lastTouch.set(id, now);
  db.query(
    "UPDATE node_devices SET last_seen = NOW(), last_ip = ?, firmware = COALESCE(?, firmware) WHERE device_id = ?",
    [ip || null, firmware || null, id]
  ).catch(() => {});
}

/**
 * A board introduces itself. Returns { status, body }.
 * body: { device_id, kind, node_id, node, token? (first time or new key), note? }
 */
async function hello({ deviceId, kind, requestedNode, token, ip, firmware }) {
  await ensureTable();
  const id = normalizeId(deviceId);
  if (!id) return { status: 400, body: { error: "device_id must be the 12-character hardware ID of the board" } };
  kind = kind === "valve" ? "valve" : "node";
  const fw = firmware ? String(firmware).slice(0, 40) : null;

  const [rows] = await db.query("SELECT * FROM node_devices WHERE device_id = ?", [id]);
  const row = rows[0];
  if (row) {
    if (row.kind !== kind) {
      return { status: 409, body: { code: "WRONG_KIND",
        error: `Box ${prettyId(id)} is registered as a ${row.kind === "valve" ? "valve box" : "sensor box"}. Release it under Admin, Sensor Boxes first.` } };
    }
    let newToken;
    if (!row.token_hash || row.rekey) {
      newToken = makeToken();
      await db.query("UPDATE node_devices SET token_hash = ?, rekey = 0 WHERE device_id = ?", [hash(newToken), id]);
      forget(id);
    } else if (!token || hash(token) !== row.token_hash) {
      return { status: 401, body: { code: "KEY_MISMATCH",
        error: `Box ${prettyId(id)} is registered but its key does not match. An admin can give it a new key under Admin, Sensor Boxes.` } };
    }
    lastTouch.delete(id);
    touch(id, ip, fw);
    return { status: 200, body: { device_id: id, kind, node_id: row.node_id, node: nodeNum(row.node_id), ...(newToken ? { token: newToken } : {}) } };
  }

  // A board the Pi has never seen
  if (kind === "valve") {
    const [v] = await db.query("SELECT device_id FROM node_devices WHERE kind = 'valve'");
    if (v.length) {
      return { status: 409, body: { code: "VALVE_TAKEN",
        error: `Valve box ${prettyId(v[0].device_id)} is already registered. Release it under Admin, Sensor Boxes to use this board instead.` } };
    }
    const t = makeToken();
    await db.query(
      "INSERT INTO node_devices (device_id, kind, token_hash, firmware, last_ip, last_seen) VALUES (?, 'valve', ?, ?, ?, NOW())",
      [id, hash(t), fw, ip || null]
    );
    forget(id);
    console.log(`[Devices] new valve box ${prettyId(id)} registered`);
    live.broadcast("device", { device_id: id, kind: "valve", registered: true });
    return { status: 200, body: { device_id: id, kind, node_id: null, node: 0, token: t, registered: true } };
  }

  const free = await freeNodes();
  const wanted = requestedNode ? nodeKey(requestedNode) : null;
  const order = wanted && free.includes(wanted) ? [wanted, ...free.filter((n) => n !== wanted)] : free;
  for (const nodeId of order) {
    const t = makeToken();
    try {
      await db.query(
        "INSERT INTO node_devices (device_id, kind, node_id, token_hash, firmware, last_ip, last_seen) VALUES (?, 'node', ?, ?, ?, ?, NOW())",
        [id, nodeId, hash(t), fw, ip || null]
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") continue; // another box took this node a moment ago
      throw e;
    }
    forget(id);
    console.log(`[Devices] new sensor box ${prettyId(id)} registered as ${nodeId}`);
    live.broadcast("device", { device_id: id, kind: "node", node_id: nodeId, registered: true });
    const note = wanted && wanted !== nodeId ? `${wanted} already has a box, so this board became ${nodeId}` : undefined;
    return { status: 200, body: { device_id: id, kind, node_id: nodeId, node: nodeNum(nodeId), token: t, registered: true, ...(note ? { note } : {}) } };
  }
  return { status: 409, body: { code: "NO_FREE_NODE",
    error: "Every node already has a sensor box. To use this board, release a node under Admin, Sensor Boxes." } };
}

/** The box's row if the key is right, else null. */
async function authenticate(deviceId, token) {
  const id = normalizeId(deviceId);
  if (!id || !token) return null;
  let c = cache.get(id);
  if (!c || Date.now() - c.at > CACHE_MS) {
    await ensureTable();
    const [r] = await db.query("SELECT device_id, kind, node_id, token_hash, rekey FROM node_devices WHERE device_id = ?", [id]);
    if (!r.length) { cache.delete(id); return null; }
    c = { ...r[0], at: Date.now() };
    cache.set(id, c);
  }
  if (!c.token_hash || c.rekey || hash(token) !== c.token_hash) return null;
  return c;
}

/** True once at least one box of this kind has registered. */
async function hasRegistered(kind) {
  if (Date.now() - countCache.at > CACHE_MS) {
    await ensureTable();
    const [r] = await db.query("SELECT kind, COUNT(*) AS n FROM node_devices GROUP BY kind");
    countCache = { at: Date.now(), node: 0, valve: 0 };
    for (const x of r) countCache[x.kind] = Number(x.n);
  }
  return countCache[kind] > 0;
}

// ---------- Admin ----------
async function list() {
  await ensureTable();
  const [rows] = await db.query(`
    SELECT d.device_id, d.kind, d.node_id, d.firmware, d.last_ip, d.first_seen, d.last_seen,
           d.token_hash IS NOT NULL AND d.rekey = 0 AS has_key,
           sn.position,
           (SELECT MAX(sr.recorded_at) FROM sensor_readings sr WHERE sr.node_id = d.node_id) AS last_reading
    FROM node_devices d
    LEFT JOIN sensor_nodes sn ON sn.node_id = d.node_id
    ORDER BY d.kind = 'valve', d.node_id
  `);
  const heard = new Map(presence.snapshot().map((p) => [p.node_id, p]));
  return {
    data: rows.map((r) => {
      const p = r.node_id && heard.get(r.node_id);
      return {
        ...r,
        has_key: !!r.has_key,
        box_id: prettyId(r.device_id),
        online: !!(p && p.online),                  // decided by the Pi (presence.service)
        live: !!(p && p.live),                      // sends 2-second samples
        last_seen: p ? p.last_seen : r.last_seen,   // exact time of the last contact
      };
    }),
    free_nodes: await freeNodes(),
    nodes_without_box: await nodesWithoutBox(),
  };
}

/**
 * Active nodes no box has claimed, with how many readings each has saved.
 * Only one with no readings can be removed (Admin > Sensor Boxes); a node
 * with readings holds study data and is kept.
 */
async function nodesWithoutBox() {
  const [rows] = await db.query(`
    SELECT sn.node_id, sn.position, sn.description,
           (SELECT COUNT(*) FROM sensor_readings sr WHERE sr.node_id = sn.node_id) AS readings
    FROM sensor_nodes sn
    LEFT JOIN node_devices d ON d.node_id = sn.node_id
    WHERE sn.is_active = 1 AND d.device_id IS NULL
  `);
  return rows.map((r) => ({ ...r, readings: Number(r.readings) }))
    .sort((a, b) => nodeNum(a.node_id) - nodeNum(b.node_id));
}

async function release(deviceId) {
  const id = normalizeId(deviceId);
  await ensureTable();
  const [r] = await db.query("SELECT kind, node_id FROM node_devices WHERE device_id = ?", [id]);
  if (!r.length) return null;
  await db.query("DELETE FROM node_devices WHERE device_id = ?", [id]);
  forget(id);
  live.broadcast("device", { device_id: id, released: true });
  return r[0];
}

async function assign(deviceId, nodeId) {
  const id = normalizeId(deviceId);
  const target = nodeKey(nodeNum(nodeId));
  const free = await freeNodes();
  if (!free.includes(target)) {
    const e = new Error(`${target} already has a box or is not an active node`);
    e.status = 409;
    throw e;
  }
  const [r] = await db.query("SELECT kind, node_id FROM node_devices WHERE device_id = ?", [id]);
  if (!r.length) { const e = new Error("Box not found"); e.status = 404; throw e; }
  if (r[0].kind !== "node") { const e = new Error("The valve box has no node number"); e.status = 400; throw e; }
  await db.query("UPDATE node_devices SET node_id = ? WHERE device_id = ?", [target, id]);
  forget(id);
  live.broadcast("device", { device_id: id, node_id: target, moved: true });
  return { from: r[0].node_id, to: target };
}

/** The box gets a new key the next time it starts or reconnects. */
async function newKey(deviceId) {
  const id = normalizeId(deviceId);
  await ensureTable();
  const [res] = await db.query("UPDATE node_devices SET rekey = 1 WHERE device_id = ?", [id]);
  forget(id);
  return res.affectedRows > 0;
}

module.exports = { hello, authenticate, hasRegistered, touch, list, release, assign, newKey, normalizeId, prettyId };

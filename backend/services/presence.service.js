/**
 * FarmSense Brew — Node presence and live values
 * File: backend/services/presence.service.js
 *
 * The Pi decides whether a node is online. A sensor box with live firmware
 * sends its values every 2 s; after OFFLINE_AFTER_MS without contact the node
 * is offline. (A box cannot report losing power, so silence is the signal.)
 * Boxes with the older firmware only post every 5 minutes, so for them the
 * old 15-minute rule still applies.
 *
 * The two sensors in a box are followed separately: the air sensor (DHT22:
 * temperature + humidity) and the soil sensor. A box can keep answering while
 * one of them has stopped; that sensor's last good value is shown only for
 * SENSOR_FRESH_MS, then the node shows no value for it ("sensor problem")
 * while the other sensor keeps updating.
 *
 * Nothing here is stored: after an api restart every node starts offline and
 * comes back with its first sample.
 */
const live = require("./live.service");

const OFFLINE_AFTER_MS = 8000;               // live firmware: 4 missed samples
const LEGACY_OFFLINE_AFTER_MS = 15 * 60000;  // older firmware: 3 missed 5-minute posts
const SENSOR_FRESH_MS = 60000;               // 1 minute without a good value = sensor problem
const CHECK_EVERY_MS = 1000;
const { LEVELS } = require("./clr-risk");   // MINIMAL .. CRITICAL, in order

const nodes = new Map(); // node_id -> state

function timeoutFor(n) {
  return n.legacy ? LEGACY_OFFLINE_AFTER_MS : OFFLINE_AFTER_MS;
}

const fresh = (part, n, now) => !!(part && (n.legacy || now - part.at <= SENSOR_FRESH_MS));

function setOnline(node_id, n, online) {
  if (n.online === online) return;
  n.online = online;
  n.changedAt = Date.now();
  if (online) n.onlineSince = n.changedAt;
  live.broadcast("node_status", {
    node_id, online, last_seen: new Date(n.lastSeen).toISOString(),
  });
}

/**
 * Record contact from a node.
 *   air:  { temperature, humidity } when the DHT22 gave a good read, else null
 *   soil: { soil_pct, soil_raw } when the soil sensor gave a good read, else null
 *   risk: { level, score } from this air reading, or null
 * legacy = true for the older 5-minute firmware.
 */
function seen(node_id, air = null, soil = null, risk = null, { legacy = false } = {}) {
  const now = Date.now();
  let n = nodes.get(node_id);
  if (!n) {
    n = { online: false, lastSeen: now, onlineSince: now, air: null, soil: null, risk: null, lowestLevel: null };
    nodes.set(node_id, n);
  }
  n.lastSeen = now;
  n.legacy = legacy;
  if (air) {
    n.air = { temperature: air.temperature, humidity: air.humidity, at: now };
    n.risk = risk;
    // Lowest risk level since the last saved reading: an alert needs the
    // level to hold for the whole minute, so one breath on the sensor does
    // not raise an alert.
    if (risk) {
      const i = LEVELS.indexOf(risk.level);
      n.lowestLevel = n.lowestLevel == null ? i : Math.min(n.lowestLevel, i);
    }
  }
  if (soil) n.soil = { soil_pct: soil.soil_pct, soil_raw: soil.soil_raw, at: now };
  setOnline(node_id, n, true);
  if (!legacy) live.broadcast("node_live", { node_id, at: new Date(now).toISOString(), ...current(n, now) });
}

/** What the screens may show for a node right now: fresh values only. */
function current(n, now = Date.now()) {
  const airOk = fresh(n.air, n, now);
  const soilOk = fresh(n.soil, n, now);
  return {
    air_ok: airOk,
    soil_ok: soilOk,
    temperature: airOk ? n.air.temperature : null,
    humidity: airOk ? n.air.humidity : null,
    clr_risk: airOk && n.risk ? n.risk.level : null,
    confidence_pct: airOk && n.risk ? n.risk.score : null,
    soil_pct: soilOk ? n.soil.soil_pct : null,
    soil_raw: soilOk ? n.soil.soil_raw : null,
  };
}

/** Lowest risk level seen since the last call (then starts over). */
function takeSustainedLevel(node_id) {
  const n = nodes.get(node_id);
  if (!n || n.lowestLevel == null) return null;
  const level = LEVELS[n.lowestLevel];
  n.lowestLevel = null;
  return level;
}

function isOnline(node_id) {
  const n = nodes.get(node_id);
  return !!(n && n.online);
}

/** Fresh air readings of the other nodes: [{ temperature, humidity }]. */
function othersAir(node_id, now = Date.now()) {
  const out = [];
  for (const [id, n] of nodes) {
    if (id !== node_id && n.online && fresh(n.air, n, now)) out.push({ temperature: n.air.temperature, humidity: n.air.humidity });
  }
  return out;
}

/** Fresh values of one node (for saving the minute's reading), or null. */
function freshValues(node_id) {
  const n = nodes.get(node_id);
  return n ? current(n) : null;
}

/**
 * For the fault log: how long each sensor of an online node has gone without
 * a good value (ms), and whether it has given one at all since the box came
 * online (after an api restart nothing has been seen yet). A sensor that has
 * not given one since the box came online counts from then.
 */
function sensorSilence(node_id, now = Date.now()) {
  const n = nodes.get(node_id);
  if (!n || !n.online || n.legacy) return null;
  const since = (part) => now - Math.max(part ? part.at : 0, n.onlineSince || now);
  return { air: since(n.air), soil: since(n.soil), airSeen: !!n.air, soilSeen: !!n.soil };
}

/** Current state of every node the Pi has heard from since it started. */
function snapshot() {
  const now = Date.now();
  return [...nodes.entries()].map(([node_id, n]) => {
    const c = current(n, now);
    const any = n.online && (c.air_ok || c.soil_ok);
    return {
      node_id,
      online: n.online,
      live: !n.legacy,
      last_seen: new Date(n.lastSeen).toISOString(),
      age_s: Math.round((now - n.lastSeen) / 1000),
      air_ok: n.online && c.air_ok,
      soil_ok: n.online && c.soil_ok,
      // null when the box is offline or neither sensor is reading
      values: any ? {
        temperature: c.temperature,
        humidity: c.humidity,
        soil_pct: c.soil_pct,
        soil_raw: c.soil_raw,
        clr_risk: c.clr_risk,
        confidence_pct: c.confidence_pct,
        at: new Date(Math.max(c.air_ok ? n.air.at : 0, c.soil_ok ? n.soil.at : 0)).toISOString(),
      } : null,
    };
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [node_id, n] of nodes) {
    if (n.online && now - n.lastSeen > timeoutFor(n)) setOnline(node_id, n, false);
  }
}, CHECK_EVERY_MS).unref();

module.exports = {
  OFFLINE_AFTER_MS, SENSOR_FRESH_MS, seen, isOnline, snapshot, takeSustainedLevel, freshValues, sensorSilence, othersAir,
};

import { parseTimestamp, formatTimestamp } from './time';
// One list of the farm's sensor nodes for every screen: each registered node
// merged with its latest values. The Pi decides whether a node is online
// (a live box is offline about 8 s after its last sample), so a wrong phone
// clock cannot turn a node grey or green. Offline nodes (including registered
// nodes that have never reported) are shown grey everywhere.
import { api, toNum, riskColor } from './api';
import { mergeLive, useNodeLive } from './live';

// How often screens without live push re-fetch (Owner map fallback).
export const LIVE_POLL_MS = 5000;
export const OFFLINE_GREY = '#9CA3AF';

const POSITION_LABEL = {
  NW_CORNER: 'NW',
  NE_CORNER: 'NE',
  CENTER: 'Centre',
  SW_CORNER: 'SW',
  SE_CORNER: 'SE',
};

function toNode(reg, r, fetchedAt) {
  const num = parseInt(String(reg.node_id).replace(/\D/g, ''), 10) || 0;
  const pos = POSITION_LABEL[reg.position] || '';
  // The air sensor (temperature + humidity) and the soil sensor are shown on
  // their own: one can stop while the other keeps reading.
  const hasAir = !!r && r.temperature != null && r.humidity != null;
  const hasSoil = !!r && r.soil_pct != null;
  const box = !!r?.online;
  const seen = r?.last_seen ? parseTimestamp(r.last_seen)?.getTime() : NaN;
  return {
    nodeId: reg.node_id,
    num,
    name: `Node ${num}${pos ? ` (${pos})` : ''}`,
    short: `N${num}${pos ? ` ${pos}` : ''}`,
    position: pos,
    latitude: reg.latitude,
    longitude: reg.longitude,
    hasReading: !!r && (r.recorded_at != null || hasAir || hasSoil),
    boxOnline: box,
    // Sending at least one live value. Risk needs the air sensor (hasRisk).
    online: box && (hasAir || hasSoil),
    hasRisk: box && hasAir,
    airFault: box && !hasAir,
    soilFault: box && !hasSoil,
    live: !!r?.live,
    lastSeen: Number.isFinite(seen) ? new Date(seen) : null,
    lastReading: r?.recorded_at ? parseTimestamp(r.recorded_at) : null,
    // Values only from a live box: an offline node shows "—", never an old value.
    temperature: box && hasAir ? toNum(r.temperature) : null,
    humidity: box && hasAir ? toNum(r.humidity) : null,
    soil: box && hasSoil ? toNum(r.soil_pct) : null,
    risk: box && hasAir ? r.clr_risk || 'MINIMAL' : null,
    score: box && hasAir && r.confidence_pct != null ? toNum(r.confidence_pct) : null,
    raw: r,
    reg,
    fetchedAt,
  };
}

export async function loadNodes() {
  const fetchedAt = Date.now();
  const [reg, latest] = await Promise.all([api.scaleUp(), api.sensorLatest()]);
  const byId = {};
  for (const s of latest.data || []) byId[s.node_id] = s;
  return (reg.nodes || [])
    .filter((n) => n.status === 'ACTIVE')
    .map((n) => toNode(n, byId[n.node_id] || null, fetchedAt))
    .sort((a, b) => a.num - b.num);
}

/** The loaded nodes, kept up to date by the Pi's 2-second pushes. */
export function useLiveNodes(list) {
  useNodeLive();
  return list.map((n) => {
    const r = mergeLive(n.raw || { node_id: n.nodeId, online: false }, n.fetchedAt);
    return r === n.raw ? n : toNode(n.reg, r, n.fetchedAt);
  });
}

export const SENSOR_PURPLE = '#5B2A86'; // dark purple: a sensor problem, not a risk level

/** Risk colour when it has one, dark grey for a sensor problem, grey when offline. */
export const nodeColor = (n) => (n.hasRisk ? riskColor(n.risk) : n.boxOnline ? SENSOR_PURPLE : OFFLINE_GREY);

/** Average of a field over online nodes only; null when none are online. */
export function onlineAvg(nodes, key) {
  const on = nodes.filter((n) => n.online && n[key] != null);
  return on.length ? on.reduce((a, n) => a + n[key], 0) / on.length : null;
}

/**
 * Which sensor of an online box is not reading, or null when both are.
 *   short:  for chips and map labels ("Temperature and humidity sensor problem")
 *   brief:  for one-line status lists ("Temperature and humidity sensor not reading")
 *   sensor: the sensor's name, shown under "Sensor problem"
 *   full:   a sentence for tooltips and detail lines
 */
export function sensorProblem(n) {
  if (!n.boxOnline) return null;
  if (n.airFault && n.soilFault) {
    return { short: 'Both sensors not reading', sensor: 'Temperature and humidity sensor and soil moisture sensor', brief: 'Temperature, humidity and soil sensors not reading',
      full: 'Temperature and humidity sensor and soil moisture sensor not reading' };
  }
  if (n.airFault) {
    return { short: 'Temperature and humidity sensor problem', sensor: 'Temperature and humidity sensor', brief: 'Temperature and humidity sensor not reading',
      full: 'Temperature and humidity sensor not reading' };
  }
  if (n.soilFault) {
    return { short: 'Soil sensor problem', sensor: 'Capacitive soil moisture sensor', brief: 'Soil sensor not reading',
      full: 'Capacitive soil moisture sensor not reading' };
  }
  return null;
}

/** What to show in place of a risk level: which sensor has a problem, or "Offline". */
export const offlineWord = (n) => sensorProblem(n)?.short || 'Offline';

/** Sentence naming the sensor that is not reading; null when both read. */
export const sensorNote = (n) => sensorProblem(n)?.full || null;

/** A value with its decimals, or "—" when that sensor is not reading. */
export const fmt = (v, d = 0) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));

/** Last contact or last valid reading, shown in Philippine time. */
export function lastSeenLabel(n) {
  const at = n.boxOnline && !n.online ? n.lastReading : n.lastSeen;
  return at ? formatTimestamp(at) : 'No readings yet';
}

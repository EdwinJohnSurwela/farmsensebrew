/**
 * Scheduler Service — manages irrigation schedules and triggers relays
 */
const db = require('./db.service');
const relay = require('./relay.service');
const riskState = require('./risk-state.service');
const valves = require('./valves');

// In-memory schedules and timers
const schedules = new Map(); // id -> schedule
const timers = new Map();    // id -> {onTimer, offTimer}
let memCounter = -1;

function secondsUntil(date) {
  return Math.max(0, date.getTime() - Date.now());
}

function parseNodeId(nodeId) {
  if (nodeId == null) return null;
  if (typeof nodeId === 'number') return nodeId;
  const s = String(nodeId).toUpperCase();
  const m = s.match(/NODE[_-]?(\d+)/i);
  if (m) return parseInt(m[1], 10);
  const digits = s.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
}

function computeNextRun(timeStr, days, dates) {
  // timeStr: "HH:MM" (24h) or "HH:MM:SS"
  const parts = timeStr.split(':').map(Number);
  const now = new Date();
  const candidates = [];

  // Specific calendar dates ("YYYY-MM-DD") take priority when present
  if (Array.isArray(dates)) {
    for (const dateStr of dates) {
      const d = new Date(`${dateStr}T00:00:00`);
      if (isNaN(d.getTime())) continue;
      d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
      if (d > now) candidates.push(d);
    }
  }

  // Recurring days of week (1=Mon .. 7=Sun, also accepts 0-6 or names)
  if (Array.isArray(days) && days.some(d => d != null)) {
    for (let offset = 0; offset < 7; offset++) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      candidate.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
      const dow = candidate.getDay(); // 0 Sun .. 6 Sat
      const dayNameIndex = dow === 0 ? 7 : dow; // map to 1..7 if schedule uses 1..7
      const matches = days.some(d => {
        if (d == null) return false;
        if (typeof d === 'number') return d === dow || d === dayNameIndex;
        return String(d).toLowerCase().startsWith(['sun','mon','tue','wed','thu','fri','sat'][dow]);
      });
      if (matches && candidate > now) { candidates.push(candidate); break; }
    }
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a < b ? a : b));
}

// days_of_week column may hold a plain array [1,2,3] or, when specific
// dates were chosen, an object {"days":[...],"dates":["YYYY-MM-DD",...]}
function parseDaysColumn(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (Array.isArray(parsed)) return { days: parsed.filter(d => d != null), dates: [] };
  if (parsed && typeof parsed === 'object') {
    return {
      days: Array.isArray(parsed.days) ? parsed.days.filter(d => d != null) : [],
      dates: Array.isArray(parsed.dates) ? parsed.dates : []
    };
  }
  return { days: [], dates: [] };
}

function encodeDaysColumn(days, dates) {
  if (Array.isArray(dates) && dates.length > 0) return JSON.stringify({ days: days || [], dates });
  return JSON.stringify(days || []);
}

// The api can start before MySQL accepts connections (UPDATE_PI.bat recreates
// the mysql container too), so a failed load is retried until it succeeds.
const LOAD_RETRY_MS = 5000;

/** Returns true once the active schedules are loaded from the DB. */
async function loadFromDb() {
  try {
    const [rows] = await db.query('SELECT * FROM irrigation_schedules WHERE active = 1');
    // Skip ids already in memory: re-adding one would reset its timers and
    // could cut a running schedule's OFF timer, leaving the valve open.
    rows.forEach(s => { if (!schedules.has(String(s.id))) addScheduleToMemory(s); });
    return true;
  } catch (err) {
    console.warn(`[Scheduler] DB load failed (retrying in ${LOAD_RETRY_MS / 1000}s):`, err.message);
    return false;
  }
}

function retryLoad() {
  setTimeout(async () => {
    if (await loadFromDb()) console.log('[Scheduler] loaded from DB after retry:', schedules.size, 'schedules');
    else retryLoad();
  }, LOAD_RETRY_MS);
}

function clearTimers(id) {
  const key = String(id);
  const t = timers.get(key);
  if (!t) return;
  if (t.onTimer) clearTimeout(t.onTimer);
  if (t.offTimer) clearTimeout(t.offTimer);
  timers.delete(key);
}

function addScheduleToMemory(s) {
  // normalize
  const id = (typeof s.id !== 'undefined' && s.id !== null) ? s.id : (memCounter--);
  const key = String(id);
  let days, dates;
  if (Array.isArray(s.days) || Array.isArray(s.dates)) {
    days = (s.days || []).filter(d => d != null);
    dates = s.dates || [];
  } else {
    const parsed = parseDaysColumn(s.days ?? s.days_of_week);
    days = parsed.days;
    dates = parsed.dates;
  }
  // A row with no usable days and no dates would never fire — treat as daily
  if (days.length === 0 && dates.length === 0) days = [1,2,3,4,5,6,7];
  const time = s.time || s.schedule_time || '06:00';
  const duration = s.duration_seconds || s.duration || (s.duration_minutes ? s.duration_minutes*60 : 60);
  const rawNode = s.node_id || s.nodeId || s.node || 1;
  const node_numeric = parseNodeId(rawNode) || 1;
  const node_id = (typeof rawNode === 'string' && rawNode.toUpperCase().startsWith('NODE')) ? rawNode : `NODE_${String(node_numeric).padStart(2,'0')}`;
  const active = s.active === undefined ? true : !!s.active;
  const schedule = { id, node_id, node_numeric, days, dates, time, duration, active };
  schedules.set(key, schedule);
  scheduleNextRun(schedule);
  return schedule;
}

function scheduleNextRun(schedule) {
  clearTimers(schedule.id);
  if (!schedule.active) return;
  const next = computeNextRun(schedule.time, schedule.days, schedule.dates);
  if (!next) {
    // No future occurrence (e.g. all specific dates have passed) — mark done
    if (schedule.dates && schedule.dates.length > 0) {
      schedule.active = false;
      db.query('UPDATE irrigation_schedules SET active=0 WHERE id=?', [schedule.id])
        .catch(() => {});
      console.log(`[Scheduler] Schedule ${schedule.id} completed (no future dates), deactivated`);
    }
    return;
  }
  const wait = secondsUntil(next);
  const onTimer = setTimeout(() => {
    // Safety (FB-54): skip this run when CLR risk is HIGH or CRITICAL at any node the
    // valve waters (watering would accelerate leaf rust). Next occurrence still runs.
    const v = valves.ofNode(schedule.node_numeric);
    const highAt = (v ? v.nodes : [schedule.node_numeric]).filter((n) => riskState.isHigh(n));
    if (highAt.length) {
      console.warn(`[Scheduler] Schedule ${schedule.id} WITHHELD: CLR risk is HIGH or CRITICAL at node ${highAt.join(', ')}`);
      scheduleNextRun(schedule);
      return;
    }
    // Activate node (use numeric id for relay)
    console.log(`[Scheduler] FIRING schedule ${schedule.id}: node ${schedule.node_id} ON for ${schedule.duration}s`);
    relay.setState(schedule.node_numeric || schedule.node_id, true);
    // schedule off
    const offTimer = setTimeout(() => {
      relay.setState(schedule.node_numeric || schedule.node_id, false);
      console.log(`[Scheduler] Schedule ${schedule.id}: node ${schedule.node_id} OFF`);
      // Reschedule next occurrence
      scheduleNextRun(schedule);
    }, schedule.duration * 1000);
    timers.set(String(schedule.id), { onTimer: null, offTimer });
  }, wait);
  timers.set(String(schedule.id), { onTimer, offTimer: null });
  console.log(`[Scheduler] Scheduled ${schedule.id} node ${schedule.node_id} at ${next} for ${schedule.duration}s`);
}

function toApiShape(s) {
  const v = valves.ofNode(s.node_numeric);
  return {
    id: s.id,
    valve: v ? v.n : null,
    node_id: s.node_id,
    time: s.time,
    duration_seconds: s.duration,
    days_of_week: s.days || [],
    specific_dates: s.dates || [],
    is_active: !!s.active
  };
}

// Schedules are chosen per valve; the valve is stored as the node that opens it
// (its first node), so the valve box and the database stay per node.
function nodeForInput(data, fallback) {
  const v = valves.byNumber(data.valve);
  if (v) return valves.nodeIdFor(v);
  return data.node_id || fallback;
}

function normalizeInput(data) {
  // Flutter sends days_of_week / specific_dates / duration_seconds
  const days = (data.days || data.days_of_week || []).filter(d => d != null);
  const dates = data.specific_dates || data.dates || [];
  const duration_seconds = data.duration_seconds || (data.duration_minutes ? data.duration_minutes*60 : (data.duration_hours ? data.duration_hours*3600 : 60));
  return { days, dates, duration_seconds };
}

async function createSchedule(data) {
  // attempts DB insert; falls back to memory-only
  const { days, dates, duration_seconds } = normalizeInput(data);
  const time = data.time || '06:00';
  const daysJson = encodeDaysColumn(days, dates);
  const node_id = nodeForInput(data, 'NODE_01');
  try {
    const [res] = await db.query('INSERT INTO irrigation_schedules (node_id, schedule_time, duration_seconds, days_of_week, active) VALUES (?, ?, ?, ?, ?)', [node_id, time, duration_seconds, daysJson, 1]);
    const s = addScheduleToMemory({ id: res.insertId, node_id, days, dates, time, duration_seconds, active: true });
    return toApiShape(s);
  } catch (err) {
    console.warn('[Scheduler] createSchedule DB failed, storing in-memory:', err.message);
    const s = addScheduleToMemory({ id: memCounter--, node_id, days, dates, time, duration_seconds, active: true });
    return toApiShape(s);
  }
}

async function updateSchedule(id, data) {
  clearTimers(id);
  const { days, dates, duration_seconds } = normalizeInput(data);
  const time = data.time || '06:00';
  const daysJson = encodeDaysColumn(days, dates);
  const active = data.active === undefined ? true : !!data.active;
  const existing = schedules.get(String(id)) || {};
  const node_id = nodeForInput(data, existing.node_id || 'NODE_01');
  try {
    await db.query('UPDATE irrigation_schedules SET node_id=?, schedule_time=?, duration_seconds=?, days_of_week=?, active=? WHERE id=?', [node_id, time, duration_seconds, daysJson, active ? 1 : 0, id]);
  } catch (err) {
    console.warn('[Scheduler] updateSchedule DB failed, updating in-memory only:', err.message);
  }
  const s = addScheduleToMemory({ ...existing, id, node_id, days, dates, time, duration_seconds, active });
  return toApiShape(s);
}

async function deleteSchedule(id) {
  clearTimers(id);
  schedules.delete(String(id));
  try {
    await db.query('DELETE FROM irrigation_schedules WHERE id=?', [id]);
  } catch (err) {
    console.warn('[Scheduler] deleteSchedule DB failed:', err.message);
  }
}

function listSchedules() {
  return Array.from(schedules.values()).map(toApiShape);
}

async function start() {
  const loaded = await loadFromDb();
  console.log('[Scheduler] started with', schedules.size, 'schedules' + (loaded ? '' : ' (DB load pending)'));
  if (!loaded) retryLoad();
}

module.exports = { start, createSchedule, updateSchedule, deleteSchedule, listSchedules };

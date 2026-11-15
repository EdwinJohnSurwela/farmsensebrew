/**
 * Automatic watering — the system's own irrigation logic, one decision per valve.
 *
 * The rule (research defaults, adjustable after calibration at the plot):
 *   - FAO-56 (Allen et al., 1998, Table 22) gives coffee a depletion fraction
 *     p = 0.40: water once 40 % of the soil's available water is used up.
 *     Available water is the range between field capacity (FC) and wilting
 *     point (WP), so the refill point is  FC - 0.40 x (FC - WP)  and a run
 *     stops at field capacity (more than that drains away or waterlogs roots).
 *   - FC and WP are entered as readings on the probe's own 0-100 % scale.
 *     The starting values assume a clay loam like the volcanic soils around
 *     Lipa and San Jose; replace them with readings measured at the plot.
 *   - Never water a valve while any of its nodes has HIGH or CRITICAL Coffee Leaf Rust risk
 *     (extra moisture helps the rust spread). Not adjustable.
 *   - Water in daylight only (default 06:00-17:00, Philippine time): rust spores
 *     germinate on wet leaves in the dark, so no watering into the night.
 *   - One valve at a time, a maximum run time, and a rest between runs so the
 *     water can spread before the probes are read again.
 *   - Only trusted readings count: online nodes whose probe reads above 0 %.
 *     A probe at 0 % is usually out of the soil or not touching it, and must
 *     not make the system water forever.
 *
 * The Pi and the valve box work per node, so a valve is opened by switching on
 * its first node and closed by switching off every node on it.
 * Off until someone presses Enable on the Irrigation page, because the probes
 * need their dry and wet calibration first.
 */
const relay = require("./relay.service");
const riskState = require("./risk-state.service");
const presence = require("./presence.service");
const settingsStore = require("./settings.service");
const audit = require("./audit.service");

const { VALVES } = require("./valves");

const DEPLETION_FRACTION = 0.4;     // FAO-56 coffee
const MAX_RUN_CAP_MIN = parseInt(process.env.MAX_PUMP_RUNTIME_MINUTES, 10) || 30;
const DEFAULTS = {
  enabled: false,
  fieldCapacityPct: 45,
  wiltingPointPct: 25,
  maxRunMinutes: 15,
  minGapMinutes: 60,
  startTime: "06:00",
  endTime: "17:00",
};
const CHECK_EVERY_MS = 20000;
const SETTINGS_KEY = "auto_irrigation";

let settings = { ...DEFAULTS };
const state = {}; // valve n -> { auto, since, lastEnd, note, avg, used, skipped }
for (const v of VALVES) state[v.n] = { auto: false, since: null, lastEnd: 0, note: "Starting", avg: null, used: [], skipped: [] };

const refillPct = (s = settings) => Math.round(s.fieldCapacityPct - DEPLETION_FRACTION * (s.fieldCapacityPct - s.wiltingPointPct));
const targetPct = (s = settings) => Math.round(s.fieldCapacityPct);
/** "06:00" -> "6:00 AM" for the notes people read. */
const clock12 = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const minutesOf = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };

function manilaMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get("hour") * 60 + get("minute");
}
const inHours = () => {
  const now = manilaMinutes();
  return now >= minutesOf(settings.startTime) && now < minutesOf(settings.endTime);
};

const valveIsOn = (v) => v.nodes.some((n) => relay.getState(n));
const nodeName = (n) => `Node ${n}`;

function closeValve(v, reason) {
  for (const n of v.nodes) if (relay.getState(n)) relay.setState(n, false);
  const s = state[v.n];
  const mins = s.since ? Math.round((Date.now() - s.since) / 60000) : 0;
  s.auto = false;
  s.since = null;
  s.lastEnd = Date.now();
  console.log(`[AutoWater] Valve ${v.n} closed after ${mins} min: ${reason}`);
  audit.record("AUTO_WATER_OFF", "system", `Valve ${v.n}`, `${reason} (ran ${mins} min)`);
}

function openValve(v, avg) {
  relay.setState(v.nodes[0], true);
  const s = state[v.n];
  s.auto = true;
  s.since = Date.now();
  console.log(`[AutoWater] Valve ${v.n} opened: soil ${avg}% is below the refill point ${refillPct()}%`);
  audit.record("AUTO_WATER_ON", "system", `Valve ${v.n}`,
    `Soil ${avg}% below refill point ${refillPct()}%; stops at ${targetPct()}% or after ${settings.maxRunMinutes} min`);
}

/**
 * Soil readings for a valve that can be trusted, the ones left out (with why),
 * and the nodes whose CLR risk is unknown right now because their air sensor
 * is not reading (their soil reading is still used).
 */
function readingsFor(v) {
  const snap = new Map(presence.snapshot().map((x) => [x.node_id, x]));
  const used = [], skipped = [], riskUnknown = [];
  for (const n of v.nodes) {
    const id = `NODE_${String(n).padStart(2, "0")}`;
    const x = snap.get(id);
    const soil = x && x.soil_ok && x.values ? x.values.soil_pct : null;
    if (x && x.online && !x.air_ok) riskUnknown.push(n);
    if (!x || !x.online) skipped.push({ node: n, why: "offline" });
    else if (soil == null) skipped.push({ node: n, why: "soil sensor not reading" });
    else if (soil <= 0) skipped.push({ node: n, why: "probe reads 0 %: check it is in the soil" });
    else used.push({ node: n, soil: Number(soil) });
  }
  return { used, skipped, riskUnknown };
}

function evaluate() {
  const now = Date.now();
  const candidates = [];
  for (const v of VALVES) {
    const s = state[v.n];
    const on = valveIsOn(v);
    // Someone closed a valve the system had opened: respect that and rest.
    if (s.auto && !on) { s.auto = false; s.since = null; s.lastEnd = now; }

    const { used, skipped, riskUnknown } = readingsFor(v);
    s.used = used;
    s.skipped = skipped;
    s.avg = used.length ? Math.round(used.reduce((a, r) => a + r.soil, 0) / used.length) : null;
    const known = v.nodes.filter((n) => !riskUnknown.includes(n));
    const highRisk = known.filter((n) => riskState.isHigh(n));
    // No node on this valve can tell the CLR risk: do not water blind.
    const blind = known.length === 0;
    const riskText = () => blind
      ? `unknown (air sensor not reading at ${riskUnknown.map(nodeName).join(", ")})`
      : highRisk.map((n) => `${riskState.getRisk(n)} at ${nodeName(n)}`).join(", ");

    if (!settings.enabled) {
      if (s.auto) closeValve(v, "automatic watering was switched off");
      s.note = "Automatic watering is off";
      continue;
    }

    if (s.auto) {
      let reason = null;
      if (highRisk.length || blind) reason = `CLR risk is ${riskText()}`;
      else if (s.avg == null) reason = "no trusted soil reading left";
      else if (s.avg >= targetPct()) reason = `soil reached ${s.avg}% (target ${targetPct()}%)`;
      else if (now - s.since >= settings.maxRunMinutes * 60000) reason = `maximum run time of ${settings.maxRunMinutes} min`;
      else if (!inHours()) reason = `end of watering hours (${clock12(settings.endTime)})`;
      if (reason) { closeValve(v, reason); s.note = `Closed: ${reason}`; }
      else s.note = `Watering: soil ${s.avg}%, stops at ${targetPct()}% or after ${settings.maxRunMinutes} min`;
      continue;
    }

    if (on) { s.note = "Switched on by hand or a schedule; automatic leaves it alone"; continue; }
    if (s.avg == null) { s.note = "Waiting: no trusted soil reading"; continue; }
    if (highRisk.length || blind) { s.note = `Held back: CLR risk is ${riskText()}`; continue; }
    if (s.avg >= refillPct()) { s.note = `No water needed: soil ${s.avg}%, waters below ${refillPct()}%`; continue; }
    if (!inHours()) { s.note = `Soil ${s.avg}% needs water; waits for watering hours (${clock12(settings.startTime)})`; continue; }
    const restLeft = Math.ceil((s.lastEnd + settings.minGapMinutes * 60000 - now) / 60000);
    if (restLeft > 0) { s.note = `Soil ${s.avg}% needs water; resting ${restLeft} more min after the last run`; continue; }
    candidates.push(v);
  }

  // One valve at a time: nothing opens while any valve is running.
  if (!settings.enabled || !candidates.length) return;
  if (VALVES.some(valveIsOn)) {
    for (const v of candidates) state[v.n].note = `Soil ${state[v.n].avg}% needs water; waiting for the running valve`;
    return;
  }
  candidates.sort((a, b) => state[a.n].avg - state[b.n].avg);   // driest first
  const [first, ...rest] = candidates;
  openValve(first, state[first.n].avg);
  state[first.n].note = `Watering: soil ${state[first.n].avg}%, stops at ${targetPct()}% or after ${settings.maxRunMinutes} min`;
  for (const v of rest) state[v.n].note = `Soil ${state[v.n].avg}% needs water; next after Valve ${first.n}`;
}

/** Checks new settings; returns an error message or null. */
function validate(s) {
  const num = (x) => typeof x === "number" && Number.isFinite(x);
  if (!num(s.fieldCapacityPct) || !num(s.wiltingPointPct)) return "Field capacity and wilting point must be numbers";
  if (s.wiltingPointPct < 1 || s.fieldCapacityPct > 99) return "Readings must be between 1 and 99 %";
  if (s.fieldCapacityPct - s.wiltingPointPct < 5) return "Field capacity must be at least 5 points above the wilting point";
  if (!Number.isInteger(s.maxRunMinutes) || s.maxRunMinutes < 1 || s.maxRunMinutes > MAX_RUN_CAP_MIN)
    return `Maximum run time must be 1 to ${MAX_RUN_CAP_MIN} minutes`;
  if (!Number.isInteger(s.minGapMinutes) || s.minGapMinutes < 0 || s.minGapMinutes > 720)
    return "Rest between runs must be 0 to 720 minutes";
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!hhmm.test(s.startTime) || !hhmm.test(s.endTime)) return "Watering hours must look like 06:00";
  if (minutesOf(s.startTime) >= minutesOf(s.endTime)) return "Watering hours must start before they end";
  return null;
}

async function update(changes, actor) {
  const next = { ...settings };
  for (const k of Object.keys(DEFAULTS)) if (changes[k] !== undefined) next[k] = changes[k];
  next.enabled = !!next.enabled;
  const err = validate(next);
  if (err) { const e = new Error(err); e.status = 400; throw e; }
  await settingsStore.set(SETTINGS_KEY, next, actor);
  const was = settings;
  settings = next;
  const what = [];
  if (was.enabled !== next.enabled) what.push(next.enabled ? "switched ON" : "switched OFF");
  for (const k of Object.keys(DEFAULTS)) if (k !== "enabled" && was[k] !== next[k]) what.push(`${k} ${was[k]} -> ${next[k]}`);
  if (what.length) audit.record("AUTO_WATER_SETTINGS", actor, "Automatic watering", what.join("; ").slice(0, 250));
  evaluate();
  return status();
}

/** Research defaults for every number; leaves On/Off as it is. */
function resetToDefaults(actor) {
  return update({ ...DEFAULTS, enabled: settings.enabled }, actor);
}

function status() {
  return {
    settings,
    defaults: DEFAULTS,
    depletionFraction: DEPLETION_FRACTION,
    maxRunCapMinutes: MAX_RUN_CAP_MIN,
    refillPct: refillPct(),
    targetPct: targetPct(),
    inWateringHours: inHours(),
    valves: VALVES.map((v) => {
      const s = state[v.n];
      return {
        n: v.n, side: v.side, nodes: v.nodes, on: valveIsOn(v), auto: s.auto,
        since: s.since ? new Date(s.since).toISOString() : null,
        avgSoil: s.avg, used: s.used, skipped: s.skipped, note: s.note,
      };
    }),
  };
}

function start() {
  // Runs with automatic watering off until the saved settings are read.
  settingsStore.loadWhenReady(SETTINGS_KEY, null, (saved) => {
    if (saved && !validate({ ...DEFAULTS, ...saved, enabled: !!saved.enabled })) settings = { ...DEFAULTS, ...saved };
    console.log(`[AutoWater] ${settings.enabled ? "ON" : "off"}: refill below ${refillPct()}%, stop at ${targetPct()}%`);
    evaluate();
  });
  setInterval(evaluate, CHECK_EVERY_MS).unref();
}

module.exports = { start, status, update, resetToDefaults, VALVES };

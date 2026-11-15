// Live updates over server-sent events (/api/live):
//   node_live    a node's newest values, every 2 s: shown in place, no re-fetch
//   node_status  a node went online or offline (the Pi decides, not this clock)
//   reading      a minute's reading was saved: screens re-fetch
//   alert, device
// Screens also refresh when their tab comes back into view (browsers slow
// timers to once a minute in hidden tabs) and on a slow safety timer in case
// the push connection is down.
import { useEffect, useRef, useState } from 'react';

const listeners = new Set();
const statusListeners = new Set();
const nodeListeners = new Set();

// Newest pushed state of each node: { online, last_seen, values, stamp }.
// stamp = when this browser received it, to compare with fetched data.
const nodeState = new Map();

function applyNodeEvent(type, d) {
  if (!d?.node_id) return;
  const s = nodeState.get(d.node_id) || { online: false, last_seen: null, values: null };
  if (type === 'node_live') {
    s.online = true;
    s.last_seen = d.at;
    // Each sensor's newest value, or null when that sensor is not reading.
    if ('air_ok' in d) {
      s.values = {
        temperature: d.temperature, humidity: d.humidity, soil_pct: d.soil_pct,
        clr_risk: d.clr_risk, confidence_pct: d.confidence_pct,
        air_ok: d.air_ok, soil_ok: d.soil_ok, values_at: d.at,
      };
    }
  } else {
    s.online = d.online;
    s.last_seen = d.last_seen;
    if (!d.online) s.values = null;
  }
  s.stamp = Date.now();
  nodeState.set(d.node_id, s);
  nodeListeners.forEach((f) => f());
}
let source = null;
let connected = false;

function setConnected(v) {
  if (connected === v) return;
  connected = v;
  statusListeners.forEach((f) => f(v));
}

function open() {
  if (source || typeof EventSource === 'undefined') return;
  // Same origin: the browser sends the sign-in cookie, so no token in the URL.
  source = new EventSource('/api/live');
  source.onopen = () => setConnected(true);
  source.onerror = () => setConnected(false); // EventSource reconnects on its own
  const relay = (type) => (e) => {
    let data = null;
    try { data = JSON.parse(e.data); } catch { /* hint only */ }
    if (type === 'node_live' || type === 'node_status') applyNodeEvent(type, data);
    listeners.forEach((f) => f(type, data));
  };
  ['reading', 'alert', 'device', 'node_live', 'node_status']
    .forEach((type) => source.addEventListener(type, relay(type)));
}

function close() {
  if (!source) return;
  source.close();
  source = null;
  setConnected(false);
}

export function onLive(fn) {
  listeners.add(fn);
  open();
  return () => {
    listeners.delete(fn);
    if (!listeners.size) close();
  };
}

/** True while the push connection to the Pi is open. */
export function useLiveStatus() {
  const [on, setOn] = useState(connected);
  useEffect(() => {
    statusListeners.add(setOn);
    setOn(connected);
    return () => { statusListeners.delete(setOn); };
  }, []);
  return on;
}

/**
 * Runs load() now, whenever the Pi pushes a new reading or alert, when the tab
 * becomes visible again, and every fallbackMs as a safety net. pause() may
 * return true to skip a refresh (for example while a map pin is being dragged).
 */
export function useLiveRefresh(load, { fallbackMs = 15000, pause } = {}) {
  const ref = useRef({ load, pause });
  ref.current = { load, pause };
  useEffect(() => {
    const run = () => { if (!ref.current.pause?.()) ref.current.load(); };
    run();
    // 2-second samples are shown in place (useLiveRows), not re-fetched.
    const off = onLive((type) => { if (type !== 'node_live') run(); });
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(run, fallbackMs);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [fallbackMs]);
}

/**
 * A fetched /api/sensors/latest row updated with anything pushed after it was
 * fetched (fetchedAt, ms): online state, last contact and newest values.
 */
export function mergeLive(row, fetchedAt) {
  if (!row) return row;
  const s = nodeState.get(row.node_id);
  if (!s || s.stamp < fetchedAt) return row;
  const out = { ...row, online: s.online, last_seen: s.last_seen || row.last_seen };
  if (s.online && s.values) Object.assign(out, s.values);
  return out;
}

/**
 * Re-renders the calling screen whenever a node's live state changes.
 * pause() may return true to skip a re-render (while a map pin is dragged).
 */
export function useNodeLive({ pause } = {}) {
  const [, setN] = useState(0);
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    const f = () => { if (!pauseRef.current?.()) setN((n) => n + 1); };
    nodeListeners.add(f);
    const off = onLive(() => {}); // keep the push connection open
    return () => { nodeListeners.delete(f); off(); };
  }, []);
}

/** rows (from /api/sensors/latest, fetched at fetchedAt) kept live. */
export function useLiveRows(rows, fetchedAt, opts) {
  useNodeLive(opts);
  return rows.map((r) => mergeLive(r, fetchedAt));
}

/** Re-renders every intervalMs so "x seconds ago" labels keep counting. */
export function useTicker(intervalMs = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}

/** "8 s ago", "3 min ago", "2 h ago". */
export function agoLabel(date) {
  if (!date) return '';
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

/** Counts up once a second ("8 s ago"); only this label re-renders. */
export function Ago({ date }) {
  useTicker(1000);
  return date ? agoLabel(date) : null;
}

/** Newest contact time (ms) among the given nodes, or null. */
export const latestStamp = (nodes) =>
  nodes.reduce((m, n) => Math.max(m, n.lastSeen ? n.lastSeen.getTime() : 0), 0) || null;

// A signed-out session cannot open the push stream: stop retrying until the
// next screen mounts after signing in again.
if (typeof window !== 'undefined') window.addEventListener('farmsense:signed-out', close);

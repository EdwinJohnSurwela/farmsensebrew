/**
 * Relay Service — centralizes relay state for irrigation nodes.
 * Safety (FB-54): a watchdog force-stops any relay that has been running
 * longer than MAX_PUMP_RUNTIME_MINUTES (default 30) so a stuck schedule,
 * rule or manual toggle can't flood a plot or burn out the pump.
 */
const relayState = { 1: false, 2: false, 3: false, 4: false, 5: false };
const relayOnSince = {}; // numeric id -> epoch ms while ON

const MAX_RUNTIME_MS =
  (parseInt(process.env.MAX_PUMP_RUNTIME_MINUTES) || 30) * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, since] of Object.entries(relayOnSince)) {
    if (relayState[id] && now - since > MAX_RUNTIME_MS) {
      relayState[id] = false;
      delete relayOnSince[id];
      console.warn(
        `[Relay] SAFETY: node ${id} force-stopped after exceeding max runtime (${MAX_RUNTIME_MS / 60000} min)`
      );
    }
  }
}, 30000).unref();

function parseNodeId(nodeId) {
  if (nodeId == null) return null;
  if (typeof nodeId === 'number') return nodeId;
  const s = String(nodeId).toUpperCase();
  // Accept formats: 'NODE_01', 'NODE01', '1', '01'
  const m = s.match(/NODE[_-]?(\d+)/i);
  if (m) return parseInt(m[1], 10);
  const digits = s.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
}

function getState(nodeId) {
  const id = parseNodeId(nodeId);
  if (!id) return false;
  return !!relayState[id];
}

function setState(nodeId, state) {
  const id = parseNodeId(nodeId);
  if (!id) {
    console.warn('[Relay] setState called with invalid nodeId:', nodeId);
    return;
  }
  relayState[id] = !!state;
  if (relayState[id]) relayOnSince[id] = Date.now();
  else delete relayOnSince[id];
  console.log(`[Relay] Node ${id} -> ${relayState[id] ? 'ON' : 'OFF'}`);
}

// When the valve box last asked for the relay states (it polls every ~2 s).
let lastValvePoll = 0;
function noteValvePoll() { lastValvePoll = Date.now(); }
function valveBox() {
  return {
    online: lastValvePoll > 0 && Date.now() - lastValvePoll < 15000,
    last_poll: lastValvePoll ? new Date(lastValvePoll).toISOString() : null,
  };
}

function getAll() {
  return Object.entries(relayState).map(([id, state]) => ({ node_id: parseInt(id, 10), relay_on: !!state }));
}

module.exports = { getState, setState, getAll, noteValvePoll, valveBox };

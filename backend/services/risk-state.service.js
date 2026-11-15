/**
 * Risk State — last computed CLR risk per node, kept in memory.
 * Written by sensor.service on every reading; read by the scheduler and
 * automatic watering to withhold irrigation when disease risk is HIGH or
 * CRITICAL (watering a zone at that risk accelerates Coffee Leaf Rust).
 */
const { rank, HOLD_WATER_FROM } = require("./clr-risk");

const lastRisk = {}; // numeric node id -> 'MINIMAL' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

function parseNode(nodeId) {
  return (typeof nodeId === "number")
    ? nodeId
    : parseInt(String(nodeId).replace(/\D/g, ""), 10);
}

function setRisk(nodeId, level) {
  const n = parseNode(nodeId);
  if (n) lastRisk[n] = level;
}

function getRisk(nodeId) {
  const n = parseNode(nodeId);
  return (n && lastRisk[n]) || null;
}

/** True when the node is HIGH or CRITICAL, the levels that hold watering. */
function isHigh(nodeId) {
  return rank(getRisk(nodeId)) >= HOLD_WATER_FROM;
}

module.exports = { setRisk, getRisk, isHigh };
